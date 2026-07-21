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

const emptyForm = {
    code: "",
    discountType: "Percentage",
    discountValue: "",
    minOrderValue: "",
    maxDiscountAmount: "",
    usageLimitTotal: "",
    usageLimitPerCustomer: "",
    validFrom: "",
    validUntil: "",
    isActive: true
};

const emptyErrors = { code: "", discountValue: "" };

const toDateInputValue = (value) => {

    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toISOString().slice(0, 10);

};

function CouponDialog({ open, onClose, onSave, editingCoupon, saving }) {

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState(emptyErrors);

    const isEditMode = Boolean(editingCoupon);

    useEffect(() => {

        if (open && editingCoupon) {

            setFormData({
                code: editingCoupon.Code ?? "",
                discountType: editingCoupon.DiscountType ?? "Percentage",
                discountValue: editingCoupon.DiscountValue ?? "",
                minOrderValue: editingCoupon.MinOrderValue ?? "",
                maxDiscountAmount: editingCoupon.MaxDiscountAmount ?? "",
                usageLimitTotal: editingCoupon.UsageLimitTotal ?? "",
                usageLimitPerCustomer: editingCoupon.UsageLimitPerCustomer ?? "",
                validFrom: toDateInputValue(editingCoupon.ValidFrom),
                validUntil: toDateInputValue(editingCoupon.ValidUntil),
                isActive: Boolean(editingCoupon.IsActive)
            });

        } else if (open) {

            setFormData(emptyForm);

        }

        setErrors(emptyErrors);

    }, [open, editingCoupon]);

    const handleChange = (event) => {

        const { name, value, checked, type } = event.target;

        setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }

    };

    const handleCodeChange = (event) => {
        setFormData((prev) => ({ ...prev, code: event.target.value.toUpperCase() }));

        if (errors.code) {
            setErrors((prev) => ({ ...prev, code: "" }));
        }
    };

    const handleTypeChange = (event) => {
        setFormData((prev) => ({ ...prev, discountType: event.target.value }));
    };

    const validate = () => {

        const nextErrors = { ...emptyErrors };

        if (!isEditMode && formData.code.trim() === "") {
            nextErrors.code = "Code is required.";
        }

        const discountValue = Number(formData.discountValue);

        if (!formData.discountValue || Number.isNaN(discountValue) || discountValue <= 0) {
            nextErrors.discountValue = "Discount must be greater than 0.";
        } else if (formData.discountType === "Percentage" && discountValue > 100) {
            nextErrors.discountValue = "Percentage discount cannot exceed 100.";
        }

        setErrors(nextErrors);

        return Object.values(nextErrors).every((error) => error === "");

    };

    const toNumberOrNull = (value) => {

        if (value === "" || value === null || value === undefined) {
            return null;
        }

        const parsed = Number(value);

        return Number.isNaN(parsed) ? null : parsed;

    };

    const handleSubmit = () => {

        if (!validate()) {
            return;
        }

        const payload = {
            discountType: formData.discountType,
            discountValue: Number(formData.discountValue),
            minOrderValue: toNumberOrNull(formData.minOrderValue),
            maxDiscountAmount: formData.discountType === "Percentage" ? toNumberOrNull(formData.maxDiscountAmount) : null,
            usageLimitTotal: toNumberOrNull(formData.usageLimitTotal),
            usageLimitPerCustomer: toNumberOrNull(formData.usageLimitPerCustomer),
            validFrom: formData.validFrom || null,
            validUntil: formData.validUntil || null
        };

        if (!isEditMode) {
            payload.code = formData.code.trim();
        } else {
            payload.isActive = formData.isActive;
        }

        onSave(payload);

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ fontWeight: 700 }}>
                {isEditMode ? "Edit Coupon" : "Add Coupon"}
            </DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>

                    <Grid size={{ xs: 12, sm: isEditMode ? 12 : 6 }}>
                        <TextField
                            fullWidth
                            required
                            label="Code"
                            name="code"
                            value={formData.code}
                            onChange={handleCodeChange}
                            disabled={isEditMode}
                            error={Boolean(errors.code)}
                            helperText={errors.code || (isEditMode ? "Code cannot be changed after creation." : "e.g. WELCOME50")}
                            inputProps={{ style: { textTransform: "uppercase" } }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            select
                            label="Discount Type"
                            name="discountType"
                            value={formData.discountType}
                            onChange={handleTypeChange}
                        >
                            <MenuItem value="Percentage">Percentage</MenuItem>
                            <MenuItem value="Flat">Flat</MenuItem>
                        </TextField>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            required
                            type="number"
                            label={formData.discountType === "Percentage" ? "Discount %" : "Discount Amount (₹)"}
                            name="discountValue"
                            value={formData.discountValue}
                            onChange={handleChange}
                            error={Boolean(errors.discountValue)}
                            helperText={errors.discountValue}
                            inputProps={{ min: 0, step: "0.01" }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            type="number"
                            label="Minimum Order Value"
                            name="minOrderValue"
                            value={formData.minOrderValue}
                            onChange={handleChange}
                            inputProps={{ min: 0, step: "0.01" }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            type="number"
                            label="Max Discount Cap"
                            name="maxDiscountAmount"
                            value={formData.maxDiscountAmount}
                            onChange={handleChange}
                            disabled={formData.discountType !== "Percentage"}
                            helperText={formData.discountType !== "Percentage" ? "Only applies to Percentage discounts." : ""}
                            inputProps={{ min: 0, step: "0.01" }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            type="number"
                            label="Total Usage Limit"
                            name="usageLimitTotal"
                            value={formData.usageLimitTotal}
                            onChange={handleChange}
                            inputProps={{ min: 0, step: 1 }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            type="number"
                            label="Per-Customer Limit"
                            name="usageLimitPerCustomer"
                            value={formData.usageLimitPerCustomer}
                            onChange={handleChange}
                            inputProps={{ min: 0, step: 1 }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            type="date"
                            label="Valid From"
                            name="validFrom"
                            value={formData.validFrom}
                            onChange={handleChange}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            type="date"
                            label="Valid Until"
                            name="validUntil"
                            value={formData.validUntil}
                            onChange={handleChange}
                            InputLabelProps={{ shrink: true }}
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
                    {saving ? "Saving..." : isEditMode ? "Save Changes" : "Create Coupon"}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default CouponDialog;
