import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Step,
    StepLabel,
    Stepper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";

import { POS_STATUS_STEPS, getPosForwardStatuses, isPosCancellable, isPosTerminal } from "./posOrderStatus";

// Details view for a table's already-open order — lets staff advance its
// status forward or cancel it, instead of starting a second order on top.
function PosOrderDetails({ open, order, onClose, onAdvanceStatus, onCancelOrder }) {

    const [busy, setBusy] = useState(false);

    if (!order) {
        return null;
    }

    const currentStatus = order.OrderStatus;
    const isCancelled = currentStatus === "Cancelled";
    const activeStep = POS_STATUS_STEPS.indexOf(currentStatus);
    const forwardStatuses = getPosForwardStatuses(currentStatus);

    const handleAdvance = async (status) => {

        setBusy(true);

        try {
            await onAdvanceStatus(order.OrderId, status);
        } finally {
            setBusy(false);
        }

    };

    const handleCancel = async () => {

        setBusy(true);

        try {
            await onCancelOrder(order.OrderId);
        } finally {
            setBusy(false);
        }

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle>
                Order #{order.OrderId}
            </DialogTitle>

            <DialogContent>

                <Typography sx={{ mb: 0.5 }}>
                    <strong>Customer:</strong> {order.CustomerName}
                    {order.CustomerPhone && order.CustomerPhone !== "0000000000" ? ` — ${order.CustomerPhone}` : ""}
                </Typography>

                <Typography sx={{ mb: 0.5 }}>
                    <strong>Order Type:</strong> {order.DeliveryType}
                    {order.DeliveryType === "Dine In" && order.TableNumber && ` (Table ${order.TableNumber})`}
                </Typography>

                <Typography sx={{ mb: 2 }}>
                    <strong>Payment:</strong> {order.PaymentMethod}
                </Typography>

                {isCancelled ? (

                    <Alert severity="error" sx={{ mb: 2 }}>
                        This order has been cancelled.
                    </Alert>

                ) : (

                    <Box sx={{ overflowX: "auto", mb: 2 }}>

                        <Stepper activeStep={activeStep} alternativeLabel sx={{ minWidth: 420 }}>

                            {POS_STATUS_STEPS.map((step) => (
                                <Step key={step}>
                                    <StepLabel>{step}</StepLabel>
                                </Step>
                            ))}

                        </Stepper>

                    </Box>

                )}

                <TableContainer sx={{ mb: 2 }}>

                    <Table size="small">

                        <TableHead>
                            <TableRow>
                                <TableCell>Item</TableCell>
                                <TableCell align="right">Price</TableCell>
                                <TableCell align="right">Qty</TableCell>
                                <TableCell align="right">Total</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {(order.Items || []).map((item) => (

                                <TableRow key={item.OrderItemId}>
                                    <TableCell>{item.ItemName}</TableCell>
                                    <TableCell align="right">₹ {Number(item.Price).toFixed(2)}</TableCell>
                                    <TableCell align="right">{item.Quantity}</TableCell>
                                    <TableCell align="right">₹ {Number(item.TotalPrice).toFixed(2)}</TableCell>
                                </TableRow>

                            ))}

                        </TableBody>

                    </Table>

                </TableContainer>

                <Divider sx={{ mb: 1.5 }} />

                <Box sx={{ textAlign: "right", mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Subtotal: ₹ {Number(order.SubTotal).toFixed(2)}</Typography>
                    <Typography variant="body2" color="text.secondary">CGST: ₹ {Number(order.CgstAmount).toFixed(2)}</Typography>
                    <Typography variant="body2" color="text.secondary">SGST: ₹ {Number(order.SgstAmount).toFixed(2)}</Typography>
                    <Typography variant="h6" fontWeight={700}>Total: ₹ {Number(order.TotalAmount).toFixed(2)}</Typography>
                </Box>

                {!isPosTerminal(currentStatus) && !isCancelled && (

                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>

                        {forwardStatuses.map((status) => (

                            <Button
                                key={status}
                                variant="contained"
                                size="small"
                                disabled={busy}
                                onClick={() => handleAdvance(status)}
                            >
                                Mark {status}
                            </Button>

                        ))}

                        {isPosCancellable(currentStatus) && (

                            <Button
                                color="error"
                                variant="outlined"
                                size="small"
                                disabled={busy}
                                onClick={handleCancel}
                            >
                                Cancel Order
                            </Button>

                        )}

                    </Box>

                )}

                {isPosTerminal(currentStatus) && (

                    <Typography color="text.secondary">
                        This order is {currentStatus.toLowerCase()} — no further action available.
                    </Typography>

                )}

            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

        </Dialog>

    );

}

export default PosOrderDetails;
