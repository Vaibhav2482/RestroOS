import { describe, it, expect } from "vitest";
import { sanitizePermissions } from "./permissions.js";

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
