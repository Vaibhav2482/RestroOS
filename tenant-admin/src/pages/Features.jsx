import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    FormGroup,
    Paper,
    Tooltip,
    Typography
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import toast from "react-hot-toast";

import * as tenantService from "../services/tenantService";
import { getStoredAuth, setStoredAuth } from "../utils/adminAuth";
import { TENANT_FEATURES } from "../utils/permissions";

const ALL_KEYS = TENANT_FEATURES.map((feature) => feature.key);
const FEATURE_GROUPS = [...new Set(TENANT_FEATURES.map((feature) => feature.group))];

// Owner-only tenant-wide switches (see requireFeatureEnabled in
// server/middleware/Auth.js) - unlike the per-staff permissions on the
// Staff page, turning one of these off hides it for EVERYONE in the
// restaurant, the Owner included, not just specific admins.
function Features() {

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabledFeatures, setEnabledFeatures] = useState(ALL_KEYS);
    // A plan-tier restriction only a platform admin sets - rendered locked
    // below, never offered as something this page can toggle at all. Even
    // if a request were crafted to "enable" one, TenantService.
    // updateDisabledFeatures force-keeps it disabled server-side; this is
    // just what makes that not a confusing dead click in the first place.
    const [restrictedFeatures, setRestrictedFeatures] = useState([]);

    useEffect(() => {

        (async () => {

            try {

                const response = await tenantService.getOwnTenant();

                if (response.success) {
                    const disabled = response.data.DisabledFeatures || [];
                    const restricted = response.data.PlatformRestrictedFeatures || [];
                    setEnabledFeatures(ALL_KEYS.filter((key) => !disabled.includes(key) && !restricted.includes(key)));
                    setRestrictedFeatures(restricted);
                } else {
                    toast.error(response.message || "Failed to load features.");
                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load features.");

            } finally {

                setLoading(false);

            }

        })();

    }, []);

    const handleToggle = (key) => {

        if (restrictedFeatures.includes(key)) {
            return;
        }

        setEnabledFeatures((prev) =>
            prev.includes(key) ? prev.filter((existing) => existing !== key) : [...prev, key]
        );

    };

    const handleSave = async () => {

        try {

            setSaving(true);

            // restrictedFeatures never appear in enabledFeatures (handleToggle
            // refuses to add them), so this naturally submits them as
            // disabled - nothing extra to filter out here.
            const disabledFeatures = ALL_KEYS.filter((key) => !enabledFeatures.includes(key));
            const response = await tenantService.updateDisabledFeatures(disabledFeatures);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            // The Owner making this change shouldn't have to wait for
            // Layout.jsx's 60s poll to see their own nav update - other
            // logged-in sessions still pick it up from that poll.
            const current = getStoredAuth();

            if (current) {
                setStoredAuth({ ...current, admin: { ...current.admin, tenantDisabledFeatures: disabledFeatures } });
            }

            toast.success(response.message || "Features updated.");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update features.");

        } finally {

            setSaving(false);

        }

    };

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    return (

        <Box>

            <Typography variant="h4" sx={{ mb: 1 }}>Features</Typography>

            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
                Turn off anything your restaurant doesn't use. Unchecking a feature hides it for
                everyone - including you - not just specific staff. Staff permissions on the Staff
                page still apply on top of whatever's enabled here.
            </Typography>

            <Alert severity="warning" sx={{ mb: 3, maxWidth: 640 }}>
                Disabling a feature you're actively relying on (e.g. Orders) will lock everyone
                out of it, yourself included, until you re-enable it here.
            </Alert>

            {restrictedFeatures.length > 0 && (
                <Alert severity="info" icon={<LockOutlinedIcon fontSize="small" />} sx={{ mb: 3, maxWidth: 640 }}>
                    Anything marked with a lock icon isn't included in your current plan - contact
                    support to upgrade.
                </Alert>
            )}

            <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB", maxWidth: 640 }}>

                {FEATURE_GROUPS.map((group) => (

                    <Box key={group} sx={{ mb: 2 }}>

                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                            {group.toUpperCase()}
                        </Typography>

                        <FormGroup>

                            {TENANT_FEATURES.filter((feature) => feature.group === group).map((feature) => {

                                const isRestricted = restrictedFeatures.includes(feature.key);

                                const control = (
                                    <FormControlLabel
                                        key={feature.key}
                                        control={
                                            <Checkbox
                                                checked={enabledFeatures.includes(feature.key)}
                                                onChange={() => handleToggle(feature.key)}
                                                disabled={isRestricted}
                                            />
                                        }
                                        label={
                                            isRestricted ? (
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.disabled" }}>
                                                    {feature.label}
                                                    <LockOutlinedIcon sx={{ fontSize: 14 }} />
                                                </Box>
                                            ) : feature.label
                                        }
                                    />
                                );

                                return isRestricted ? (
                                    <Tooltip key={feature.key} title="Not included in your plan - contact support to upgrade." placement="right">
                                        <span>{control}</span>
                                    </Tooltip>
                                ) : control;

                            })}

                        </FormGroup>

                    </Box>

                ))}

                <Button
                    variant="contained"
                    disabled={saving}
                    onClick={handleSave}
                    sx={{ height: 44, px: 4, mt: 1 }}
                >
                    {saving ? "Saving..." : "Save Features"}
                </Button>

            </Paper>

        </Box>

    );

}

export default Features;
