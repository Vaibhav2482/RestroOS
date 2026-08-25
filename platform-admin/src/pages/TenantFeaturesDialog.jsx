import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormGroup,
    Typography
} from "@mui/material";
import toast from "react-hot-toast";

import { updateTenantFeatures } from "../services/tenantService";
import { TENANT_FEATURES, TENANT_FEATURE_GROUPS } from "../utils/tenantFeatures";

const ALL_KEYS = TENANT_FEATURES.map((feature) => feature.key);

// A plan-tier restriction (Tenants.PlatformRestrictedFeatures) - distinct
// from, and takes priority over, the tenant's own Owner-facing Features
// toggle in tenant-admin (Tenants.DisabledFeatures, a different column).
// Whatever's unchecked here is a hard restriction the Owner can never
// override from their own side, directly or via a crafted request - see
// TenantService.updateDisabledFeatures's force-merge on the server.
function TenantFeaturesDialog({ open, tenant, onClose, onSaved }) {

    const [enabledFeatures, setEnabledFeatures] = useState(ALL_KEYS);
    const [saving, setSaving] = useState(false);

    useEffect(() => {

        if (open && tenant) {
            const restricted = tenant.PlatformRestrictedFeatures || [];
            setEnabledFeatures(ALL_KEYS.filter((key) => !restricted.includes(key)));
        }

    }, [open, tenant]);

    const handleToggle = (key) => {

        setEnabledFeatures((prev) =>
            prev.includes(key) ? prev.filter((existing) => existing !== key) : [...prev, key]
        );

    };

    const handleSave = async () => {

        try {

            setSaving(true);

            const platformRestrictedFeatures = ALL_KEYS.filter((key) => !enabledFeatures.includes(key));
            const response = await updateTenantFeatures(tenant.TenantId, platformRestrictedFeatures);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message || "Features updated.");
            onSaved?.(response.data);
            onClose();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update features.");

        } finally {

            setSaving(false);

        }

    };

    if (!tenant) {
        return null;
    }

    return (

        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">

            <DialogTitle>Features - {tenant.TenantName}</DialogTitle>

            <DialogContent>

                <Alert severity="warning" sx={{ mb: 2 }}>
                    Unchecking a feature hides it for everyone at this restaurant, including its
                    Owner, and the Owner won't be able to turn it back on themselves - use this to
                    match what a client's plan actually includes.
                </Alert>

                {TENANT_FEATURE_GROUPS.map((group) => (

                    <Box key={group} sx={{ mb: 1.5 }}>

                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                            {group.toUpperCase()}
                        </Typography>

                        <FormGroup>

                            {TENANT_FEATURES.filter((feature) => feature.group === group).map((feature) => (

                                <FormControlLabel
                                    key={feature.key}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={enabledFeatures.includes(feature.key)}
                                            onChange={() => handleToggle(feature.key)}
                                            disabled={saving}
                                        />
                                    }
                                    label={feature.label}
                                />

                            ))}

                        </FormGroup>

                    </Box>

                ))}

            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Features"}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default TenantFeaturesDialog;
