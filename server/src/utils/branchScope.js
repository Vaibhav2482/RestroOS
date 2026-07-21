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
