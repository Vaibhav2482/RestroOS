import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

import * as TenantService from "./TenantService.js";
import * as TenantRepository from "../repositories/TenantRepository.js";
import * as AdminRepository from "../repositories/AdminRepository.js";
import * as NotificationService from "./NotificationService.js";
import * as AuditService from "./AuditService.js";

vi.mock("../repositories/TenantRepository.js");
vi.mock("../repositories/AdminRepository.js");
vi.mock("./NotificationService.js");
vi.mock("./AuditService.js");
vi.mock("bcrypt");

const TENANT_ID = 3;
const PLATFORM_ADMIN_ID = 1;

const activeTenant = {
    TenantId: TENANT_ID,
    TenantName: "Chai Point",
    Slug: "chai-point",
    OwnerEmail: "owner@example.com",
    IsActive: true
};

beforeEach(() => {

    vi.clearAllMocks();

    bcrypt.hash.mockResolvedValue("hashed-password");
    NotificationService.notifyOwnerCredentials.mockResolvedValue();
    AuditService.record.mockResolvedValue();

});

describe("TenantService.createTenant", () => {

    it("emails the new owner's credentials on success", async () => {

        TenantRepository.getBySlug.mockResolvedValue(null);
        TenantRepository.createWithOwnerAdmin.mockResolvedValue({
            tenant: { TenantId: TENANT_ID, TenantName: "Chai Point" },
            admin: { AdminId: 12, Email: "owner@example.com" }
        });

        const result = await TenantService.createTenant({
            tenantName: "Chai Point",
            ownerEmail: "owner@example.com"
        }, PLATFORM_ADMIN_ID);

        expect(result.success).toBe(true);
        expect(NotificationService.notifyOwnerCredentials).toHaveBeenCalledWith(
            expect.objectContaining({ email: "owner@example.com", isReset: false })
        );
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: TENANT_ID,
                actorPlatformAdminId: PLATFORM_ADMIN_ID,
                actorType: "PlatformAdmin",
                action: "TENANT_CREATED"
            })
        );

    });

    it("rejects a slug that's already taken without creating anything", async () => {

        TenantRepository.getBySlug.mockResolvedValue(activeTenant);

        const result = await TenantService.createTenant({
            tenantName: "Chai Point",
            ownerEmail: "owner@example.com"
        });

        expect(result.success).toBe(false);
        expect(TenantRepository.createWithOwnerAdmin).not.toHaveBeenCalled();
        expect(NotificationService.notifyOwnerCredentials).not.toHaveBeenCalled();

    });

});

describe("TenantService.resetOwnerPassword", () => {

    it("emails the reset credentials to the owner", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        AdminRepository.getByTenantAndEmailAny.mockResolvedValue({ AdminId: 12, Email: "owner@example.com" });

        const result = await TenantService.resetOwnerPassword(TENANT_ID, PLATFORM_ADMIN_ID);

        expect(result.success).toBe(true);
        expect(AdminRepository.resetPassword).toHaveBeenCalled();
        expect(AdminRepository.bumpTokenVersion).toHaveBeenCalledWith(12);
        expect(NotificationService.notifyOwnerCredentials).toHaveBeenCalledWith(
            expect.objectContaining({ email: "owner@example.com", isReset: true })
        );
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: TENANT_ID,
                actorPlatformAdminId: PLATFORM_ADMIN_ID,
                actorType: "PlatformAdmin",
                action: "TENANT_OWNER_PASSWORD_RESET"
            })
        );

    });

    it("fails when the tenant has no matching admin account", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        AdminRepository.getByTenantAndEmailAny.mockResolvedValue(undefined);

        const result = await TenantService.resetOwnerPassword(TENANT_ID);

        expect(result.success).toBe(false);
        expect(NotificationService.notifyOwnerCredentials).not.toHaveBeenCalled();

    });

});

