import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool, types } = pg;

// NUMERIC/DECIMAL and BIGINT need explicit parsing to plain numbers -
// node-postgres returns both as strings by default. See ChaiChakhna's
// db.js for the fuller reasoning; same fix applies here.
types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));
types.setTypeParser(20, (value) => (value === null ? null : parseInt(value, 10)));

// `max` matters more here than in a long-running server: on Vercel every
// concurrent serverless invocation can be its own process, each opening its
// own pool, and `pg`'s default (10) per pool multiplies out fast against
// Neon's connection cap. A small per-instance cap plus Neon's pooled
// (PgBouncer) endpoint - already what DATABASE_URL points at in production -
// is the standard fix for serverless-Postgres connection exhaustion.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000
});

export const connectDB = async () => {

    try {

        const client = await pool.connect();
        client.release();
        console.log("✅ PostgreSQL Connected Successfully");

    } catch (error) {

        console.error("❌ Database Connection Failed");
        console.error(error.message);
        process.exit(1);

    }

};

export default pool;
