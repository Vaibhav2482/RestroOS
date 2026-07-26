import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import pool from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/src/config -> up to the repo root, then into database/migrations.
const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "..", "database", "migrations");

// There's no other path to production DDL in this deployment (no shell
// access to the database, no separate migration step in the deploy
// pipeline) - this runs once per cold start, guarded by `applied` so it's
// a cheap no-op on every request after the first. Each file runs in its
// own transaction and is recorded in MigrationsApplied only on success, so
// a failed migration can be fixed and re-deployed without needing to hand-
// edit any tracking state.
let applied = false;

export const runMigrations = async () => {

    if (applied) {
        return;
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS "MigrationsApplied" (
            "MigrationId" VARCHAR(255) NOT NULL,
            "AppliedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
            PRIMARY KEY ("MigrationId")
        )
    `);

    const appliedResult = await pool.query(`SELECT "MigrationId" FROM "MigrationsApplied"`);
    const appliedSet = new Set(appliedResult.rows.map((row) => row.MigrationId));

    const files = readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".sql"))
        .sort();

    for (const file of files) {

        if (appliedSet.has(file)) {
            continue;
        }

        const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        const client = await pool.connect();

        try {

            await client.query("BEGIN");
            await client.query(sql);
            await client.query(`INSERT INTO "MigrationsApplied" ("MigrationId") VALUES ($1)`, [file]);
            await client.query("COMMIT");

        } catch (error) {

            await client.query("ROLLBACK");
            throw new Error(`Migration ${file} failed: ${error.message}`);

        } finally {

            client.release();

        }

    }

    applied = true;

};
