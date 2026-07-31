import bcrypt from "bcrypt";
import * as PlatformAdminRepository from "../repositories/PlatformAdminRepository.js";
import { MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } from "../config/lockoutPolicy.js";

export const login = async (email, password) => {

    if (!email || !password) {
        return { success: false, message: "Email and password are required." };
    }

    const admin = await PlatformAdminRepository.getByEmail(email);

    if (!admin) {
        return { success: false, message: "Invalid email or password." };
    }

    // Checked before the password compare, not after - a locked account
    // shouldn't leak whether the attempted password was actually correct.
    if (admin.LockedUntil && new Date(admin.LockedUntil) > new Date()) {
        return { success: false, message: "Too many failed attempts. Try again in a few minutes." };
    }

    const passwordMatches = await bcrypt.compare(password, admin.Password);

    if (!passwordMatches) {

        const nextAttempts = admin.FailedLoginAttempts + 1;
        const lockedUntil = nextAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null;

        await PlatformAdminRepository.recordFailedLogin(admin.PlatformAdminId, lockedUntil);

        return {
            success: false,
            message: lockedUntil
                ? `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`
                : "Invalid email or password."
        };

    }

    await PlatformAdminRepository.resetFailedLogins(admin.PlatformAdminId);

    delete admin.Password;
    delete admin.FailedLoginAttempts;
    delete admin.LockedUntil;

    return { success: true, message: "Login successful.", data: admin };

};

// Deliberately not a public "register" endpoint - that would let anyone on
// the internet create a platform-admin account. This only works while zero
// platform admins exist yet, i.e. once for the very first account; every
// admin created after that must come from an already-authenticated one
// (not built yet - Phase 1 only needs the one bootstrap account: you).
export const bootstrapFirstAdmin = async ({ fullName, email, password }) => {

    if (!fullName || !email || !password) {
        return { success: false, message: "Full name, email, and password are required." };
    }

    const existingCount = await PlatformAdminRepository.count();

    if (existingCount > 0) {
        return { success: false, message: "A platform admin already exists. Bootstrap is only available once." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const created = await PlatformAdminRepository.create({ fullName, email, password: hashedPassword });

    return { success: true, message: "Platform admin account created.", data: created };

};