describe("TenantService.suspendTenant / reactivateTenant", () => {

    it("suspends an active tenant", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        TenantRepository.setActive.mockResolvedValue({ ...activeTenant, IsActive: false });

        const result = await TenantService.suspendTenant(TENANT_ID, PLATFORM_ADMIN_ID);

        expect(result.success).toBe(true);
        expect(TenantRepository.setActive).toHaveBeenCalledWith(TENANT_ID, false);
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: TENANT_ID,
                actorPlatformAdminId: PLATFORM_ADMIN_ID,
                actorType: "PlatformAdmin",
                action: "TENANT_SUSPENDED"
            })
        );

    });

    it("refuses to suspend an already-suspended tenant", async () => {

        TenantRepository.getById.mockResolvedValue({ ...activeTenant, IsActive: false });

        const result = await TenantService.suspendTenant(TENANT_ID);

        expect(result.success).toBe(false);
        expect(TenantRepository.setActive).not.toHaveBeenCalled();

    });

    it("reactivates a suspended tenant", async () => {

        TenantRepository.getById.mockResolvedValue({ ...activeTenant, IsActive: false });
        TenantRepository.setActive.mockResolvedValue(activeTenant);

        const result = await TenantService.reactivateTenant(TENANT_ID, PLATFORM_ADMIN_ID);

        expect(result.success).toBe(true);
        expect(TenantRepository.setActive).toHaveBeenCalledWith(TENANT_ID, true);
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: TENANT_ID,
                actorPlatformAdminId: PLATFORM_ADMIN_ID,
                actorType: "PlatformAdmin",
                action: "TENANT_REACTIVATED"
            })
        );

    });

    it("refuses to reactivate an already-active tenant", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);

        const result = await TenantService.reactivateTenant(TENANT_ID);

        expect(result.success).toBe(false);
        expect(TenantRepository.setActive).not.toHaveBeenCalled();

    });

    it("returns a not-found failure for an unknown tenant", async () => {

        TenantRepository.getById.mockResolvedValue(undefined);

        const result = await TenantService.suspendTenant(999);

        expect(result.success).toBe(false);

    });

});

describe("TenantService.updateDeliveryStaffingMode", () => {

    it("saves a valid mode", async () => {

        TenantRepository.updateDeliveryStaffingMode.mockResolvedValue({
            TenantId: TENANT_ID, DeliveryStaffingMode: "dedicated_riders"
        });

        const result = await TenantService.updateDeliveryStaffingMode(TENANT_ID, "dedicated_riders");

        expect(result.success).toBe(true);
        expect(TenantRepository.updateDeliveryStaffingMode).toHaveBeenCalledWith(TENANT_ID, "dedicated_riders");

    });

    it("rejects anything other than the two known modes, without writing anything", async () => {

        const result = await TenantService.updateDeliveryStaffingMode(TENANT_ID, "carrier_pigeon");

        expect(result.success).toBe(false);
        expect(TenantRepository.updateDeliveryStaffingMode).not.toHaveBeenCalled();

    });

});

