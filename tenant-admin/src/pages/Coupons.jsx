import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as couponService from "../services/couponService";
import CouponDialog from "./CouponDialog";

const formatDate = (value) => {

    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

};

const formatDiscount = (coupon) => {

    if (coupon.DiscountType === "Percentage") {
        return `${Number(coupon.DiscountValue)}% off`;
    }

    return `₹${Number(coupon.DiscountValue)} off`;

};

function Coupons() {

    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [saving, setSaving] = useState(false);

    // Only the first load shows the blocking spinner - reloading after a
    // create/edit/deactivate keeps the existing table visible instead of
    // blanking the page out on every action.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        loadCoupons();

    }, []);

    const loadCoupons = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await couponService.getAllCoupons();

            if (response.success) {
                setCoupons(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load coupons.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleOpenCreate = () => {
        setEditingCoupon(null);
        setDialogOpen(true);
    };

    const handleOpenEdit = (coupon) => {
        setEditingCoupon(coupon);
        setDialogOpen(true);
    };

    const handleClose = () => {
        setDialogOpen(false);
        setEditingCoupon(null);
    };

    const handleSave = async (formData) => {

        try {

            setSaving(true);

            const response = editingCoupon
                ? await couponService.updateCoupon(editingCoupon.CouponId, formData)
                : await couponService.createCoupon(formData);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(editingCoupon ? "Coupon updated." : "Coupon created.");
            handleClose();
            loadCoupons();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to save coupon.");

        } finally {

            setSaving(false);

        }

    };

    const handleDeactivate = async (coupon) => {

        if (!window.confirm(`Deactivate coupon "${coupon.Code}"? Customers will no longer be able to apply it.`)) {
            return;
        }

        try {

            const response = await couponService.deactivateCoupon(coupon.CouponId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Coupon deactivated.");
            loadCoupons();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to deactivate coupon.");

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Box>
                    <Typography variant="h5" fontWeight={700}>Coupons</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Create and manage discount coupons for customer orders.
                    </Typography>
                </Box>

                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenCreate}>
                    Add Coupon
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>

                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Discount</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Min Order</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Usage Limits</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Validity</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : coupons.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">No coupons yet. Add your first coupon to get started.</Typography>
                                    </TableCell>
                                </TableRow>

                            ) : (

                                coupons.map((coupon) => {

                                    const validFrom = formatDate(coupon.ValidFrom);
                                    const validUntil = formatDate(coupon.ValidUntil);

                                    return (

                                        <TableRow key={coupon.CouponId} hover>

                                            <TableCell>
                                                <Typography fontWeight={600}>{coupon.Code}</Typography>
                                            </TableCell>

                                            <TableCell>
                                                <Chip label={formatDiscount(coupon)} size="small" color="primary" variant="outlined" />
                                                {coupon.DiscountType === "Percentage" && coupon.MaxDiscountAmount && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                                        capped at ₹{Number(coupon.MaxDiscountAmount)}
                                                    </Typography>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                {coupon.MinOrderValue ? `₹${Number(coupon.MinOrderValue)}` : "-"}
                                            </TableCell>

                                            <TableCell>
                                                {coupon.UsageLimitTotal || coupon.UsageLimitPerCustomer ? (
                                                    <Typography variant="body2">
                                                        {coupon.UsageLimitTotal ? `${coupon.UsageLimitTotal} total` : "No total limit"}
                                                        {coupon.UsageLimitPerCustomer ? ` · ${coupon.UsageLimitPerCustomer}/customer` : ""}
                                                    </Typography>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                {validFrom || validUntil ? (
                                                    <Typography variant="body2">
                                                        {validFrom || "Any time"} {"→"} {validUntil || "No expiry"}
                                                    </Typography>
                                                ) : (
                                                    "Always valid"
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                <Chip
                                                    label={coupon.IsActive ? "Active" : "Inactive"}
                                                    color={coupon.IsActive ? "success" : "default"}
                                                    size="small"
                                                />
                                            </TableCell>

                                            <TableCell align="right">

                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => handleOpenEdit(coupon)}>
                                                        <EditOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>

                                                <Tooltip title={coupon.IsActive ? "Deactivate" : "Already inactive"}>
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            disabled={!coupon.IsActive}
                                                            onClick={() => handleDeactivate(coupon)}
                                                        >
                                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>

                                            </TableCell>

                                        </TableRow>

                                    );

                                })

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            </Paper>

            <CouponDialog
                open={dialogOpen}
                onClose={handleClose}
                onSave={handleSave}
                editingCoupon={editingCoupon}
                saving={saving}
            />

        </Box>

    );

}

export default Coupons;
