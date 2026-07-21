import { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField
} from "@mui/material";

const emptyForm = {
    categoryId: "",
    itemName: "",
    description: "",
    price: "",
    imageUrl: "",
    isAvailable: true,
    isPopular: false,
    isActive: true,
    isVeg: true
};

const emptyErrors = { itemName: "", categoryId: "", price: "" };

function MenuItemDialog({ open, onClose, onSave, categories, editingItem, saving }) {

    const isEditMode = Boolean(editingItem);

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState(emptyErrors);

    useEffect(() => {

        if (!open) {
            return;
        }

        if (isEditMode) {

            setFormData({
                categoryId: editingItem.CategoryId ?? "",
                itemName: editingItem.ItemName ?? "",
                description: editingItem.Description ?? "",
                price: editingItem.Price ?? "",
                imageUrl: editingItem.ImageUrl ?? "",
                isAvailable: Boolean(editingItem.IsAvailable),
                isPopular: Boolean(editingItem.IsPopular),
                isActive: Boolean(editingItem.IsActive),
                isVeg: editingItem.IsVeg === undefined ? true : Boolean(editingItem.IsVeg)
            });

        } else {

            setFormData(emptyForm);

        }

        setErrors(emptyErrors);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingItem]);

    const handleChange = (event) => {

        const { name, value, checked, type } = event.target;

        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

    };

    const validate = () => {

        const nextErrors = { ...emptyErrors };

        if (formData.itemName.trim() === "") {
            nextErrors.itemName = "Item name is required.";
        }

        if (formData.categoryId === "") {
            nextErrors.categoryId = "Category is required.";
        }

        if (formData.price === "" || Number(formData.price) <= 0) {
            nextErrors.price = "Price must be greater than 0.";
        }

        setErrors(nextErrors);

        return Object.values(nextErrors).every((error) => error === "");

    };

    const handleSubmit = () => {

        if (!validate()) {
            return;
        }

        onSave({
            categoryId: formData.categoryId,
            itemName: formData.itemName.trim(),
            description: formData.description.trim(),
            price: Number(formData.price),
            imageUrl: formData.imageUrl.trim() || null,
            isAvailable: formData.isAvailable,
            isPopular: formData.isPopular,
            isActive: formData.isActive,
            isVeg: formData.isVeg
        });

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle>
                {isEditMode ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>

                    <Grid size={{ xs: 12, md: 6 }}>

                        <TextField
                            fullWidth
                            required
                            label="Item Name"
                            name="itemName"
                            value={formData.itemName}
                            onChange={handleChange}
                            error={Boolean(errors.itemName)}
                            helperText={errors.itemName}
                        />

                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>

                        <FormControl fullWidth required error={Boolean(errors.categoryId)}>

                            <InputLabel>Category</InputLabel>

                            <Select
                                label="Category"
                                name="categoryId"
                                value={formData.categoryId}
                                onChange={handleChange}
                            >

                                {categories.map((category) => (

                                    <MenuItem key={category.CategoryId} value={category.CategoryId}>
                                        {category.CategoryName}
                                    </MenuItem>

                                ))}

                            </Select>

                            {errors.categoryId && (
                                <FormHelperText>{errors.categoryId}</FormHelperText>
                            )}

                        </FormControl>

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

                    <Grid size={{ xs: 12, md: 6 }}>

                        <TextField
                            fullWidth
                            required
                            type="number"
                            label="Price"
                            name="price"
                            value={formData.price}
                            onChange={handleChange}
                            error={Boolean(errors.price)}
                            helperText={errors.price}
                            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                        />

                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>

                        <TextField
                            fullWidth
                            label="Image URL"
                            name="imageUrl"
                            placeholder="https://..."
                            value={formData.imageUrl}
                            onChange={handleChange}
                        />

                    </Grid>

                    <Grid size={{ xs: 12, md: 3 }}>

                        <FormControlLabel
                            control={
                                <Switch
                                    name="isAvailable"
                                    checked={formData.isAvailable}
                                    onChange={handleChange}
                                />
                            }
                            label="Available"
                        />

                    </Grid>

                    <Grid size={{ xs: 12, md: 3 }}>

                        <FormControlLabel
                            control={
                                <Switch
                                    name="isPopular"
                                    checked={formData.isPopular}
                                    onChange={handleChange}
                                />
                            }
                            label="Popular"
                        />

                    </Grid>

                    <Grid size={{ xs: 12, md: 3 }}>

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

                    <Grid size={{ xs: 12, md: 3 }}>

                        <FormControlLabel
                            control={
                                <Switch
                                    name="isVeg"
                                    checked={formData.isVeg}
                                    onChange={handleChange}
                                />
                            }
                            label="Veg"
                        />

                    </Grid>

                </Grid>

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>

                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>

                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {isEditMode ? "Save Changes" : "Add Item"}
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default MenuItemDialog;
