import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import toast from "react-hot-toast";

import * as tableVisitService from "../services/tableVisitService";
import { getStoredAuth } from "../utils/adminAuth";
import { POS_STATUS_COLOR } from "./posOrderStatus";
import { formatCurrency } from "./orderStatusUtils";
import TableVisitBillReceipt from "../components/TableVisitBillReceipt";
import PrintDialog from "../components/PrintDialog";
import { useThermalPrint } from "../hooks/useThermalPrint";
import { buildBillTicket } from "../utils/billEscpos";

const PAYMENT_METHODS = ["Cash", "Card", "UPI"];

// The one consolidated bill for everything ordered at a table across
// however many rounds/KOTs it took (see server migration
// 0024_table_visits) - opened from the floor grid's per-table "Settle
// Bill" action, regardless of whether that table has one order or five.
// Settling here is what actually frees the table; each individual order's
// own kitchen status is untouched by this.
function SettleBillDialog({ open, branchId, table, onClose, onSettled }) {

    const auth = getStoredAuth();
    const { printing: billPrinting, print: printBill } = useThermalPrint();

    const [loading, setLoading] = useState(true);
    const [visit, setVisit] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [settling, setSettling] = useState(false);
    const [billOpen, setBillOpen] = useState(false);

    useEffect(() => {

        if (!open || !table) {
            return;
        }

        (async () => {

            setLoading(true);
            setVisit(null);

            try {

                const openVisit = await tableVisitService.getOpenVisitForTable(branchId, table.TableName);

                if (!openVisit.success || !openVisit.data) {
                    toast.error("This table has no open bill to settle.");
                    onClose();
                    return;
                }

                const details = await tableVisitService.getVisitDetails(openVisit.data.VisitId);

                if (!details.success) {
                    toast.error(details.message);
                    onClose();
                    return;
                }

                setVisit(details.data);

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load this table's bill.");
                onClose();

            } finally {

                setLoading(false);

            }

        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, table, branchId]);

    const handleSettle = async () => {

        setSettling(true);

        try {

            const result = await tableVisitService.settleVisit(visit.VisitId, paymentMethod);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(`Table ${visit.TableNumber} settled and closed.`);
            setVisit(result.data);
            onSettled();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to settle this table's bill.");

        } finally {

            setSettling(false);

        }

    };

    return (

        <>

            <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">

                <DialogTitle>
                    Settle Bill &mdash; Table {table?.TableName}
                    {visit?.GuestCount && (
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                            &middot; {visit.GuestCount} guest{visit.GuestCount === 1 ? "" : "s"}
                        </Typography>
                    )}
                </DialogTitle>

                <DialogContent>

                    {loading ? (

                        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                            <CircularProgress size={28} />
                        </Box>

                    ) : visit && (

                        <>

                            {/* Each round is still its own order/KOT underneath - shown
                                here as context (what was ordered, when, by whom), not as
                                something staff need to settle individually. */}
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                                Orders on This Visit
                            </Typography>

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1, mb: 2 }}>

                                {(visit.Orders || []).map((order) => (

                                    <Box key={order.OrderId} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

                                        <Typography variant="body2">
                                            Order #{order.OrderId} &middot; {new Date(order.OrderDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                        </Typography>

                                        <Chip
                                            label={order.OrderStatus}
                                            color={POS_STATUS_COLOR[order.OrderStatus] || "default"}
                                            size="small"
                                        />

                                    </Box>

                                ))}

                            </Box>

                            <Divider sx={{ mb: 2 }} />

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2 }}>

                                {(visit.Items || []).map((item) => (

                                    <Box key={`${item.MenuItemId}-${item.FirstOrderItemId}`} sx={{ display: "flex", justifyContent: "space-between" }}>
                                        <Typography variant="body2">{item.Quantity}x {item.ItemName}</Typography>
                                        <Typography variant="body2" fontWeight={600}>{formatCurrency(item.TotalPrice)}</Typography>
                                    </Box>

                                ))}

                            </Box>

                            <Divider sx={{ mb: 1.5 }} />

                            <Box sx={{ textAlign: "right", mb: 2 }}>
                                <Typography variant="h6" fontWeight={800}>
                                    Total: {formatCurrency(visit.TotalAmount)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Includes CGST + SGST across {visit.OrderCount} order{visit.OrderCount === 1 ? "" : "s"}
                                </Typography>
                            </Box>

                            {visit.Status === "Closed" ? (

                                <Chip label={`Already settled via ${visit.PaymentMethod}`} color="success" sx={{ width: "100%" }} />

                            ) : (

                                <>

                                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                        Payment Method
                                    </Typography>

                                    <ToggleButtonGroup
                                        exclusive
                                        fullWidth
                                        color="primary"
                                        size="small"
                                        value={paymentMethod}
                                        onChange={(event, value) => value && setPaymentMethod(value)}
                                    >

                                        {PAYMENT_METHODS.map((method) => (
                                            <ToggleButton key={method} value={method}>
                                                {method}
                                            </ToggleButton>
                                        ))}

                                    </ToggleButtonGroup>

                                </>

                            )}

                        </>

                    )}

                </DialogContent>

                <DialogActions>

                    <Button onClick={onClose}>Close</Button>

                    {visit && (

                        <Button startIcon={<PrintOutlinedIcon />} onClick={() => setBillOpen(true)}>
                            Print Bill
                        </Button>

                    )}

                    {visit && visit.Status === "Open" && (

                        <Button
                            variant="contained"
                            disabled={settling}
                            onClick={handleSettle}
                        >
                            {settling ? "Settling..." : "Pay & Close Table"}
                        </Button>

                    )}

                </DialogActions>

            </Dialog>

            {visit && (

                <PrintDialog
                    open={billOpen}
                    onClose={() => setBillOpen(false)}
                    printLabel="Print Bill"
                    printing={billPrinting}
                    onPrint={() => printBill(() => buildBillTicket({ visit, restaurantName: auth?.admin?.tenantName, branchName: visit.BranchName }))}
                >
                    <TableVisitBillReceipt visit={visit} restaurantName={auth?.admin?.tenantName} branchName={visit.BranchName} />
                </PrintDialog>

            )}

        </>

    );

}

export default SettleBillDialog;
