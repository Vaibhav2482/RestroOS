import * as BranchRepository from "../repositories/BranchRepository.js";

// A Branch Admin (admin with a BranchId on their token) is always confined to
// their own branch, regardless of what a client request asks for. A Tenant
// Owner (admin with no BranchId) is unrestricted across their own tenant's
// branches, but never sees another tenant's data - every query in this
// codebase must filter by req.user.tenantId in addition to this.

export const isBranchAdmin = (req) =>
    Boolean(req.user?.role === "admin" && req.user.branchId);

export const resolveBranchId = (req) =>
    isBranchAdmin(req) ? req.user.branchId : req.query.branchId;

export const branchMismatch = (req, recordBranchId) =>
    isBranchAdmin(req) && String(req.user.branchId) !== String(recordBranchId);

// A resource's real tenant boundary is its own Branch's TenantId - used
// wherever a request supplies a branchId directly (rather than deriving it
// from an already-tenant-checked resource) and that branchId needs
// confirming as actually belonging to the caller's tenant before it's
// trusted for a query. Was reimplemented identically in 6 separate
// services/controllers; consolidated here per a production-readiness
// audit's recommendation. Not for AdminService's own "does this target
// admin's assigned branch belong to the tenant" check - that one treats a
// null branchId (a Tenant Owner, unrestricted across branches) as
// automatically valid, a genuinely different rule from this one, where
// branchId is always a concrete resource attribute, never legitimately null.
export const assertBranchBelongsToTenant = async (branchId, tenantId) => {

    const branch = await BranchRepository.getBranchById(branchId);

    return Boolean(branch && branch.TenantId === tenantId);

};
