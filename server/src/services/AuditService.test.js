import { describe, it, expect, vi, beforeEach } from "vitest";

import * as AuditService from "./AuditService.js";
import * as AuditRepository from "../repositories/AuditRepository.js";

vi.mock("../repositories/AuditRepository.js");

beforeEach(() => {
    vi.clearAllMocks();
});

describe("AuditService - a broken audit write must never fail the action it's auditing", () => {

    it("record() swallows a repository error instead of throwing", async () => {

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        AuditRepository.record.mockRejectedValue(new Error("connection reset"));

        await expect(
            AuditService.record({ tenantId: 1, action: "ADMIN_CREATED", entityType: "Admin", summary: "test" })
        ).resolves.toBeUndefined();

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("ADMIN_CREATED"));

    });

    it("record() writes through to the repository on the happy path", async () => {

        AuditRepository.record.mockResolvedValue({ AuditLogId: 1 });

        await AuditService.record({ tenantId: 1, action: "COUPON_CREATED", entityType: "Coupon", entityId: 5, summary: "test" });

        expect(AuditRepository.record).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: 1, action: "COUPON_CREATED", entityType: "Coupon", entityId: 5 })
        );

    });

});

describe("AuditService - getLogs", () => {

    it("scopes to the caller's own tenant and passes filters through", async () => {

        AuditRepository.getByTenant.mockResolvedValue([{ AuditLogId: 1 }]);

        const result = await AuditService.getLogs(9, { entityType: "Coupon" });

        expect(result.success).toBe(true);
        expect(AuditRepository.getByTenant).toHaveBeenCalledWith(9, { entityType: "Coupon" });

    });

});
