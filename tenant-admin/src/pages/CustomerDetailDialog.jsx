import { useEffect, useState } from "react";
import {
    Box,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import EmptyState from "../components/EmptyState";
import OrderDetailsDialog from "./OrderDetailsDialog";
import { formatCurrency, getStatusChipColor } from "./orderStatusUtils";

// Order history for one customer - a read-only view built for support/POS
// lookups ("has this person ordered before? what did they get last time?").
// Clicking a row reuses the same OrderDetailsDialog the Orders page opens,
// so cancel/advance/edit-items all work identically from here too.
function CustomerDetailDialog({ open, customer, onClose }) {

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [orderDialogOpen, setOrderDialogOpen] = useState(false);

    useEffect(() => {

        if (open && customer) {
            loadOrders();
        }

        if (!open) {
            setOrders([]);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, customer]);

    const loadOrders = async () => {

        try {

            setLoading(true);

            const response = await orderService.getOrdersByCustomer(customer.CustomerId);

            if (response.success) {
                setOrders(response.data);
            } else {
                toast.error(response.message || "Failed to load this customer's orders.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load this customer's orders.");

        } finally {

            setLoading(false);

        }

    };

    const handleRowClick = (orderId) => {
        setSelectedOrderId(orderId);
        setOrderDialogOpen(true);
    };

    const handleOrderDialogClose = () => {
        setOrderDialogOpen(false);
        setSelectedOrderId(null);
    };

    if (!customer) {
        return null;
    }

    const totalSpent = orders
        .filter((order) => order.OrderStatus !== "Cancelled")
        .reduce((sum, order) => sum + Number(order.TotalAmount || 0), 0);

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                {customer.FullName}

                <IconButton onClick={onClose} size="small">
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>

            </DialogTitle>

            <DialogContent dividers>

                <Grid container spacing={2} sx={{ mb: 3 }}>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Phone</Typography>
                        <Typography fontWeight={600}>{customer.Phone || "-"}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Email</Typography>
                        <Typography fontWeight={600}>{customer.Email || "-"}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Customer Since</Typography>
                        <Typography fontWeight={600}>{new Date(customer.CreatedAt).toLocaleDateString()}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">Total Spent</Typography>
                        <Typography fontWeight={600}>{formatCurrency(totalSpent)}</Typography>
                    </Grid>

                </Grid>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle2" sx={{ mb: 1 }}>Order History</Typography>

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                        <CircularProgress size={28} />
                    </Box>

                ) : orders.length === 0 ? (

                    <EmptyState
                        icon={<ReceiptLongOutlinedIcon />}
                        title="No orders yet"
                        description="This customer hasn't placed an order."
                    />

                ) : (

                    <TableContainer sx={{ border: "1px solid #E5E7EB", borderRadius: 2 }}>

                        <Table size="small">

                            <TableHead>
                                <TableRow>
                                    <TableCell>Order</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                    <TableCell>Status</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>

                                {orders.map((order) => (

                                    <TableRow key={order.OrderId} hover sx={{ cursor: "pointer" }} onClick={() => handleRowClick(order.OrderId)}>
                                        <TableCell>#{order.OrderId}</TableCell>
                                        <TableCell>{new Date(order.OrderDate).toLocaleDateString()}</TableCell>
                                        <TableCell align="right">{formatCurrency(order.TotalAmount)}</TableCell>
                                        <TableCell>
                                            <Chip label={order.OrderStatus} color={getStatusChipColor(order.OrderStatus)} size="small" />
                                        </TableCell>
                                    </TableRow>

                                ))}

                            </TableBody>

                        </Table>

                    </TableContainer>

                )}

            </DialogContent>

            <OrderDetailsDialog
                open={orderDialogOpen}
                orderId={selectedOrderId}
                onClose={handleOrderDialogClose}
                onChanged={loadOrders}
            />

        </Dialog>

    );

}

export default CustomerDetailDialog;