describe("TenantService.updateDisabledFeatures", () => {

    it("sanitizes and saves the disabled feature list for a known tenant", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        TenantRepository.updateDisabledFeatures.mockResolvedValue({ ...activeTenant, DisabledFeatures: ["manage_branches"] });

        const result = await TenantService.updateDisabledFeatures(TENANT_ID, ["manage_branches", "manage_staff"]);

        expect(result.success).toBe(true);
        expect(TenantRepository.updateDisabledFeatures).toHaveBeenCalledWith(TENANT_ID, ["manage_branches"]);
        // Called with no actorAdminId - nothing attributes the change, so
        // nothing should be audited.
        expect(AuditService.record).not.toHaveBeenCalled();

    });

    it("records an audit entry attributed to the Owner, not a platform admin", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        TenantRepository.updateDisabledFeatures.mockResolvedValue({ ...activeTenant, DisabledFeatures: ["manage_branches"] });

        const OWNER_ADMIN_ID = 42;

        await TenantService.updateDisabledFeatures(TENANT_ID, ["manage_branches"], OWNER_ADMIN_ID);

        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: TENANT_ID,
                actorAdminId: OWNER_ADMIN_ID,
                action: "TENANT_FEATURES_UPDATED"
            })
        );
        // No actorType override - this isn't a platform admin action, it
        // should use AuditRepository's own default ("User"), the same
        // convention every other admin-attributed audit call in this
        // codebase (e.g. BranchService.createBranch) already relies on.
        expect(AuditService.record).toHaveBeenCalledWith(
            expect.not.objectContaining({ actorType: expect.anything() })
        );

    });

    // The whole point of this fix - a platform-restricted key must survive
    // even if the Owner's own submission tries to "enable" it (i.e. leaves
    // it out of the disabled list they send).
    it("force-keeps a platform-restricted feature disabled even if the Owner's submission tries to enable it", async () => {

        TenantRepository.getById.mockResolvedValue({ ...activeTenant, PlatformRestrictedFeatures: ["manage_delivery"] });
        TenantRepository.updateDisabledFeatures.mockResolvedValue({ ...activeTenant });

        // Owner submits a list that does NOT include manage_delivery -
        // i.e. tries to turn it back on.
        await TenantService.updateDisabledFeatures(TENANT_ID, ["manage_branches"]);

        const [, savedDisabledFeatures] = TenantRepository.updateDisabledFeatures.mock.calls[0];
        expect(savedDisabledFeatures).toEqual(expect.arrayContaining(["manage_branches", "manage_delivery"]));

    });

    it("doesn't duplicate a key the Owner also happened to submit that's already platform-restricted", async () => {

        TenantRepository.getById.mockResolvedValue({ ...activeTenant, PlatformRestrictedFeatures: ["manage_delivery"] });
        TenantRepository.updateDisabledFeatures.mockResolvedValue({ ...activeTenant });

        await TenantService.updateDisabledFeatures(TENANT_ID, ["manage_delivery", "manage_branches"]);

        const [, savedDisabledFeatures] = TenantRepository.updateDisabledFeatures.mock.calls[0];
        expect(savedDisabledFeatures.filter((key) => key === "manage_delivery")).toHaveLength(1);

    });

    it("returns a not-found failure for an unknown tenant, without writing anything", async () => {

        TenantRepository.getById.mockResolvedValue(undefined);

        const result = await TenantService.updateDisabledFeatures(999, ["manage_branches"]);

        expect(result.success).toBe(false);
        expect(TenantRepository.updateDisabledFeatures).not.toHaveBeenCalled();

    });

});

describe("TenantService.updatePlatformRestrictedFeatures", () => {

    it("sanitizes and saves the plan-tier restriction list", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        TenantRepository.updatePlatformRestrictedFeatures.mockResolvedValue({ ...activeTenant, PlatformRestrictedFeatures: ["manage_delivery"] });

        const result = await TenantService.updatePlatformRestrictedFeatures(TENANT_ID, ["manage_delivery", "manage_staff"]);

        expect(result.success).toBe(true);
        expect(TenantRepository.updatePlatformRestrictedFeatures).toHaveBeenCalledWith(TENANT_ID, ["manage_delivery"]);
        expect(AuditService.record).not.toHaveBeenCalled();

    });

    it("records an audit entry, attributed to the platform admin, under a distinct action from the Owner's own path", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        TenantRepository.updatePlatformRestrictedFeatures.mockResolvedValue({ ...activeTenant, PlatformRestrictedFeatures: ["manage_delivery"] });

        await TenantService.updatePlatformRestrictedFeatures(TENANT_ID, ["manage_delivery"], PLATFORM_ADMIN_ID);

        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: TENANT_ID,
                actorPlatformAdminId: PLATFORM_ADMIN_ID,
                actorType: "PlatformAdmin",
                action: "TENANT_PLATFORM_RESTRICTIONS_UPDATED"
            })
        );

    });

    it("returns a not-found failure for an unknown tenant, without writing anything", async () => {

        TenantRepository.getById.mockResolvedValue(undefined);

        const result = await TenantService.updatePlatformRestrictedFeatures(999, ["manage_delivery"]);

        expect(result.success).toBe(false);
        expect(TenantRepository.updatePlatformRestrictedFeatures).not.toHaveBeenCalled();

    });

});
