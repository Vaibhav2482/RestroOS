import { getResendClient } from "../config/resend.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || "RestroOS <onboarding@resend.dev>";

// Channel-agnostic send - email only today. Adding WhatsApp later means
// changing this one function (and reading a per-customer channel
// preference, once that exists) - every notify* function below and every
// caller of them stays the same either way.
const sendNotification = async ({ to, subject, body }) => {

    const resend = getResendClient();

    if (!resend || !to) {
        return;
    }

    try {

        await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html: body
        });

    } catch (error) {

        console.error(`Notification failed (${subject} -> ${to}): ${error.message}`);

    }

};

const formatMoney = (value) => `Rs. ${Number(value ?? 0).toFixed(2)}`;

// Best-effort throughout this file: an order must never fail to place, a
// status update never fail to save, just because a notification couldn't be
// sent. Every notify* function below swallows its own errors (via
// sendNotification) and never throws.

export const notifyOrderCreated = async (order) => {

    const customer = await CustomerRepository.getCustomerById(order.CustomerId);

    if (!customer) {
        return;
    }

    await sendNotification({
        to: customer.Email,
        subject: `Order #${order.OrderId} confirmed`,
        body: `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> has been placed successfully.</p>
               <p>Total: <strong>${formatMoney(order.TotalAmount)}</strong></p>
               <p>We'll email you as it moves through the kitchen.</p>`
    });

};

export const notifyOrderStatusChanged = async (order) => {

    const customer = await CustomerRepository.getCustomerById(order.CustomerId);

    if (!customer) {
        return;
    }

    await sendNotification({
        to: customer.Email,
        subject: `Order #${order.OrderId} is now ${order.OrderStatus}`,
        body: `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> status has been updated to <strong>${order.OrderStatus}</strong>.</p>`
    });

};

export const notifyOrderCancelled = async (order, refunded) => {

    const customer = await CustomerRepository.getCustomerById(order.CustomerId);

    if (!customer) {
        return;
    }

    const refundLine = order.PaymentMethod === "Cash"
        ? ""
        : `<p>${refunded
            ? `A refund of <strong>${formatMoney(order.TotalAmount)}</strong> has been initiated and should reflect in 5-7 business days.`
            : "Our team will process your refund shortly."}</p>`;

    await sendNotification({
        to: customer.Email,
        subject: `Order #${order.OrderId} cancelled`,
        body: `<p>Hi ${customer.FullName},</p>
               <p>Your order <strong>#${order.OrderId}</strong> has been cancelled.</p>
               ${refundLine}`
    });

};
