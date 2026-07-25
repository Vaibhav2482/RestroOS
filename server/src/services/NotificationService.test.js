import { describe, it, expect, vi, beforeEach } from "vitest";

import * as NotificationService from "./NotificationService.js";
import { getResendClient } from "../config/resend.js";
import { getTwilioClient } from "../config/twilio.js";
import * as CustomerRepository from "../repositories/CustomerRepository.js";

vi.mock("../config/resend.js");
vi.mock("../config/twilio.js");
vi.mock("../repositories/CustomerRepository.js");

const customer = { CustomerId: 1, FullName: "Vaibhav Nawale", Email: "vaibhav@example.com", Phone: "+919999999999" };

const order = {
    OrderId: 62,
    CustomerId: 1,
    TotalAmount: 105,
    OrderStatus: "Delivered",
    PaymentMethod: "Cash"
};

let sendEmailMock;
let createMessageMock;

beforeEach(() => {

    vi.clearAllMocks();

    CustomerRepository.getCustomerById.mockResolvedValue(customer);

    sendEmailMock = vi.fn().mockResolvedValue({});
    getResendClient.mockReturnValue({ emails: { send: sendEmailMock } });

    createMessageMock = vi.fn().mockResolvedValue({});
    getTwilioClient.mockReturnValue({ messages: { create: createMessageMock } });

    process.env.TWILIO_SMS_FROM_NUMBER = "+15551234567";
    process.env.TWILIO_WHATSAPP_FROM_NUMBER = "+14155238886";
    process.env.TWILIO_WHATSAPP_TEMPLATE_ORDER_CONFIRMED = "HX_confirmed";
    process.env.TWILIO_WHATSAPP_TEMPLATE_STATUS_CHANGED = "HX_status";
    process.env.TWILIO_WHATSAPP_TEMPLATE_ORDER_CANCELLED = "HX_cancelled";

});

describe("NotificationService.notifyOrderCreated", () => {

    it("fans out to email, SMS, and WhatsApp when all three are configured", async () => {

        await NotificationService.notifyOrderCreated(order);

        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        expect(sendEmailMock.mock.calls[0][0]).toMatchObject({ to: customer.Email, subject: expect.stringContaining("#62") });

        expect(createMessageMock).toHaveBeenCalledTimes(2);

        const smsCall = createMessageMock.mock.calls.find((call) => call[0].to === customer.Phone);
        const whatsappCall = createMessageMock.mock.calls.find((call) => call[0].to === `whatsapp:${customer.Phone}`);

        expect(smsCall[0]).toMatchObject({ from: "+15551234567", to: customer.Phone });
        expect(smsCall[0].body).toContain("#62");

        // WhatsApp business-initiated messages require a pre-approved
        // Content Template (ContentSid + numbered variables), not a free-form
        // body - Twilio only accepts free text within 24h of the customer
        // themselves messaging in, which an order notification never is.
        expect(whatsappCall[0]).toMatchObject({
            from: "whatsapp:+14155238886",
            to: `whatsapp:${customer.Phone}`,
            contentSid: "HX_confirmed"
        });
        expect(JSON.parse(whatsappCall[0].contentVariables)).toEqual({
            1: customer.FullName,
            2: "62",
            3: "Rs. 105.00"
        });

    });

    it("skips WhatsApp (but still sends SMS) when that message's template isn't configured", async () => {

        delete process.env.TWILIO_WHATSAPP_TEMPLATE_ORDER_CONFIRMED;

        await NotificationService.notifyOrderCreated(order);

        expect(createMessageMock).toHaveBeenCalledTimes(1);
        expect(createMessageMock.mock.calls[0][0].to).toBe(customer.Phone);

    });

    it("skips SMS/WhatsApp but still emails when Twilio isn't configured", async () => {

        getTwilioClient.mockReturnValue(null);

        await NotificationService.notifyOrderCreated(order);

        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        expect(createMessageMock).not.toHaveBeenCalled();

    });

    it("skips SMS/WhatsApp when the customer has no phone on file, without throwing", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue({ ...customer, Phone: null });

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

describe("NotificationService.notifyOrderCancelled", () => {

    it("says no refund is needed for cash orders, rather than leaving the note blank", async () => {

        await NotificationService.notifyOrderCancelled(order, false);

        // A blank/omitted template variable renders as a visible gap on
        // WhatsApp and reads as broken - the note must always say something.
        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).toMatch(/no refund is needed/i);

        const whatsappCall = createMessageMock.mock.calls.find((call) => call[0].to === `whatsapp:${customer.Phone}`);
        expect(JSON.parse(whatsappCall[0].contentVariables)[3]).toMatch(/no refund is needed/i);

    });

    it("includes a refund note for non-cash orders", async () => {

        await NotificationService.notifyOrderCancelled({ ...order, PaymentMethod: "UPI" }, true);

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).toMatch(/refund/i);
        expect(emailArgs.html).toContain("Rs. 105.00");

    });

});
