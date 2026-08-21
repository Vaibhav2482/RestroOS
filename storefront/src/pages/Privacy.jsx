import { Box, Divider, Paper, Typography } from "@mui/material";

import { useStorefront } from "../context/StorefrontContext";

function Section({ title, children }) {

    return (
        <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
            {children}
        </Box>
    );

}

// The honest version of this document, not a boilerplate template: every
// claim below matches what the codebase actually does today. In particular
// it does NOT promise a specific automated retention period or self-service
// deletion, because neither exists yet - promising them here would make this
// page inaccurate rather than compliant. When those ship, this page is the
// first thing that needs updating alongside them.
function Privacy() {

    const { tenant } = useStorefront();
    const restaurantName = tenant?.TenantName || "this restaurant";

    return (

        <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: 720 }}>

            <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
                Privacy Policy
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                What {restaurantName} collects when you order through RestroOS, and what happens to it.
            </Typography>

            <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, border: "1px solid #E5E7EB" }}>

                <Section title="What we collect">
                    <Typography component="div" color="text.secondary" sx={{ mb: 1 }}>When you create an account: your name, email address, phone number, and a password (stored as a one-way hash, never in plain text - we cannot look it up, only verify it).</Typography>
                    <Typography component="div" color="text.secondary" sx={{ mb: 1 }}>When you save a delivery address: the address itself, city, state, pincode, and any landmark you add.</Typography>
                    <Typography component="div" color="text.secondary" sx={{ mb: 1 }}>When you place an order: what you ordered, the order total, your chosen payment method, and any notes you leave for the kitchen.</Typography>
                    <Typography component="div" color="text.secondary">If you add a profile photo, that image and its URL.</Typography>
                </Section>

                <Section title="What we don't collect">
                    <Typography component="div" color="text.secondary">Card or UPI details never reach {restaurantName} or RestroOS - payment is handled directly by Razorpay, our payment processor, and only a payment status and reference ID come back to us.</Typography>
                </Section>

                <Section title="How it's used">
                    <Typography component="div" color="text.secondary" sx={{ mb: 1 }}>To create and secure your account, take and fulfil your orders, and show you your own order history.</Typography>
                    <Typography component="div" color="text.secondary" sx={{ mb: 1 }}>To send order updates and receipts by email, SMS, or WhatsApp, through our messaging providers (Resend for email, Twilio for SMS/WhatsApp) - they process it only to deliver that message, not for their own purposes.</Typography>
                    <Typography component="div" color="text.secondary">To detect and fix errors in the app, through automated error monitoring that may capture technical details of what went wrong.</Typography>
                </Section>

                <Section title="Who sees it">
                    <Typography component="div" color="text.secondary" sx={{ mb: 1 }}>Your account and order data is visible to {restaurantName}'s own staff, scoped to their restaurant only - other restaurants on RestroOS never see it.</Typography>
                    <Typography component="div" color="text.secondary">We don't sell your data, and don't share it with anyone outside {restaurantName} and the processors named above.</Typography>
                </Section>

                <Section title="How long we keep it">
                    <Typography component="div" color="text.secondary">For as long as your account stays active, and afterwards for as long as {restaurantName} reasonably needs the order records for accounting, tax, or legal purposes. We don't currently run an automated deletion schedule beyond that - if you'd like your account and data reviewed or removed sooner, see below.</Typography>
                </Section>

                <Section title="Your account, and requesting deletion">
                    <Typography component="div" color="text.secondary" sx={{ mb: 1 }}>You can review and update your name, email, phone and photo any time from My Profile, and change your password there too.</Typography>
                    <Typography component="div" color="text.secondary">Account deletion isn't yet a self-service action in the app. To request it, contact {restaurantName} directly, or reach RestroOS support - either way, ask specifically for your account and personal data to be deleted, and it will be handled as a manual request.</Typography>
                </Section>

                <Section title="Changes to this policy">
                    <Typography component="div" color="text.secondary">If what we collect or how we use it changes meaningfully, this page will be updated to reflect it - it's written to describe what the app actually does, so it changes when the app does.</Typography>
                </Section>

                <Divider sx={{ my: 3 }} />

                <Typography variant="caption" color="text.secondary">
                    RestroOS is the platform {restaurantName} uses to run its online ordering. For anything about how your specific order or account is handled, {restaurantName} is your first point of contact.
                </Typography>

            </Paper>

        </Box>
        </Box>

    );

}

export default Privacy;
