import { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    Switch,
    TextField
} from "@mui/material";

const emptyForm = {
    tableName: "",
    capacity: "",
    isActive: true
};

const emptyErrors = { tableName: "" };

function TableDialog({ open, onClose, onSave, selectedTable, isEditMode }) {

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState(emptyErrors);
    const [saving, setSaving] = useState(false);

    useEffect(() => {

        if (isEditMode && selectedTable) {

            setFormData({
                tableName: selectedTable.TableName ?? "",
                capacity: selectedTable.Capacity ?? "",
                isActive: Boolean(selectedTable.IsActive)
            });

        } else {

            setFormData(emptyForm);

        }

        setErrors(emptyErrors);

    }, [selectedTable, isEditMode, open]);

    const handleChange = (event) => {

        const { name, value, checked, type } = event.target;

        setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

    };

    const validate = () => {

        const nextErrors = {
            tableName: formData.tableName.trim() === "" ? "Table Name is required." : ""
        };

        setErrors(nextErrors);

        return Object.values(nextErrors).every((error) => error === "");

    };

    const handleSubmit = async () => {

        if (!validate()) {
            return;
        }

        const payload = {
            tableName: formData.tableName.trim(),
            capacity: formData.capacity === "" ? null : Number(formData.capacity)
        };

        if (isEditMode) {
            payload.isActive = formData.isActive;
        }

        try {
            setSaving(true);
            await onSave(payload);
        } finally {
            setSaving(false);
        }

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">

            <DialogTitle>
                {isEditMode ? "Edit Table" : "Add Table"}
            </DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 1 }}>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            required
                            label="Table Name"
                            placeholder="e.g. T1, Patio-2"
                            name="tableName"
                            value={formData.tableName}
                            onChange={handleChange}
                            error={Boolean(errors.tableName)}
                            helperText={errors.tableName}
                        />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            type="number"
                            label="Seating Capacity (optional)"
                            name="capacity"
                            value={formData.capacity}
                            onChange={handleChange}
                            inputProps={{ min: 1 }}
                        />
                    </Grid>

                    {isEditMode && (

                        <Grid size={{ xs: 12 }}>
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

            <DialogActions>

                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>

                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {isEditMode ? "Update" : "Save"}
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default TableDialog;
