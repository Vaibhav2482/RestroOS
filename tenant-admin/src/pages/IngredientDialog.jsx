import { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    MenuItem,
    Switch,
    TextField
} from "@mui/material";

import { UNIT_OPTIONS } from "../utils/units";

const emptyForm = {
    name: "",
    sku: "",
    category: "",
    baseUnit: "g",
    lowStockThreshold: "",
    isActive: true
};

const emptyErrors = { name: "", baseUnit: "" };

function IngredientDialog({ open, onClose, onSave, editingIngredient, saving }) {

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState(emptyErrors);

    const isEditMode = Boolean(editingIngredient);

    useEffect(() => {

        if (open && editingIngredient) {

            setFormData({
                name: editingIngredient.Name ?? "",
                sku: editingIngredient.SKU ?? "",
                category: editingIngredient.Category ?? "",
                baseUnit: editingIngredient.BaseUnit ?? "g",
                lowStockThreshold: editingIngredient.LowStockThreshold ?? "",
                isActive: editingIngredient.IsActive === undefined ? true : Boolean(editingIngredient.IsActive)
            });

        } else if (open) {

            setFormData(emptyForm);

        }

        setErrors(emptyErrors);

    }, [open, editingIngredient]);

    const handleChange = (event) => {

        const { name, value, checked, type } = event.target;

        setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

    };

    const validate = () => {

        const nextErrors = { ...emptyErrors };

        if (formData.name.trim() === "") {
            nextErrors.name = "Name is required.";
        }

        if (!formData.baseUnit) {
            nextErrors.baseUnit = "Base unit is required.";
        }

        setErrors(nextErrors);

        return Object.values(nextErrors).every((error) => error === "");

    };

    const handleSubmit = () => {

        if (!validate()) {
            return;
        }

        onSave({
            name: formData.name.trim(),
            sku: formData.sku.trim() || null,
            category: formData.category.trim() || null,
            baseUnit: formData.baseUnit,
            lowStockThreshold: formData.lowStockThreshold === "" ? null : Number(formData.lowStockThreshold),
            ...(isEditMode ? { isActive: formData.isActive } : {})
        });

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ fontWeight: 700 }}>
                {isEditMode ? "Edit Ingredient" : "Add Ingredient"}
            </DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            required
                            label="Name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            error={Boolean(errors.name)}
                            helperText={errors.name}
                            placeholder="e.g. Refined Flour"
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label="SKU"
                            name="sku"
                            value={formData.sku}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label="Category"
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            placeholder="e.g. Grains, Dairy"
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            select
                            required
                            label="Base Unit"
                            name="baseUnit"
                            value={formData.baseUnit}
                            onChange={handleChange}
                            disabled={isEditMode}
                            error={Boolean(errors.baseUnit)}
                            helperText={errors.baseUnit || (isEditMode ? "Cannot be changed once ledger entries exist against it." : "The unit stock is tracked in for this ingredient.")}
                        >
                            {UNIT_OPTIONS.map((unit) => (
                                <MenuItem key={unit.code} value={unit.code}>{unit.label}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            type="number"
                            label="Low Stock Threshold"
                            name="lowStockThreshold"
                            value={formData.lowStockThreshold}
                            onChange={handleChange}
                            helperText="Optional - flags this ingredient as Low Stock below this level."
                            inputProps={{ min: 0, step: "0.001" }}
                        />
                    </Grid>

                    {isEditMode && (

                        <Grid size={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={handleChange}
                                    />
                                }
                                label="Active"
                            />
                        </Grid>

                    )}

                </Grid>

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? "Saving..." : isEditMode ? "Save Changes" : "Create Ingredient"}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default IngredientDialog;
