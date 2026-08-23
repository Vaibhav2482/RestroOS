import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/BranchRepository.js");

const BranchRepository = await import("../repositories/BranchRepository.js");
const { isBranchAdmin, resolveBranchId, branchMismatch, assertBranchBelongsToTenant } = await import("./branchScope.js");

beforeEach(() => {
    vi.clearAllMocks();
});

describe("isBranchAdmin", () => {

    it("is true only for an admin with a branchId on their token", () => {

        expect(isBranchAdmin({ user: { role: "admin", branchId: 5 } })).toBe(true);
        expect(isBranchAdmin({ user: { role: "admin", branchId: null } })).toBe(false); // Owner
        expect(isBranchAdmin({ user: { role: "customer", branchId: 5 } })).toBe(false);

    });

});

describe("resolveBranchId", () => {

    it("uses the token's own branchId for a Branch Admin, ignoring any query param", () => {

        const req = { user: { role: "admin", branchId: 5 }, query: { branchId: 99 } };

        expect(resolveBranchId(req)).toBe(5);

    });

    it("falls back to the query param for an unrestricted Owner", () => {

        const req = { user: { role: "admin", branchId: null }, query: { branchId: 99 } };

        expect(resolveBranchId(req)).toBe(99);

    });

});

describe("branchMismatch", () => {

    it("flags a mismatch only for a Branch Admin acting outside their own branch", () => {

        const branchAdmin = { user: { role: "admin", branchId: 5 } };

        expect(branchMismatch(branchAdmin, 99)).toBe(true);
        expect(branchMismatch(branchAdmin, 5)).toBe(false);

    });

    it("never flags a mismatch for an unrestricted Owner", () => {

        const owner = { user: { role: "admin", branchId: null } };

        expect(branchMismatch(owner, 99)).toBe(false);

    });

});

// Extracted from 5 services/controllers (Inventory, Menu, Table services;
// Order, TableVisit controllers) that each reimplemented this identically -
// a production-readiness audit flagged the duplication. Deliberately NOT
// used by AdminService's own same-named check, which treats a null
// branchId (an unrestricted Owner) as automatically valid - a genuinely
// different rule from this one, where branchId is always a concrete
// resource attribute, never legitimately null.
describe("assertBranchBelongsToTenant", () => {

    it("is true when the branch exists and belongs to the given tenant", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 5, TenantId: 9 });

        expect(await assertBranchBelongsToTenant(5, 9)).toBe(true);

    });

    it("is false when the branch belongs to a different tenant", async () => {

        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 5, TenantId: 99 });

        expect(await assertBranchBelongsToTenant(5, 9)).toBe(false);

    });

    it("is false when the branch does not exist at all", async () => {

        BranchRepository.getBranchById.mockResolvedValue(undefined);

        expect(await assertBranchBelongsToTenant(999, 9)).toBe(false);

    });

});
