import pool from "../config/db.js";

// Insert-only, like the Inventory ledger - an audit trail that could be
// edited or deleted after the fact isn't an audit trail. No update/delete
// export exists here on purpose.
export const record = async (entry) => {

    const result = await pool.query(
        `INSERT INTO "AuditLogs"
            ("TenantId", "ActorAdminId", "ActorPlatformAdminId", "ActorType", "Action", "EntityType", "EntityId", "Summary", "Metadata")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            entry.tenantId,
            entry.actorAdminId ?? null,
            entry.actorPlatformAdminId ?? null,
            entry.actorType ?? "User",
            entry.action,
            entry.entityType,
            entry.entityId ?? null,
            entry.summary,
            entry.metadata ? JSON.stringify(entry.metadata) : null
        ]
    );

    return result.rows[0];

};

export const getByTenant = async (tenantId, filters = {}) => {

    const conditions = [`L."TenantId" = $1`];
    const params = [tenantId];

    if (filters.entityType) {
        params.push(filters.entityType);
        conditions.push(`L."EntityType" = $${params.length}`);
    }

    if (filters.actorAdminId) {
        params.push(filters.actorAdminId);
        conditions.push(`L."ActorAdminId" = $${params.length}`);
    }

    if (filters.from) {
        params.push(filters.from);
        conditions.push(`L."CreatedAt" >= $${params.length}`);
    }

    if (filters.to) {
        params.push(filters.to);
        conditions.push(`L."CreatedAt" < $${params.length}`);
    }

    const result = await pool.query(
        `SELECT L.*, COALESCE(A."FullName", P."FullName") AS "ActorName"
         FROM "AuditLogs" L
         LEFT JOIN "Admins" A ON A."AdminId" = L."ActorAdminId"
         LEFT JOIN "PlatformAdmins" P ON P."PlatformAdminId" = L."ActorPlatformAdminId"
         WHERE ${conditions.join(" AND ")}
         ORDER BY L."CreatedAt" DESC
         LIMIT 200`,
        params
    );

    return result.rows;

};
