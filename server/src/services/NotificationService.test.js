import { describe, it, expect, vi, beforeEach } from "vitest";

import * as NotificationService from "./NotificationService.js";
import { getResendClient } from "../config/resend.js";
import { getTwilioClient } from "../config/twilio.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";
import * as OrderRepository from "../repositories/OrderRepository.js";

vi.mock("../config/resend.js");
vi.mock("../config/twilio.js");
vi.mock("../repositories/CustomerRepository.js");
vi.mock("../repositories/OrderRepository.js");

const customer = { CustomerId: 1, FullName: "Vaibhav Nawale", Email: "vaibhav@example.com", Phone: "+919999999999" };

const order = {
    OrderId: 62,
    CustomerId: 1,
    TotalAmount: 105,
    OrderStatus: "Ready",
    PaymentMethod: "Cash"
};

// getOrderById returns one row per item, same shape OrderRepository actually
// returns (joined Orders + OrderItems columns) - only the item-related
// columns matter for these tests.
const orderItemRows = [
    { ItemName: "Garam Tea", Quantity: 3, TotalPrice: 30 },
    { ItemName: "Irani Chai", Quantity: 1, TotalPrice: 75 }
];

let sendEmailMock;
let createMessageMock;

beforeEach(() => {

    vi.clearAllMocks();

    CustomerRepository.getCustomerById.mockResolvedValue(customer);
    OrderRepository.getOrderById.mockResolvedValue(orderItemRows);

    sendEmailMock = vi.fn().mockResolvedValue({});
    getResendClient.mockReturnValue({ emails: { send: sendEmailMock } });

    createMessageMock = vi.fn().mockResolvedValue({});
    getTwilioClient.mockReturnValue({ messages: { create: createMessageMock } });

    process.env.TWILIO_SMS_FROM_NUMBER = "+15551234567";
    process.env.TWILIO_WHATSAPP_FROM_NUMBER = "+14155238886";
    process.env.TWILIO_WHATSAPP_TEMPLATE_ORDER_CONFIRMED = "HX_confirmed";
    process.env.TWILIO_WHATSAPP_TEMPLATE_STATUS_CHANGED = "HX_status";
    process.env.TWILIO_WHATSAPP_TEMPLATE_ORDER_DELIVERED = "HX_delivered";
    process.env.TWILIO_WHATSAPP_TEMPLATE_ORDER_CANCELLED = "HX_cancelled";

});

const whatsappCallTo = (phone) => createMessageMock.mock.calls.find((call) => call[0].to === `whatsapp:${phone}`);
const smsCallTo = (phone) => createMessageMock.mock.calls.find((call) => call[0].to === phone);

describe("NotificationService.notifyOrderCreated", () => {

    it("includes the itemized bill on email, SMS, and the WhatsApp template", async () => {

        await NotificationService.notifyOrderCreated(order);

        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).toContain("3x Garam Tea");
        expect(emailArgs.html).toContain("1x Irani Chai");
        expect(emailArgs.html).toContain("Rs. 105.00");

        const sms = smsCallTo(customer.Phone);
        expect(sms[0].body).toContain("3x Garam Tea - Rs. 30.00");
        expect(sms[0].body).toContain("1x Irani Chai - Rs. 75.00");

        const whatsapp = whatsappCallTo(customer.Phone);
        expect(whatsapp[0].contentSid).toBe("HX_confirmed");

        const variables = JSON.parse(whatsapp[0].contentVariables);
        expect(variables[1]).toBe(customer.FullName);
        expect(variables[2]).toBe("62");
        expect(variables[3]).toContain("3x Garam Tea");
        expect(variables[4]).toBe("Rs. 105.00");

    });

    it("formats a bare 10-digit phone number to E.164 before sending", async () => {

        // Every phone number this app has ever collected is a bare 10-digit
        // number with no country code (confirmed against a real production
        // failure: Twilio treated "9405672482" as a different, unverified
        // number for SMS and rejected it outright for WhatsApp).
        CustomerRepository.getCustomerById.mockResolvedValue({ ...customer, Phone: "9405672482" });

        await NotificationService.notifyOrderCreated(order);

        const sms = smsCallTo("+919405672482");
        expect(sms).toBeDefined();

        const whatsapp = whatsappCallTo("+919405672482");
        expect(whatsapp).toBeDefined();

    });

    it("skips SMS/WhatsApp but still emails when Twilio isn't configured", async () => {

        getTwilioClient.mockReturnValue(null);

        await NotificationService.notifyOrderCreated(order);

        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        expect(createMessageMock).not.toHaveBeenCalled();

    });

    it("does not throw when the customer no longer exists", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue(undefined);

        await expect(NotificationService.notifyOrderCreated(order)).resolves.toBeUndefined();

        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(createMessageMock).not.toHaveBeenCalled();

    });

    it("swallows a provider error instead of throwing (order flow must never fail because a notification did)", async () => {

        sendEmailMock.mockRejectedValue(new Error("Resend is down"));
        createMessageMock.mockRejectedValue(new Error("Twilio is down"));

        await expect(NotificationService.notifyOrderCreated(order)).resolves.toBeUndefined();

    });

});

