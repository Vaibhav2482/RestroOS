import * as AuditRepository from "../repositories/AuditRepository.js";

// Every write path this session (Admins, Coupons, Branches, MenuItems,
// staff order cancellations) calls this after its own mutation succeeds -
// deliberately a plain follow-up write, not wrapped in the same
// transaction as the mutation it's auditing. Every one of those mutations
// is already a single-statement UPDATE/INSERT/DELETE via the shared pool,
// not a multi-statement transaction of its own, so there's no existing
// transaction to join without a larger refactor of each of those services.
// The tradeoff: in the rare case where the process dies between the
// mutation committing and this write running, that one action goes
// unrecorded. Failure here is caught and logged, never allowed to fail
// the action it's auditing - a broken audit write must not block a real
// admin action, the same reasoning NotificationService uses for
// order notifications.
export const record = async (entry) => {

    try {

        await AuditRepository.record(entry);

    } catch (error) {

        console.error(`Audit log write failed for action "${entry.action}": ${error.message}`);

    }

};

export const getLogs = async (tenantId, filters) => {

    const logs = await AuditRepository.getByTenant(tenantId, filters);

    return { success: true, message: "Audit logs fetched successfully.", data: logs };

};
