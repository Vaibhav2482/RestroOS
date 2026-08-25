import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { errorResponse } from "../utils/ApiResponse.js";

// Table/PK for each JWT role, so a token can be re-checked against current
// DB state on every request - a JWT's claims are only a snapshot from login
// time and would otherwise keep granting access for the token's full
// lifetime even after the account is deactivated.
// "admin" isn't listed here - it needs a Tenants join (see isStillActive)
// rather than a plain table/PK lookup, since suspending a tenant must also
// cut off its already-logged-in staff.
const ACTIVE_CHECK_BY_ROLE = {
    customer: { table: "Customers", idColumn: "CustomerId" },
    platform_admin: { table: "PlatformAdmins", idColumn: "PlatformAdminId" },
};

const isStillActive = async (user) => {

    const lookup = ACTIVE_CHECK_BY_ROLE[user?.role];

    if (!lookup) {
        return false;
    }

    const result = await pool.query(
        `SELECT "IsActive" FROM "${lookup.table}" WHERE "${lookup.idColumn}" = $1`,
        [user.id]
    );

    return result.rows[0]?.IsActive === true;

};

// Admin also needs their tenant to still be active - a platform admin
// suspending a tenant (Tenants.IsActive = FALSE) blocks new tenant-admin
// logins already (AdminAuthService.login checks this), but without this
// join here, staff already holding a valid JWT would keep working against
// a suspended tenant for the rest of that token's lifetime.
//
// Permissions are read fresh here too, unlike branchId (a JWT claim from
// login) - a revoked permission should take effect immediately, not after
// JWT_EXPIRES_IN. Same for the tenant's own DisabledFeatures - already
// joining Tenants for TenantActive, so this is free.
const loadAdminState = async (adminId) => {

    const result = await pool.query(
        `SELECT A."IsActive" AS "AdminActive", T."IsActive" AS "TenantActive", A."Permissions", T."DisabledFeatures", T."PlatformRestrictedFeatures", A."TokenVersion"
         FROM "Admins" A INNER JOIN "Tenants" T ON A."TenantId" = T."TenantId"
         WHERE A."AdminId" = $1`,
        [adminId]
    );

    return result.rows[0];

};

// JWT payload shape across the platform: { id, role, tenantId }.
// role: "platform_admin" (no tenantId - manages all tenants) | "admin"
// (tenant-scoped restaurant staff, added in a later phase) | "customer".
export const authenticate = async (req, res, next) => {

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return errorResponse(res, "Authentication token is required.", 401);
    }

    const token = header.slice("Bearer ".length);

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);

        if (user.role === "admin") {

            const state = await loadAdminState(user.id);

            if (!(state?.AdminActive === true && state?.TenantActive === true)) {
                return errorResponse(res, "This account is no longer active.", 401);
            }

            // Only enforced when the token actually carries a version claim -
            // tokens minted before this check existed have no tokenVersion at
            // all and are let through unaffected until they next expire,
            // rather than force-logging out every already-logged-in admin
            // the moment this ships. Every token minted from here on always
            // carries one, so the check is fully live for anything new.
            if (typeof user.tokenVersion === "number" && user.tokenVersion !== state.TokenVersion) {
                return errorResponse(res, "This session has been signed out. Please log in again.", 401);
            }

            user.permissions = state.Permissions || [];
            user.disabledFeatures = state.DisabledFeatures || [];
            user.platformRestrictedFeatures = state.PlatformRestrictedFeatures || [];

        } else if (!(await isStillActive(user))) {
            return errorResponse(res, "This account is no longer active.", 401);
        }

        req.user = user;
        return next();
    } catch (error) {
        return errorResponse(res, "Invalid or expired token.", 401);
    }

};

// For routes public to guests (e.g. category/menu browsing) that still need
// to recognize an admin's token when present, so tenant/branch scoping can
// apply. Never rejects the request - a missing or invalid token just leaves
// req.user unset.
export const authenticateOptional = (req, res, next) => {

    const header = req.headers.authorization;

    if (header && header.startsWith("Bearer ")) {

        const token = header.slice("Bearer ".length);

        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            // Ignore invalid/expired token - treat as an unauthenticated request.
        }

    }

    return next();

};

export const authorize = (...roles) => (req, res, next) => {

    if (!req.user || !roles.includes(req.user.role)) {
        return errorResponse(res, "You are not authorized to perform this action.", 403);
    }

    return next();

};

// Owners are tenant admins with no BranchId (unrestricted across their own
// tenant's branches). Branch Admins are locked to one branch and cannot
// manage branches, staff, or other tenant-wide settings.
export const requireOwner = (req, res, next) => {

    if (!req.user || req.user.role !== "admin" || req.user.branchId) {
        return errorResponse(res, "Only an owner can perform this action.", 403);
    }

    return next();

};

// A tenant-wide kill switch (config/permissions.js TENANT_FEATURES) an
// Owner sets for their own restaurant - blocks EVERYONE in that tenant,
// Owner included, which is the whole point of it (unlike requirePermission/
// requireOwner below, which only ever narrow a Branch Admin, never an
// Owner). Standalone export for routes with no per-admin permission layer
// at all (e.g. BranchRoutes, gated by requireOwner not requirePermission);
// requirePermission also checks this same thing internally.
// The "feature_disabled" code (in `errors`, not the human message) is what
// lets a client tell this apart from an ordinary "you don't have
// permission" 403 - the two need different handling client-side. This one
// specifically means the tenant's own access changed since this admin
// logged in (a platform admin toggled it, or the Owner did), not that the
// admin themself lacks a grant - see requirePermission below for that case,
// and tenant-admin's axiosClient.js for what actually reacts to the code.
export const requireFeatureEnabled = (key) => (req, res, next) => {

    if (req.user?.role === "admin" && req.user.platformRestrictedFeatures?.includes(key)) {
        return errorResponse(res, "This feature isn't included in your restaurant's plan.", 403, { code: "feature_disabled" });
    }

    if (req.user?.role === "admin" && req.user.disabledFeatures?.includes(key)) {
        return errorResponse(res, "This feature isn't enabled for your restaurant.", 403, { code: "feature_disabled" });
    }

    return next();

};

// Like requireOwner, but delegable per key to a Branch Admin (see
// config/permissions.js for what's delegable). An Owner always passes -
// unless the tenant itself has this key disabled, checked first, since
// that's meant to block the Owner too. Two separate reasons a key can be
// off - checked in order so the more specific "not on your plan" message
// wins over the generic "not enabled" one when both happen to be true:
// platformRestrictedFeatures (a plan-tier restriction only a platform admin
// sets - the Owner can never override this, see TenantService.
// updateDisabledFeatures's force-merge) and disabledFeatures (the Owner's
// own self-service toggle, freely reversible by them).
export const requirePermission = (key) => (req, res, next) => {

    if (!req.user || req.user.role !== "admin") {
        return errorResponse(res, "You are not authorized to perform this action.", 403);
    }

    if (req.user.platformRestrictedFeatures?.includes(key)) {
        return errorResponse(res, "This feature isn't included in your restaurant's plan.", 403, { code: "feature_disabled" });
    }

    if (req.user.disabledFeatures?.includes(key)) {
        return errorResponse(res, "This feature isn't enabled for your restaurant.", 403, { code: "feature_disabled" });
    }

    if (!req.user.branchId) {
        return next();
    }

    if (!req.user.permissions?.includes(key)) {
        return errorResponse(res, "You don't have permission to perform this action.", 403);
    }

    return next();

};