describe("NotificationService.notifyOrderStatusChanged", () => {

    it("sends a short ping with no bill for a non-final status", async () => {

        await NotificationService.notifyOrderStatusChanged({ ...order, OrderStatus: "Preparing" });

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).not.toContain("Garam Tea");
        expect(emailArgs.html).toMatch(/Preparing/);

        const whatsapp = whatsappCallTo(customer.Phone);
        expect(whatsapp[0].contentSid).toBe("HX_status");
        expect(JSON.parse(whatsapp[0].contentVariables)[3]).toBe("Preparing");

        // Delivered-only lookup - a non-final status shouldn't pay for the
        // extra getOrderById call it doesn't need.
        expect(OrderRepository.getOrderById).not.toHaveBeenCalled();

    });

    it("sends the full bill as a closing receipt when the order is Delivered", async () => {

        await NotificationService.notifyOrderStatusChanged({ ...order, OrderStatus: "Delivered" });

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).toContain("3x Garam Tea");
        expect(emailArgs.html).toContain("Rs. 105.00");

        const whatsapp = whatsappCallTo(customer.Phone);
        expect(whatsapp[0].contentSid).toBe("HX_delivered");

        const variables = JSON.parse(whatsapp[0].contentVariables);
        expect(variables[3]).toContain("3x Garam Tea");
        expect(variables[4]).toBe("Rs. 105.00");

    });

});

describe("NotificationService.notifyOrderCancelled", () => {

    it("includes the bill and says no refund is needed for cash orders", async () => {

        await NotificationService.notifyOrderCancelled(order, false);

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).toContain("3x Garam Tea");
        expect(emailArgs.html).toMatch(/no refund is needed/i);

        const whatsapp = whatsappCallTo(customer.Phone);
        const variables = JSON.parse(whatsapp[0].contentVariables);
        expect(variables[3]).toContain("3x Garam Tea");
        expect(variables[4]).toMatch(/no refund is needed/i);

    });

    it("includes a refund note for non-cash orders", async () => {

        await NotificationService.notifyOrderCancelled({ ...order, PaymentMethod: "UPI" }, true);

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).toMatch(/refund/i);
        expect(emailArgs.html).toContain("Rs. 105.00");

    });

});

describe("NotificationService.emailBill", () => {

    it("sends the bill regardless of order status and reports success", async () => {

        const result = await NotificationService.emailBill(order);

        expect(result.success).toBe(true);
        expect(result.message).toContain(customer.Email);

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.to).toBe(customer.Email);
        expect(emailArgs.subject).toContain("#62");
        expect(emailArgs.html).toContain("3x Garam Tea");
        expect(emailArgs.html).toContain("Rs. 105.00");

        // On-demand, not tied to any order event - SMS/WhatsApp weren't asked
        // for here ("send on the mail"), only email should fire.
        expect(createMessageMock).not.toHaveBeenCalled();

    });

    it("fails cleanly when the customer has no email on file", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue({ ...customer, Email: null });

        const result = await NotificationService.emailBill(order);

        expect(result.success).toBe(false);
        expect(sendEmailMock).not.toHaveBeenCalled();

    });

    it("fails cleanly when email isn't configured for this tenant", async () => {

        getResendClient.mockReturnValue(null);

        const result = await NotificationService.emailBill(order);

        expect(result.success).toBe(false);
        expect(sendEmailMock).not.toHaveBeenCalled();

    });

    it("fails cleanly when the customer no longer exists", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue(undefined);

        const result = await NotificationService.emailBill(order);

        expect(result.success).toBe(false);
        expect(sendEmailMock).not.toHaveBeenCalled();

    });

});
