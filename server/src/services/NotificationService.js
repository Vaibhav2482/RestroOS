import { getResendClient } from "../config/resend.js";
import { getTwilioClient } from "../config/twilio.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import * as OrderRepository from "../repositories/OrderRepository.js";

const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || "RestroOS <onboarding@resend.dev>";

const sendEmail = async (to, subject, html) => {

    const resend = getResendClient();

    if (!resend || !to) {
        return;
    }

    try {

        await resend.emails.send({ from: FROM_EMAIL, to, subject, html });

    } catch (error) {

        console.error(`Email notification failed (${subject} -> ${to}): ${error.message}`);

    }

};

// Every phone number this app has ever collected is a bare 10-digit Indian
// mobile number - the registration/profile forms have no country-code
// field. Twilio requires full E.164 for both SMS and WhatsApp: a raw
// "9405672482" gets treated as a different, unverified number for SMS
// (silently fails on trial accounts) and rejected outright as an "Invalid
// Parameter" for WhatsApp. Numbers that already start with "+" pass through
// untouched, so this stays correct if international numbers get collected
// later without needing to change every call site.
const toE164 = (phone) => {

    if (!phone) {
        return phone;
    }

    const trimmed = phone.trim();

    return trimmed.startsWith("+") ? trimmed : `+91${trimmed.replace(/\D/g, "")}`;

};

const sendSms = async (to, body) => {

    const client = getTwilioClient();
    const formattedTo = toE164(to);

    if (!client || !formattedTo || !process.env.TWILIO_SMS_FROM_NUMBER) {
        return;
    }

    try {

        await client.messages.create({ body, from: process.env.TWILIO_SMS_FROM_NUMBER, to: formattedTo });

    } catch (error) {

        console.error(`SMS notification failed (-> ${formattedTo}): [${error.code}] ${error.message}`);

    }

};

// Unlike SMS, WhatsApp will only accept free-form text (a plain "body")
// inside the 24-hour window after the customer themselves last messaged in -
// which an order notification, being business-initiated, never is. Outside
// that window Twilio/Meta require a pre-approved Content Template
// (ContentSid) with numbered {{1}}, {{2}}... placeholders instead, so this
// sends contentSid + contentVariables rather than a body. templateEnvVar
// names which env var holds that message type's ContentSid - not set means
// that template hasn't been created/approved yet, so WhatsApp is skipped
// for it (same "optional, silently skip" pattern as every other channel).
const sendWhatsApp = async (to, templateEnvVar, contentVariables) => {

    const client = getTwilioClient();
    const contentSid = process.env[templateEnvVar];
    const formattedTo = toE164(to);

    if (!client || !formattedTo || !contentSid || !process.env.TWILIO_WHATSAPP_FROM_NUMBER) {
        return;
    }

    try {

        await client.messages.create({
            contentSid,
            contentVariables: JSON.stringify(contentVariables),
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM_NUMBER}`,
            to: `whatsapp:${formattedTo}`
        });

    } catch (error) {

        console.error(`WhatsApp notification failed (${templateEnvVar} -> ${formattedTo}): [${error.code}] ${error.message} - ${error.moreInfo || ""}`);

    }

};

const formatMoney = (value) => `Rs. ${Number(value ?? 0).toFixed(2)}`;

// The Orders row handed to every notify* function below never carries its
// line items (OrderRepository.createOrder/updateOrderStatus only return the
// Orders row itself) - fetched separately here since only the notifications
// need it, not the order flow those functions are called from.
const getOrderItems = async (orderId) => {

    const rows = await OrderRepository.getOrderById(orderId);

    return rows.map((row) => ({ itemName: row.ItemName, quantity: row.Quantity, totalPrice: row.TotalPrice }));

};

const formatBillText = (items) =>
    items.map((item) => `${item.quantity}x ${item.itemName} - ${formatMoney(item.totalPrice)}`).join("\n");

const formatBillHtml = (items) =>
    `<ul>${items.map((item) => `<li>${item.quantity}x ${item.itemName} - ${formatMoney(item.totalPrice)}</li>`).join("")}</ul>`;

// Best-effort throughout this file: an order must never fail to place, a
// status update never fail to save, just because a notification couldn't be
// sent. Every notify* function below fans out to every configured channel
// (email/SMS/WhatsApp) at once rather than picking one - each channel is
// independently best-effort and silently skips itself if its provider (or,
// for WhatsApp, that specific message's approved template) isn't
// configured, or the customer has no email/phone on file.
export const notifyOrderCreated = async (order) => {

    const [customer, items] = await Promise.all([
        CustomerRepository.getCustomerById(order.CustomerId),
        getOrderItems(order.OrderId)
    ]);

    if (!customer) {
        return;
    }

    const total = formatMoney(order.TotalAmount);
    const billText = formatBillText(items);

    await Promise.all([
        sendEmail(
            customer.Email,
            `Order #${order.OrderId} confirmed`,
            `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> has been placed successfully.</p>
               ${formatBillHtml(items)}
               <p>Total: <strong>${total}</strong></p>
               <p>We'll notify you as it moves through the kitchen.</p>`
        ),
        sendSms(
            customer.Phone,
            `Hi ${customer.FullName}, your order #${order.OrderId} has been placed:\n${billText}\nTotal: ${total}\nWe'll update you as it moves through the kitchen.`
        ),
        sendWhatsApp(customer.Phone, "TWILIO_WHATSAPP_TEMPLATE_ORDER_CONFIRMED", {
            1: customer.FullName,
            2: String(order.OrderId),
            3: billText,
            4: total
        })
    ]);

};

