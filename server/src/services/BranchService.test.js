import { describe, it, expect, vi, beforeEach } from "vitest";

import * as BranchService from "./BranchService.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import * as AuditService from "./AuditService.js";

vi.mock("../repositories/BranchRepository.js");
vi.mock("./AuditService.js");

const TENANT_ID = 3;
const ADMIN_ID = 7;

beforeEach(() => {

    vi.clearAllMocks();
    AuditService.record.mockResolvedValue();

});

// Only covers the new DeliveryStaffingMode validation this feature adds -
// the rest of BranchService's create/update/deactivate behavior predates
// this and isn't part of this change's scope.
describe("BranchService - DeliveryStaffingMode validation", () => {

    it("rejects an invalid mode on create, without writing anything", async () => {

        const result = await BranchService.createBranch(
            { branchName: "Main", deliveryStaffingMode: "carrier_pigeon" }, TENANT_ID, ADMIN_ID
        );

        expect(result.success).toBe(false);
        expect(BranchRepository.createBranch).not.toHaveBeenCalled();

    });

    it("allows a blank mode on create - falls back to the tenant default", async () => {

        BranchRepository.createBranch.mockResolvedValue({ BranchId: 1, BranchName: "Main" });

        const result = await BranchService.createBranch({ branchName: "Main" }, TENANT_ID, ADMIN_ID);

        expect(result.success).toBe(true);
        expect(BranchRepository.createBranch).toHaveBeenCalled();

    });

    it("rejects an invalid mode on update, without writing anything", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 1, TenantId: TENANT_ID, BranchName: "Main" });

        const result = await BranchService.updateBranch(
            1, { branchName: "Main", deliveryStaffingMode: "carrier_pigeon" }, TENANT_ID, ADMIN_ID
        );

        expect(result.success).toBe(false);
        expect(BranchRepository.updateBranch).not.toHaveBeenCalled();

    });

    it("accepts a valid mode on update", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 1, TenantId: TENANT_ID, BranchName: "Main" });
        BranchRepository.updateBranch.mockResolvedValue({ BranchId: 1, BranchName: "Main", DeliveryStaffingMode: "dedicated_riders" });

        const result = await BranchService.updateBranch(
            1, { branchName: "Main", deliveryStaffingMode: "dedicated_riders" }, TENANT_ID, ADMIN_ID
        );

        expect(result.success).toBe(true);
        expect(BranchRepository.updateBranch).toHaveBeenCalledWith(
            expect.objectContaining({ deliveryStaffingMode: "dedicated_riders" })
        );

    });

});
