import { getResendClient } from "../config/resend.js";
import { getTwilioClient } from "../config/twilio.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

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

const sendSms = async (to, body) => {

    const client = getTwilioClient();

    if (!client || !to || !process.env.TWILIO_SMS_FROM_NUMBER) {
        return;
    }

    try {

        await client.messages.create({ body, from: process.env.TWILIO_SMS_FROM_NUMBER, to });

    } catch (error) {

        console.error(`SMS notification failed (-> ${to}): ${error.message}`);

    }

};

// Twilio's WhatsApp Business API reuses the same client/credentials as SMS -
// only the "from"/"to" values change, prefixed with "whatsapp:". The sender
// number is the sandbox number during testing, and a Meta-approved
// WhatsApp Business number once that verification is done.
const sendWhatsApp = async (to, body) => {

    const client = getTwilioClient();

    if (!client || !to || !process.env.TWILIO_WHATSAPP_FROM_NUMBER) {
        return;
    }

    try {

        await client.messages.create({
            body,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM_NUMBER}`,
            to: `whatsapp:${to}`
        });

    } catch (error) {

        console.error(`WhatsApp notification failed (-> ${to}): ${error.message}`);

    }

};

const formatMoney = (value) => `Rs. ${Number(value ?? 0).toFixed(2)}`;

// Best-effort throughout this file: an order must never fail to place, a
// status update never fail to save, just because a notification couldn't be
// sent. Every notify* function below fans out to every configured channel
// (email/SMS/WhatsApp) at once rather than picking one - each channel is
// independently best-effort and silently skips itself if its provider isn't
// configured or the customer has no email/phone on file.
const notifyCustomer = async (customer, { subject, emailBody, textBody }) => {

    await Promise.all([
        sendEmail(customer.Email, subject, emailBody),
        sendSms(customer.Phone, textBody),
        sendWhatsApp(customer.Phone, textBody)
    ]);

};

export const notifyOrderCreated = async (order) => {

    const customer = await CustomerRepository.getCustomerById(order.CustomerId);

    if (!customer) {
        return;
    }

    await notifyCustomer(customer, {
        subject: `Order #${order.OrderId} confirmed`,
        emailBody: `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> has been placed successfully.</p>
               <p>Total: <strong>${formatMoney(order.TotalAmount)}</strong></p>
               <p>We'll notify you as it moves through the kitchen.</p>`,
        textBody: `Hi ${customer.FullName}, your order #${order.OrderId} (${formatMoney(order.TotalAmount)}) has been placed successfully. We'll update you as it moves through the kitchen.`
    });

};

export const notifyOrderStatusChanged = async (order) => {

    const customer = await CustomerRepository.getCustomerById(order.CustomerId);

    if (!customer) {
        return;
    }

    await notifyCustomer(customer, {
        subject: `Order #${order.OrderId} is now ${order.OrderStatus}`,
        emailBody: `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> status has been updated to <strong>${order.OrderStatus}</strong>.</p>`,
        textBody: `Hi ${customer.FullName}, your order #${order.OrderId} is now ${order.OrderStatus}.`
    });

};

export const notifyOrderCancelled = async (order, refunded) => {

    const customer = await CustomerRepository.getCustomerById(order.CustomerId);

    if (!customer) {
        return;
    }

    const refundNoteHtml = order.PaymentMethod === "Cash"
        ? ""
        : `<p>${refunded
            ? `A refund of <strong>${formatMoney(order.TotalAmount)}</strong> has been initiated and should reflect in 5-7 business days.`
            : "Our team will process your refund shortly."}</p>`;

    const refundNoteText = order.PaymentMethod === "Cash"
        ? ""
        : ` ${refunded
            ? `A refund of ${formatMoney(order.TotalAmount)} has been initiated and should reflect in 5-7 business days.`
            : "Our team will process your refund shortly."}`;

    await notifyCustomer(customer, {
        subject: `Order #${order.OrderId} cancelled`,
        emailBody: `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> has been cancelled.</p>
               ${refundNoteHtml}`,
        textBody: `Hi ${customer.FullName}, your order #${order.OrderId} has been cancelled.${refundNoteText}`
    });

};
