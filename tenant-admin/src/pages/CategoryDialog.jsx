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

import ImageUploadField from "../components/ImageUploadField";

const emptyForm = {
    categoryName: "",
    description: "",
    imageUrl: "",
    displayOrder: "",
    isActive: true
};

const emptyErrors = { categoryName: "", displayOrder: "" };

function CategoryDialog({ open, onClose, onSave, selectedCategory, isEditMode }) {

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState(emptyErrors);
    const [saving, setSaving] = useState(false);

    useEffect(() => {

        if (isEditMode && selectedCategory) {

            setFormData({
                categoryName: selectedCategory.CategoryName ?? "",
                description: selectedCategory.Description ?? "",
                imageUrl: selectedCategory.ImageUrl ?? "",
                displayOrder: selectedCategory.DisplayOrder ?? "",
                isActive: Boolean(selectedCategory.IsActive)
            });

        } else {

            setFormData(emptyForm);

        }

        setErrors(emptyErrors);

    }, [selectedCategory, isEditMode, open]);

    const handleChange = (event) => {

        const { name, value, checked, type } = event.target;

        setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

    };

    const handleImageChange = (url) => {
        setFormData((prev) => ({ ...prev, imageUrl: url }));
    };

    const validate = () => {

        const nextErrors = { ...emptyErrors };

        if (formData.categoryName.trim() === "") {
            nextErrors.categoryName = "Category Name is required.";
        }

        if (!formData.displayOrder || Number(formData.displayOrder) <= 0 || !Number.isInteger(Number(formData.displayOrder))) {
            nextErrors.displayOrder = "Display Order must be greater than 0.";
        }

        setErrors(nextErrors);

        return Object.values(nextErrors).every((error) => error === "");

    };

    const handleSubmit = async () => {

        if (!validate()) {
            return;
        }

        const payload = {
            categoryName: formData.categoryName.trim(),
            description: formData.description.trim(),
            imageUrl: formData.imageUrl.trim(),
            displayOrder: Number(formData.displayOrder)
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

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle>
                {isEditMode ? "Edit Category" : "Add Category"}
            </DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 1 }}>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            required
                            label="Category Name"
                            name="categoryName"
                            value={formData.categoryName}
                            onChange={handleChange}
                            error={Boolean(errors.categoryName)}
                            helperText={errors.categoryName}
                        />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: isEditMode ? 6 : 12 }}>
                        <TextField
                            fullWidth
                            required
                            type="number"
                            label="Display Order"
                            name="displayOrder"
                            value={formData.displayOrder}
                            onChange={handleChange}
                            error={Boolean(errors.displayOrder)}
                            helperText={errors.displayOrder}
                            inputProps={{ min: 1, step: 1 }}
                        />
                    </Grid>

                    {isEditMode && (

                        <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex", alignItems: "center" }}>
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

                    <Grid size={{ xs: 12 }}>
                        <ImageUploadField
                            label="Photo (optional)"
                            value={formData.imageUrl}
                            onChange={handleImageChange}
                        />
                    </Grid>

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

export default CategoryDialog;
