import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, FormControlLabel, Paper, Radio, RadioGroup, Typography } from "@mui/material";
import toast from "react-hot-toast";

import * as tenantService from "../services/tenantService";

// Tenant-wide default only - an individual branch can still override this
// via its own DeliveryStaffingMode on the Branches page, for chains that
// mix models (e.g. a flagship branch with dedicated riders, a small outlet
// where staff double up).
function DeliverySettings() {

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [staffingMode, setStaffingMode] = useState("branch_staff");

    useEffect(() => {

        (async () => {

            try {

                const response = await tenantService.getOwnTenant();

                if (response.success) {
                    setStaffingMode(response.data.DeliveryStaffingMode || "branch_staff");
                } else {
                    toast.error(response.message || "Failed to load delivery settings.");
                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load delivery settings.");

            } finally {

                setLoading(false);

            }

        })();

    }, []);

    const handleSave = async () => {

        try {

            setSaving(true);

            const response = await tenantService.updateDeliveryStaffingMode(staffingMode);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(response.message || "Delivery settings updated.");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update delivery settings.");

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

            <Typography variant="h4" sx={{ mb: 1 }}>Delivery</Typography>

            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
                Choose how deliveries are staffed by default across your restaurant. An
                individual branch can override this on its own Branches page.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB", maxWidth: 520 }}>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Default staffing mode
                </Typography>

                <RadioGroup value={staffingMode} onChange={(event) => setStaffingMode(event.target.value)} sx={{ mb: 3 }}>

                    <FormControlLabel
                        value="branch_staff"
                        control={<Radio />}
                        label={
                            <Box>
                                <Typography fontWeight={600}>Branch staff deliver</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Whoever's on shift can share their live location for a delivery, right from the order.
                                </Typography>
                            </Box>
                        }
                        sx={{ mb: 2, alignItems: "flex-start" }}
                    />

                    <FormControlLabel
                        value="dedicated_riders"
                        control={<Radio />}
                        label={
                            <Box>
                                <Typography fontWeight={600}>Dedicated delivery riders</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Assign a rider from your team to each delivery order.
                                </Typography>
                            </Box>
                        }
                        sx={{ alignItems: "flex-start" }}
                    />

                </RadioGroup>

                <Button
                    variant="contained"
                    disabled={saving}
                    onClick={handleSave}
                    sx={{ height: 44, px: 4 }}
                >
                    {saving ? "Saving..." : "Save Delivery Settings"}
                </Button>

            </Paper>

        </Box>

    );

}

export default DeliverySettings;
