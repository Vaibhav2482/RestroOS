import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../config/db.js", () => ({ default: { query: (...args) => queryMock(...args), connect: vi.fn() } }));

const CustomerRepository = await import("./CustomerRepository.js");
const AdminRepository = await import("./AdminRepository.js");
const PlatformAdminRepository = await import("./PlatformAdminRepository.js");

beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
});

// Nothing anywhere lowercases an email before storing it, so an exact "="
// match let "Jane@Gmail.com" and "jane@gmail.com" collide-check as two
// different addresses - a duplicate-registration check that silently let a
// second account through, and a login that could fail with a misleading
// "Invalid Email or Password" for a real account typed with different
// capitalization than it was registered with. Fixed with LOWER(...) on
// both sides rather than ILIKE (the fix already used for coupon codes/menu
// names elsewhere), since ILIKE treats `_` and `%` as wildcards - both
// ordinary, valid characters in an email's local part.
describe("Email lookups are case-insensitive, not exact-match", () => {

    it("CustomerRepository.getCustomerByTenantAndEmail compares with LOWER(), not =", async () => {

        await CustomerRepository.getCustomerByTenantAndEmail(1, "Jane@Gmail.com");

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LOWER\("Email"\) = LOWER\(\$2\)/);
        expect(sql).not.toMatch(/"Email" = \$2/);
        expect(params).toEqual([1, "Jane@Gmail.com"]);

    });

    it("CustomerRepository.customerLogin compares with LOWER(), not =", async () => {

        await CustomerRepository.customerLogin(1, "Jane@Gmail.com");

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LOWER\("Email"\) = LOWER\(\$2\)/);
        expect(sql).not.toMatch(/"Email" = \$2/);

    });

    it("AdminRepository.getByTenantAndEmail compares with LOWER(), not =", async () => {

        await AdminRepository.getByTenantAndEmail(1, "Owner@Restaurant.com");

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LOWER\("Email"\) = LOWER\(\$2\)/);
        expect(sql).not.toMatch(/"Email" = \$2/);

    });

    it("AdminRepository.getByTenantAndEmailAny compares with LOWER(), not =", async () => {

        await AdminRepository.getByTenantAndEmailAny(1, "Owner@Restaurant.com");

        const [sql] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LOWER\("Email"\) = LOWER\(\$2\)/);
        expect(sql).not.toMatch(/"Email" = \$2/);

    });

    it("PlatformAdminRepository.getByEmail compares with LOWER(), not =", async () => {

        await PlatformAdminRepository.getByEmail("Admin@RestroOS.com");

        const [sql, params] = queryMock.mock.calls[0];

        expect(sql).toMatch(/LOWER\("Email"\) = LOWER\(\$1\)/);
        expect(sql).not.toMatch(/"Email" = \$1/);
        expect(params).toEqual(["Admin@RestroOS.com"]);

    });

});
