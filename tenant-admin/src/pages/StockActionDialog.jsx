import { useEffect, useState } from "react";
import {
    Alert,
    Autocomplete,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";

import { compatibleUnits } from "../utils/units";

const MODE_CONFIG = {
    opening: { title: "Record Opening Stock", quantityLabel: "Quantity", submitLabel: "Record Opening Stock", requireReason: false },
    wastage: { title: "Record Wastage", quantityLabel: "Quantity Wasted", submitLabel: "Record Wastage", requireReason: true },
    adjustment: { title: "Record Stock Adjustment", quantityLabel: "Physical Quantity Counted", submitLabel: "Record Adjustment", requireReason: true }
};

// Presets to make the common cases one click - freeSolo still lets staff
// type something that isn't on the list, this is a shortcut, not a
// constraint on the Reason column's actual values.
const WASTAGE_REASON_PRESETS = ["Spoiled", "Dropped", "Expired", "Over-prepared", "Quality control reject", "Theft or loss"];

// Opening stock and wastage both post a "quantity" straight through; an
// adjustment instead posts the physical count the staff member just took
// (recordAdjustment on the server computes the delta against the system's
// own current balance) - same dialog shape, different payload key, so this
// stays one component instead of three near-identical ones.
function StockActionDialog({ open, mode, onClose, onSave, ingredient, currentBalance, saving }) {

    const [quantity, setQuantity] = useState("");
    const [unit, setUnit] = useState("");
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");

    const config = mode ? MODE_CONFIG[mode] : null;
    const units = ingredient ? compatibleUnits(ingredient.BaseUnit) : [];

    useEffect(() => {

        if (open) {
            setQuantity("");
            setUnit(ingredient?.BaseUnit || "");
            setReason("");
            setNotes("");
            setError("");
        }

    }, [open, ingredient]);

    if (!config) {
        return null;
    }

    const quantityNumber = Number(quantity);
    const showsDelta = mode === "adjustment" && quantity !== "" && !Number.isNaN(quantityNumber);
    const delta = showsDelta ? quantityNumber - Number(currentBalance || 0) : null;

    const handleSubmit = () => {

        if (quantity === "" || Number.isNaN(quantityNumber) || (mode !== "adjustment" && quantityNumber <= 0)) {
            setError(mode === "adjustment" ? "Enter the quantity you physically counted." : "Quantity must be greater than 0.");
            return;
        }

        if (mode === "adjustment" && quantityNumber < 0) {
            setError("Physical quantity cannot be negative.");
            return;
        }

        if (!unit) {
            setError("Select a unit.");
            return;
        }

        if (config.requireReason && reason.trim() === "") {
            setError("A reason is required.");
            return;
        }

        setError("");

        onSave({
            ingredientId: ingredient.IngredientId,
            unit,
            [mode === "adjustment" ? "physicalQuantity" : "quantity"]: quantityNumber,
            ...(config.requireReason ? { reason: reason.trim() } : {}),
            notes: notes.trim() || undefined
        });

    };

    return (

        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">

            <DialogTitle sx={{ fontWeight: 700 }}>
                {config.title}
            </DialogTitle>

            <DialogContent>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {ingredient?.Name} · current balance {Number(currentBalance || 0)} {ingredient?.BaseUnit}
                </Typography>

                <Grid container spacing={2}>

                    <Grid size={7}>
                        <TextField
                            fullWidth
                            autoFocus
                            type="number"
                            label={config.quantityLabel}
                            value={quantity}
                            onChange={(event) => setQuantity(event.target.value)}
                            inputProps={{ min: 0, step: "0.001" }}
                        />
                    </Grid>

                    <Grid size={5}>
                        <TextField
                            fullWidth
                            select
                            label="Unit"
                            value={unit}
                            onChange={(event) => setUnit(event.target.value)}
                        >
                            {units.map((option) => (
                                <MenuItem key={option.code} value={option.code}>{option.label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    {showsDelta && (

                        <Grid size={12}>
                            <Alert severity={delta === 0 ? "info" : delta > 0 ? "success" : "warning"} sx={{ py: 0 }}>
                                {delta === 0
                                    ? "Matches system stock - no adjustment will be recorded."
                                    : `${delta > 0 ? "+" : ""}${delta} ${ingredient?.BaseUnit} vs. system stock`}
                            </Alert>
                        </Grid>

                    )}

                    {config.requireReason && mode === "wastage" && (

                        <Grid size={12}>
                            <Autocomplete
                                freeSolo
                                options={WASTAGE_REASON_PRESETS}
                                value={reason}
                                onChange={(event, newValue) => setReason(newValue || "")}
                                onInputChange={(event, newValue) => setReason(newValue)}
                                renderInput={(params) => (
                                    <TextField {...params} label="Reason" placeholder="Pick a reason or type your own" />
                                )}
                            />
                        </Grid>

                    )}

                    {config.requireReason && mode !== "wastage" && (

                        <Grid size={12}>
                            <TextField
                                fullWidth
                                label="Reason"
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="e.g. Physical stock count"
                            />
                        </Grid>

                    )}

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            label="Notes (optional)"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            multiline
                            minRows={2}
                        />
                    </Grid>

                    {error && (
                        <Grid size={12}>
                            <Stack><Alert severity="error">{error}</Alert></Stack>
                        </Grid>
                    )}

                </Grid>

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? "Saving..." : config.submitLabel}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default StockActionDialog;
