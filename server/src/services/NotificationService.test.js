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
        expect(whatsappCall[0]).toMatchObject({ from: "whatsapp:+14155238886", to: `whatsapp:${customer.Phone}` });

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

    it("omits the refund note for cash orders", async () => {

        await NotificationService.notifyOrderCancelled(order, false);

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).not.toMatch(/refund/i);

        const smsCall = createMessageMock.mock.calls.find((call) => call[0].to === customer.Phone);
        expect(smsCall[0].body).not.toMatch(/refund/i);

    });

    it("includes a refund note for non-cash orders", async () => {

        await NotificationService.notifyOrderCancelled({ ...order, PaymentMethod: "UPI" }, true);

        const [emailArgs] = sendEmailMock.mock.calls[0];
        expect(emailArgs.html).toMatch(/refund/i);
        expect(emailArgs.html).toContain("Rs. 105.00");

    });

});
