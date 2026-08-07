import { describe, it, expect } from "vitest";
import { CORE_PERMISSION_KEYS, GRANTABLE_PERMISSIONS, TENANT_FEATURES, sanitizeDisabledFeatures, sanitizePermissions } from "./permissions.js";

describe("GRANTABLE_PERMISSIONS / CORE_PERMISSION_KEYS", () => {

    it("never includes staff or branch management - granting either would let a Branch Admin escalate to Owner or restructure the tenant", () => {

        const keys = GRANTABLE_PERMISSIONS.map((permission) => permission.key);
        expect(keys).not.toContain("manage_staff");
        expect(keys).not.toContain("manage_branches");

    });

    it("every key has a non-empty label and group", () => {

        GRANTABLE_PERMISSIONS.forEach((permission) => {
            expect(permission.key).toBeTruthy();
            expect(permission.label).toBeTruthy();
            expect(permission.group).toBeTruthy();
        });

    });

    it("CORE_PERMISSION_KEYS is exactly the keys marked core: true", () => {

        const expected = GRANTABLE_PERMISSIONS.filter((permission) => permission.core).map((permission) => permission.key);
        expect(CORE_PERMISSION_KEYS).toEqual(expected);
        expect(CORE_PERMISSION_KEYS.length).toBeGreaterThan(0);

    });

});

describe("sanitizePermissions", () => {

    it("keeps only known, grantable keys", () => {

        expect(sanitizePermissions(["manage_ingredients", "manage_coupons"]))
            .toEqual(["manage_ingredients", "manage_coupons"]);

    });

    it("drops any key not in the grantable list - e.g. a tampered request trying to smuggle manage_staff", () => {

        expect(sanitizePermissions(["manage_ingredients", "manage_staff", "drop table admins;"]))
            .toEqual(["manage_ingredients"]);

    });

    it("de-duplicates repeated keys", () => {

        expect(sanitizePermissions(["manage_coupons", "manage_coupons"])).toEqual(["manage_coupons"]);

    });

    it("returns an empty array for non-array input", () => {

        expect(sanitizePermissions(undefined)).toEqual([]);
        expect(sanitizePermissions(null)).toEqual([]);
        expect(sanitizePermissions("manage_coupons")).toEqual([]);

    });

});

describe("TENANT_FEATURES", () => {

    it("includes every GRANTABLE_PERMISSIONS key plus manage_branches", () => {

        const keys = TENANT_FEATURES.map((feature) => feature.key);
        GRANTABLE_PERMISSIONS.forEach((permission) => expect(keys).toContain(permission.key));
        expect(keys).toContain("manage_branches");
        expect(keys).not.toContain("manage_staff");

    });

});

describe("sanitizeDisabledFeatures", () => {

    it("keeps manage_branches (a tenant-only key, not staff-grantable) unlike sanitizePermissions", () => {

        expect(sanitizeDisabledFeatures(["manage_branches", "manage_ingredients"]))
            .toEqual(["manage_branches", "manage_ingredients"]);

    });

    it("drops unknown keys and de-duplicates, same as sanitizePermissions", () => {

        expect(sanitizeDisabledFeatures(["manage_branches", "manage_branches", "manage_staff"]))
            .toEqual(["manage_branches"]);

    });

    it("returns an empty array for non-array input", () => {

        expect(sanitizeDisabledFeatures(undefined)).toEqual([]);

    });

});
