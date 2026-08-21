import pool from "../config/db.js";

export const createCustomerAddress = async (address) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const customerCheck = await client.query(
            `SELECT 1 FROM "Customers" WHERE "CustomerId" = $1 AND "IsActive" = TRUE`,
            [address.customerId]
        );

        if (customerCheck.rows.length === 0) {
            throw new Error("Customer not found.");
        }

        if (address.isDefault) {
            await client.query(
                `UPDATE "CustomerAddresses" SET "IsDefault" = FALSE WHERE "CustomerId" = $1`,
                [address.customerId]
            );
        }

        const inserted = await client.query(
            `INSERT INTO "CustomerAddresses"
                ("CustomerId", "AddressTitle", "FullAddress", "City", "State", "Pincode", "Landmark", "IsDefault")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                address.customerId,
                address.addressTitle,
                address.fullAddress,
                address.city,
                address.state,
                address.pincode,
                address.landmark ?? null,
                address.isDefault ?? false
            ]
        );

        await client.query("COMMIT");

        return inserted.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

export const getCustomerAddresses = async (customerId) => {

    const result = await pool.query(
        `SELECT "AddressId", "CustomerId", "AddressTitle", "FullAddress", "City", "State", "Pincode", "Landmark", "IsDefault", "CreatedAt"
         FROM "CustomerAddresses"
         WHERE "CustomerId" = $1
         ORDER BY "IsDefault" DESC, "AddressId" DESC`,
        [customerId]
    );

    return result.rows;

};

export const getCustomerAddressById = async (addressId) => {

    const result = await pool.query(
        `SELECT * FROM "CustomerAddresses" WHERE "AddressId" = $1`,
        [addressId]
    );

    return result.rows[0];

};

// tenantId redundant with the controller-level canActOnCustomer check that
// already ran - defense-in-depth so a repository write fails closed on its
// own WHERE clause rather than relying solely on every call site checking
// first. CustomerAddresses has no TenantId column of its own (tenancy is
// implied through CustomerId), so this is a subquery rather than a direct
// column compare.
export const updateCustomerAddress = async (address, tenantId) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const existing = await client.query(
            `SELECT CA."CustomerId" FROM "CustomerAddresses" CA
             INNER JOIN "Customers" C ON CA."CustomerId" = C."CustomerId"
             WHERE CA."AddressId" = $1 AND C."TenantId" = $2`,
            [address.addressId, tenantId]
        );

        const customerId = existing.rows[0]?.CustomerId;

        if (!customerId) {
            await client.query("ROLLBACK");
            return undefined;
        }

        if (address.isDefault) {
            await client.query(
                `UPDATE "CustomerAddresses" SET "IsDefault" = FALSE WHERE "CustomerId" = $1 AND "AddressId" <> $2`,
                [customerId, address.addressId]
            );
        }

        const updated = await client.query(
            `UPDATE "CustomerAddresses"
             SET "AddressTitle" = $1, "FullAddress" = $2, "City" = $3, "State" = $4, "Pincode" = $5, "Landmark" = $6, "IsDefault" = $7
             WHERE "AddressId" = $8
             RETURNING "AddressId", "CustomerId", "AddressTitle", "FullAddress", "City", "State", "Pincode", "Landmark", "IsDefault", "CreatedAt"`,
            [
                address.addressTitle,
                address.fullAddress,
                address.city,
                address.state,
                address.pincode,
                address.landmark ?? null,
                address.isDefault ?? false,
                address.addressId
            ]
        );

        await client.query("COMMIT");

        return updated.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");
        throw error;

    } finally {

        client.release();

    }

};

export const deleteCustomerAddress = async (addressId, tenantId) => {

    await pool.query(
        `DELETE FROM "CustomerAddresses"
         WHERE "AddressId" = $1
           AND "CustomerId" IN (SELECT "CustomerId" FROM "Customers" WHERE "TenantId" = $2)`,
        [addressId, tenantId]
    );

};