// Every status change gets a short ping - Delivered additionally gets the
// full bill as a closing receipt (repeating the bill on every intermediate
// Accepted/Preparing/Ready/Out For Delivery step would just be spammy).
export const notifyOrderStatusChanged = async (order) => {

    const customer = await CustomerRepository.getCustomerById(order.CustomerId);

    if (!customer) {
        return;
    }

    if (order.OrderStatus !== "Delivered") {

        await Promise.all([
            sendEmail(
                customer.Email,
                `Order #${order.OrderId} is now ${order.OrderStatus}`,
                `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> status has been updated to <strong>${order.OrderStatus}</strong>.</p>`
            ),
            sendSms(
                customer.Phone,
                `Hi ${customer.FullName}, your order #${order.OrderId} is now ${order.OrderStatus}.`
            ),
            sendWhatsApp(customer.Phone, "TWILIO_WHATSAPP_TEMPLATE_STATUS_CHANGED", {
                1: customer.FullName,
                2: String(order.OrderId),
                3: order.OrderStatus
            })
        ]);

        return;

    }

    const items = await getOrderItems(order.OrderId);
    const total = formatMoney(order.TotalAmount);
    const billText = formatBillText(items);

    await Promise.all([
        sendEmail(
            customer.Email,
            `Order #${order.OrderId} delivered`,
            `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> has been delivered. Here's your final bill:</p>
               ${formatBillHtml(items)}
               <p>Total: <strong>${total}</strong></p>
               <p>Thank you for ordering with us!</p>`
        ),
        sendSms(
            customer.Phone,
            `Hi ${customer.FullName}, your order #${order.OrderId} has been delivered:\n${billText}\nTotal: ${total}\nThank you for ordering with us!`
        ),
        sendWhatsApp(customer.Phone, "TWILIO_WHATSAPP_TEMPLATE_ORDER_DELIVERED", {
            1: customer.FullName,
            2: String(order.OrderId),
            3: billText,
            4: total
        })
    ]);

};

// On-demand, unlike every notify* function above - triggered by a customer
// or staff member clicking "Email Bill", not by an order event. Reuses the
// same bill formatting, but always sends regardless of order status (a
// cancelled or years-old order can still have its receipt re-sent).
export const emailBill = async (order) => {

    const [customer, items] = await Promise.all([
        CustomerRepository.getCustomerById(order.CustomerId),
        getOrderItems(order.OrderId)
    ]);

    if (!customer) {
        return { success: false, message: "Customer not found." };
    }

    if (!customer.Email) {
        return { success: false, message: "This customer has no email on file." };
    }

    if (!getResendClient()) {
        return { success: false, message: "Email isn't configured for this restaurant yet." };
    }

    await sendEmail(
        customer.Email,
        `Your bill for Order #${order.OrderId}`,
        `<p>Hi ${customer.FullName},</p>
               <p>Here's your bill for order <strong>#${order.OrderId}</strong>:</p>
               ${formatBillHtml(items)}
               <p>Total: <strong>${formatMoney(order.TotalAmount)}</strong></p>`
    );

    return { success: true, message: `Bill emailed to ${customer.Email}.` };

};

export const notifyOrderCancelled = async (order, refunded) => {

    const [customer, items] = await Promise.all([
        CustomerRepository.getCustomerById(order.CustomerId),
        getOrderItems(order.OrderId)
    ]);

    if (!customer) {
        return;
    }

    // Always a concrete sentence, never blank - a WhatsApp template variable
    // left empty renders as a visible gap and reads as broken to Meta's
    // review and to the customer alike.
    const refundNote = order.PaymentMethod === "Cash"
        ? "No refund is needed since payment was made in cash."
        : refunded
            ? `A refund of ${formatMoney(order.TotalAmount)} has been initiated and should reflect in 5-7 business days.`
            : "Our team will process your refund shortly.";

    const billText = formatBillText(items);

    await Promise.all([
        sendEmail(
            customer.Email,
            `Order #${order.OrderId} cancelled`,
            `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> has been cancelled.</p>
               ${formatBillHtml(items)}
               <p>${refundNote}</p>`
        ),
        sendSms(
            customer.Phone,
            `Hi ${customer.FullName}, your order #${order.OrderId} has been cancelled:\n${billText}\n${refundNote}`
        ),
        sendWhatsApp(customer.Phone, "TWILIO_WHATSAPP_TEMPLATE_ORDER_CANCELLED", {
            1: customer.FullName,
            2: String(order.OrderId),
            3: billText,
            4: refundNote
        })
    ]);

};
