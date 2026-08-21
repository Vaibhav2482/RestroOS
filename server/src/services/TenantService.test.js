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

describe("TenantService.updateDisabledFeatures", () => {

    it("sanitizes and saves the disabled feature list for a known tenant", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        TenantRepository.updateDisabledFeatures.mockResolvedValue({ ...activeTenant, DisabledFeatures: ["manage_branches"] });

        const result = await TenantService.updateDisabledFeatures(TENANT_ID, ["manage_branches", "manage_staff"]);

        expect(result.success).toBe(true);
        expect(TenantRepository.updateDisabledFeatures).toHaveBeenCalledWith(TENANT_ID, ["manage_branches"]);
        // Called with no actorPlatformAdminId - the tenant's own Owner path
        // (PUT /tenants/me/features) has no platform admin to attribute.
        expect(AuditService.record).not.toHaveBeenCalled();

    });

    it("records an audit entry when a platform admin makes the same change", async () => {

        TenantRepository.getById.mockResolvedValue(activeTenant);
        TenantRepository.updateDisabledFeatures.mockResolvedValue({ ...activeTenant, DisabledFeatures: ["manage_branches"] });

        await TenantService.updateDisabledFeatures(TENANT_ID, ["manage_branches"], PLATFORM_ADMIN_ID);

        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: TENANT_ID,
                actorPlatformAdminId: PLATFORM_ADMIN_ID,
                actorType: "PlatformAdmin",
                action: "TENANT_FEATURES_UPDATED"
            })
        );

    });

    // The reachable-by-arbitrary-id path (a platform admin typing/passing
    // any tenantId, not just "me") - this must not silently "succeed" with
    // undefined data the way it would without this check.
    it("returns a not-found failure for an unknown tenant, without writing anything", async () => {

        TenantRepository.getById.mockResolvedValue(undefined);

        const result = await TenantService.updateDisabledFeatures(999, ["manage_branches"]);

        expect(result.success).toBe(false);
        expect(TenantRepository.updateDisabledFeatures).not.toHaveBeenCalled();

    });

});
