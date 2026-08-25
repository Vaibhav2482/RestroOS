import { describe, it, expect } from "vitest";
import { hasPermission, isFeatureEnabled, isOwner } from "./adminAuth";

describe("isOwner", () => {

    it("treats an admin with no BranchId as an owner", () => {
        expect(isOwner({ BranchId: null })).toBe(true);
    });

    it("treats an admin with a BranchId as a branch admin", () => {
        expect(isOwner({ BranchId: 4 })).toBe(false);
    });

});

describe("hasPermission", () => {

    it("always returns true for an owner, regardless of their Permissions list", () => {
        expect(hasPermission({ BranchId: null, Permissions: [] }, "manage_ingredients")).toBe(true);
    });

    it("returns true for a branch admin who has the specific permission", () => {
        expect(hasPermission({ BranchId: 4, Permissions: ["manage_ingredients"] }, "manage_ingredients")).toBe(true);
    });

    it("returns false for a branch admin missing the specific permission", () => {
        expect(hasPermission({ BranchId: 4, Permissions: ["manage_coupons"] }, "manage_ingredients")).toBe(false);
    });

    it("returns false for a branch admin with no Permissions field at all", () => {
        expect(hasPermission({ BranchId: 4 }, "manage_ingredients")).toBe(false);
    });

    it("returns false when there's no admin at all", () => {
        expect(hasPermission(null, "manage_ingredients")).toBe(false);
    });

});

describe("isFeatureEnabled", () => {

    it("returns true when neither list mentions the key", () => {
        expect(isFeatureEnabled({ tenantDisabledFeatures: [], tenantPlatformRestrictedFeatures: [] }, "manage_delivery")).toBe(true);
    });

    it("returns false when the Owner's own toggle has disabled it", () => {
        expect(isFeatureEnabled({ tenantDisabledFeatures: ["manage_delivery"], tenantPlatformRestrictedFeatures: [] }, "manage_delivery")).toBe(false);
    });

    // The case this whole fix is about - a plan-tier restriction blocks
    // just as hard as the Owner's own toggle, even though it's a
    // completely separate list the Owner never writes to.
    it("returns false when the platform's plan restricts it, even with the Owner's own list empty", () => {
        expect(isFeatureEnabled({ tenantDisabledFeatures: [], tenantPlatformRestrictedFeatures: ["manage_delivery"] }, "manage_delivery")).toBe(false);
    });

    it("returns true when neither field is present at all (no admin, or an old cached session)", () => {
        expect(isFeatureEnabled({}, "manage_delivery")).toBe(true);
        expect(isFeatureEnabled(null, "manage_delivery")).toBe(true);
    });

});
