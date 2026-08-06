import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

import { authenticate, authorize, requireOwner, requirePermission } from "./Auth.js";
import pool from "../config/db.js";

vi.mock("../config/db.js", () => ({ default: { query: vi.fn() } }));

const JWT_SECRET = "test-secret";

const sign = (payload) => jwt.sign(payload, JWT_SECRET);

const buildRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

describe("authenticate", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_SECRET = JWT_SECRET;
    });

    it("rejects a request with no Authorization header", async () => {

        const req = { headers: {} };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();

    });

    it("rejects an invalid/expired token", async () => {

        const req = { headers: { authorization: "Bearer not-a-real-token" } };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();

    });

    it("allows a customer whose account is still active", async () => {

        const token = sign({ id: 5, role: "customer", tenantId: 1 });
        pool.query.mockResolvedValue({ rows: [{ IsActive: true }] });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toMatchObject({ id: 5, role: "customer" });

    });

    it("rejects a customer whose account has been deactivated, even with a still-valid token", async () => {

        const token = sign({ id: 5, role: "customer", tenantId: 1 });
        pool.query.mockResolvedValue({ rows: [{ IsActive: false }] });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);

    });

    it("allows an admin only when both the admin and their tenant are active", async () => {

        const token = sign({ id: 7, role: "admin", tenantId: 3, branchId: null });
        pool.query.mockResolvedValue({ rows: [{ AdminActive: true, TenantActive: true }] });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("Tenants"), [7]);

    });

    it("attaches the admin's Permissions from the DB, not the JWT", async () => {

        const token = sign({ id: 7, role: "admin", tenantId: 3, branchId: 4 });
        pool.query.mockResolvedValue({ rows: [{ AdminActive: true, TenantActive: true, Permissions: ["manage_ingredients"] }] });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.permissions).toEqual(["manage_ingredients"]);

    });

    it("rejects an admin whose tenant has been suspended, even though the admin's own account is still active", async () => {

        const token = sign({ id: 7, role: "admin", tenantId: 3, branchId: null });
        pool.query.mockResolvedValue({ rows: [{ AdminActive: true, TenantActive: false }] });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);

    });

    it("rejects a platform admin who no longer exists (no matching row)", async () => {

        const token = sign({ id: 99, role: "platform_admin" });
        pool.query.mockResolvedValue({ rows: [] });

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = buildRes();
        const next = vi.fn();

        await authenticate(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);

    });

});

describe("authorize", () => {

    it("blocks a role not in the allowed list", () => {

        const req = { user: { role: "customer" } };
        const res = buildRes();
        const next = vi.fn();

        authorize("admin", "platform_admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();

    });

    it("allows a role in the allowed list", () => {

        const req = { user: { role: "admin" } };
        const res = buildRes();
        const next = vi.fn();

        authorize("admin", "platform_admin")(req, res, next);

        expect(next).toHaveBeenCalled();

    });

});

describe("requireOwner", () => {

    it("blocks a branch-scoped admin", () => {

        const req = { user: { role: "admin", branchId: 4 } };
        const res = buildRes();
        const next = vi.fn();

        requireOwner(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();

    });

    it("allows an owner (no branchId)", () => {

        const req = { user: { role: "admin", branchId: null } };
        const res = buildRes();
        const next = vi.fn();

        requireOwner(req, res, next);

        expect(next).toHaveBeenCalled();

    });

});

describe("requirePermission", () => {

    it("always allows an owner (no branchId), regardless of their permissions list", () => {

        const req = { user: { role: "admin", branchId: null, permissions: [] } };
        const res = buildRes();
        const next = vi.fn();

        requirePermission("manage_ingredients")(req, res, next);

        expect(next).toHaveBeenCalled();

    });

    it("allows a branch admin who has been granted the specific permission", () => {

        const req = { user: { role: "admin", branchId: 4, permissions: ["manage_ingredients", "manage_coupons"] } };
        const res = buildRes();
        const next = vi.fn();

        requirePermission("manage_ingredients")(req, res, next);

        expect(next).toHaveBeenCalled();

    });

    it("blocks a branch admin who lacks the specific permission, even with other permissions granted", () => {

        const req = { user: { role: "admin", branchId: 4, permissions: ["manage_coupons"] } };
        const res = buildRes();
        const next = vi.fn();

        requirePermission("manage_ingredients")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();

    });

    it("blocks a branch admin with no permissions array at all", () => {

        const req = { user: { role: "admin", branchId: 4 } };
        const res = buildRes();
        const next = vi.fn();

        requirePermission("manage_ingredients")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();

    });

    it("blocks a non-admin role outright", () => {

        const req = { user: { role: "customer" } };
        const res = buildRes();
        const next = vi.fn();

        requirePermission("manage_ingredients")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();

    });

});
