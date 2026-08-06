import { describe, it, expect } from "vitest";
import { hasPermission, isOwner } from "./adminAuth";

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
