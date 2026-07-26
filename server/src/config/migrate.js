import pool from "./db.js";
import { MIGRATIONS } from "./migrations.js";

// Arbitrary fixed key for a Postgres advisory lock - just needs to be a
// consistent number every instance of this app agrees on. Serializes
// concurrent cold starts against each other: without this, two instances
// warming up at once could both pass "table doesn't exist yet" before
// either commits its CREATE TABLE, which is exactly what caused a real
// production outage (pg_type catalog conflict) the first time this ran.
const MIGRATION_LOCK_KEY = 918273645;

let applied = false;

export const runMigrations = async () => {

    if (applied) {
        return;
    }

    const client = await pool.connect();

    try {

        await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);

        await client.query(`
            CREATE TABLE IF NOT EXISTS "MigrationsApplied" (
                "MigrationId" VARCHAR(255) NOT NULL,
                "AppliedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY ("MigrationId")
            )
        `);

        const appliedResult = await client.query(`SELECT "MigrationId" FROM "MigrationsApplied"`);
        const appliedSet = new Set(appliedResult.rows.map((row) => row.MigrationId));

        for (const migration of MIGRATIONS) {

            if (appliedSet.has(migration.id)) {
                continue;
            }

            try {

                await client.query("BEGIN");
                await client.query(migration.sql);
                await client.query(`INSERT INTO "MigrationsApplied" ("MigrationId") VALUES ($1)`, [migration.id]);
                await client.query("COMMIT");

            } catch (error) {

                await client.query("ROLLBACK");
                throw new Error(`Migration ${migration.id} failed: ${error.message}`);

            }

        }

        applied = true;

    } finally {

        await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
        client.release();

    }

};
