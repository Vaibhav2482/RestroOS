import bcrypt from "bcrypt";
import * as PlatformAdminRepository from "../repositories/PlatformAdminRepository.js";

export const login = async (email, password) => {

    if (!email || !password) {
        return { success: false, message: "Email and password are required." };
    }

    const admin = await PlatformAdminRepository.getByEmail(email);

    if (!admin) {
        return { success: false, message: "Invalid email or password." };
    }

    const passwordMatches = await bcrypt.compare(password, admin.Password);

    if (!passwordMatches) {

        // Failed attempts are still counted, but nothing acts on the count -
        // passing null leaves LockedUntil untouched, so the tally is now
        // purely informational.
        await PlatformAdminRepository.recordFailedLogin(admin.PlatformAdminId, null);

        return { success: false, message: "Invalid email or password." };

    }

    await PlatformAdminRepository.resetFailedLogins(admin.PlatformAdminId);

    delete admin.Password;
    delete admin.FailedLoginAttempts;
    delete admin.LockedUntil;

    return { success: true, message: "Login successful.", data: admin };

};

// Same floor AdminService.changeOwnPassword holds tenant admins to - this
// account is more privileged than any of them (cross-tenant access to the
// whole platform), so it gets at least the same minimum, not less.
const MIN_PASSWORD_LENGTH = 8;

// Deliberately not a public "register" endpoint - that would let anyone on
// the internet create a platform-admin account. This only works while zero
// platform admins exist yet, i.e. once for the very first account; every
// admin created after that must come from an already-authenticated one
// (not built yet - Phase 1 only needs the one bootstrap account: you).
export const bootstrapFirstAdmin = async ({ fullName, email, password }) => {

    if (!fullName || !email || !password) {
        return { success: false, message: "Full name, email, and password are required." };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return { success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }

    const existingCount = await PlatformAdminRepository.count();

    if (existingCount > 0) {
        return { success: false, message: "A platform admin already exists. Bootstrap is only available once." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const created = await PlatformAdminRepository.create({ fullName, email, password: hashedPassword });

    return { success: true, message: "Platform admin account created.", data: created };

};

// The only way to rotate a platform-admin password once bootstrapFirstAdmin
// has run its once-only creation - previously there was no path at all
// short of a direct database edit.
export const changeOwnPassword = async (platformAdminId, currentPassword, newPassword) => {

    if (!currentPassword) {
        return { success: false, message: "Current password is required." };
    }

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        return { success: false, message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }

    const currentHash = await PlatformAdminRepository.getPasswordHash(platformAdminId);
    const isCorrect = currentHash && await bcrypt.compare(currentPassword, currentHash);

    if (!isCorrect) {
        return { success: false, message: "Current password is incorrect." };
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await PlatformAdminRepository.updatePassword(platformAdminId, newHash);

    return { success: true, message: "Password changed." };

};
