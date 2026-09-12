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
    IconButton,
    MenuItem,
    Select,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as tableVisitService from "../services/tableVisitService";
import { getStoredAuth, hasPermission } from "../utils/adminAuth";
import { POS_STATUS_COLOR } from "./posOrderStatus";
import { formatCurrency } from "./orderStatusUtils";
import TableVisitBillReceipt from "../components/TableVisitBillReceipt";
import PrintDialog from "../components/PrintDialog";
import { useThermalPrint } from "../hooks/useThermalPrint";
import { buildBillTicket } from "../utils/billEscpos";

const PAYMENT_METHODS = ["Cash", "Card", "UPI"];

// Even shares of `total` across `count` splits, rounded to paise - the last
// share absorbs whatever the rounding of the others didn't divide evenly
// (e.g. ₹100 / 3 = 33.33/33.33/33.34), so the set always sums to exactly
// `total` rather than being a few paise short.
const makeEvenSplits = (total, count) => {

    const each = Math.floor((total / count) * 100) / 100;
    const shares = Array(count - 1).fill(each);
    const last = Math.round((total - each * (count - 1)) * 100) / 100;

    return [...shares, last].map((amount) => ({ amount: amount.toFixed(2), paymentMethod: "Cash" }));

};

// The one consolidated bill for everything ordered at a table across
// however many rounds/KOTs it took (see server migration
// 0024_table_visits) - opened from the floor grid's per-table "Settle
// Bill" action, regardless of whether that table has one order or five.
// Settling here is what actually frees the table; each individual order's
// own kitchen status is untouched by this. tables/activeOrdersByTable
// (both optional) are the floor grid's own state, passed through only so
// this can offer "merge with..." candidates without a dedicated endpoint.
function SettleBillDialog({ open, branchId, table, tables = [], activeOrdersByTable = new Map(), onClose, onSettled }) {

    const auth = getStoredAuth();
    const canApplyDiscount = hasPermission(auth?.admin, "apply_discounts");
    const { printing: billPrinting, print: printBill } = useThermalPrint("bill");

    const [loading, setLoading] = useState(true);
    const [visit, setVisit] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [settling, setSettling] = useState(false);
    const [billOpen, setBillOpen] = useState(false);
    const [discountAmount, setDiscountAmount] = useState("");
    const [discountReason, setDiscountReason] = useState("");
    const [splitMode, setSplitMode] = useState(false);
    const [splits, setSplits] = useState([]);
    const [mergeTarget, setMergeTarget] = useState("");
    const [merging, setMerging] = useState(false);

    // Re-resolves whatever visit THIS dialog's own table currently belongs
    // to - always by table name, never by a previously-known VisitId, so
    // this keeps working correctly after a merge/unmerge changes which
    // visit that table name actually resolves to.
    const loadVisit = async () => {

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

    };

    useEffect(() => {

        if (!open || !table) {
            return;
        }

        (async () => {

            setLoading(true);
            setVisit(null);
            setDiscountAmount("");
            setDiscountReason("");
            setSplitMode(false);
            setSplits([]);
            setMergeTarget("");

            try {

                await loadVisit();

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load this table's bill.");
                onClose();

            } finally {

                setLoading(false);

            }

        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, table, branchId]);

    const discount = Number(discountAmount) || 0;
    const amountDue = Math.max(0, Number(visit?.TotalAmount ?? 0) - discount);

    const splitTotal = splits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);
    // Rounded to paise before comparing - floating point on two decimals
    // (100.10 + 100.10 !== 200.20 in raw JS math) would otherwise show a
    // fictitious few-paise remainder even when the split rows are correct.
    const splitRemaining = Math.round((amountDue - splitTotal) * 100) / 100;

    const toggleSplitMode = () => {

        if (splitMode) {
            setSplitMode(false);
            setSplits([]);
            return;
        }

        setSplitMode(true);
        setSplits(makeEvenSplits(amountDue, 2));

    };

    const updateSplit = (index, field, value) => {
        setSplits((prev) => prev.map((split, i) => (i === index ? { ...split, [field]: value } : split)));
    };

    const addSplit = () => {
        setSplits((prev) => [...prev, { amount: "0.00", paymentMethod: "Cash" }]);
    };

    const removeSplit = (index) => {
        setSplits((prev) => prev.filter((_, i) => i !== index));
    };

    // A single-entry array for an ordinary, never-merged visit - see
    // TableVisitRepository.getVisitHeader.
    const mergedVisits = visit?.MergedVisits || [];
    const mergedTableNumbers = new Set(mergedVisits.map((mv) => mv.TableNumber));

    // Any other table currently carrying an active order, minus this
    // dialog's own table and whichever ones are already part of this same
    // merged bill - a real occupancy proxy without a dedicated "which
    // tables have an open visit" endpoint, same data the floor grid itself
    // already renders from. `table` is null whenever this dialog is closed
    // (Pos.jsx keeps it mounted at all times with table={settleBillTable}),
    // so this whole computation is skipped rather than dereferencing null.
    const mergeCandidates = table
        ? tables.filter((candidate) =>
            candidate.TableName !== table.TableName &&
            !mergedTableNumbers.has(candidate.TableName) &&
            (activeOrdersByTable.get(candidate.TableName) || []).length > 0
        )
        : [];

    const handleMerge = async () => {

        if (!mergeTarget) {
            return;
        }

        setMerging(true);

        try {

            const result = await tableVisitService.mergeTables(branchId, table.TableName, mergeTarget);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(`Table ${table.TableName} merged into Table ${mergeTarget}.`);
            setVisit(result.data);
            setMergeTarget("");

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to merge these tables.");

        } finally {

            setMerging(false);

        }

    };

    const handleUnmerge = async (tableNumber) => {

        try {

            const result = await tableVisitService.unmergeTable(branchId, tableNumber);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(`Table ${tableNumber} unmerged.`);

            // Re-resolve THIS dialog's own table rather than trusting
            // result.data directly - that's the detached table's own tiny
            // bill, which is only what this dialog should show if the
            // detached table happened to be the one it was opened for. If a
            // co-table was unmerged instead, this dialog needs to keep
            // showing the remaining combined bill, not switch away to it.
            await loadVisit();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to unmerge this table.");

        }

    };

    const handleSettle = async () => {

        if (discount > 0 && !discountReason.trim()) {
            toast.error("Please enter a reason for the discount.");
            return;
        }

        if (discount > Number(visit.TotalAmount)) {
            toast.error("Discount cannot exceed the bill total.");
            return;
        }

        if (splitMode) {

            if (splits.length < 2) {
                toast.error("Add at least two splits, or turn off Split Bill.");
                return;
            }

            if (splits.some((split) => !(Number(split.amount) > 0))) {
                toast.error("Every split needs an amount greater than zero.");
                return;
            }

            if (splitRemaining !== 0) {
                toast.error(`Splits must add up to the amount due (${splitRemaining > 0 ? "short" : "over"} by ${formatCurrency(Math.abs(splitRemaining))}).`);
                return;
            }

        }

        setSettling(true);

        try {

            const result = await tableVisitService.settleVisit(visit.VisitId, {
                paymentMethod: splitMode ? undefined : paymentMethod,
                discountAmount: discount,
                discountReason: discountReason.trim() || undefined,
                splits: splitMode ? splits.map((split) => ({ amount: Number(split.amount), paymentMethod: split.paymentMethod })) : undefined
            });

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
                    Settle Bill &mdash; Table {mergedVisits.length > 1 ? mergedVisits.map((mv) => mv.TableNumber).join(" + ") : table?.TableName}
                </DialogTitle>

                <DialogContent>

                    {loading ? (

                        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                            <CircularProgress size={28} />
                        </Box>

                    ) : visit && (

                        <>

                            {/* Two or more physical tables pushed together for one
                                party - each stays occupied/clickable on its own floor-
                                grid card, but they share this one combined bill (see
                                server migration 0039_table_visit_merge). A chip's "x"
                                unmerges just that one table back to its own bill;
                                unmerging is disabled once the combined bill is settled. */}
                            {mergedVisits.length > 1 && (

                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>

                                    {mergedVisits.map((mv) => (

                                        <Chip
                                            key={mv.VisitId}
                                            label={`Table ${mv.TableNumber}`}
                                            color="primary"
                                            variant="outlined"
                                            size="small"
                                            onDelete={visit.Status === "Open" ? () => handleUnmerge(mv.TableNumber) : undefined}
                                        />

                                    ))}

                                </Box>

                            )}

                            {visit.Status === "Open" && mergeCandidates.length > 0 && (

                                <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>

                                    <Select
                                        size="small"
                                        displayEmpty
                                        value={mergeTarget}
                                        onChange={(event) => setMergeTarget(event.target.value)}
                                        sx={{ minWidth: 170, flex: 1 }}
                                    >
                                        <MenuItem value=""><em>Merge with another table&hellip;</em></MenuItem>
                                        {mergeCandidates.map((candidate) => (
                                            <MenuItem key={candidate.TableId} value={candidate.TableName}>
                                                Table {candidate.TableName}
                                            </MenuItem>
                                        ))}
                                    </Select>

                                    <Button size="small" disabled={!mergeTarget || merging} onClick={handleMerge}>
                                        {merging ? "Merging..." : "Merge"}
                                    </Button>

                                </Box>

                            )}

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
                                            Order #{order.OrderId}
                                            {mergedVisits.length > 1 ? ` · Table ${order.TableNumber}` : ""}
                                            {" "}&middot; {new Date(order.OrderDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
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

                                    {canApplyDiscount && (

                                        <Box sx={{ mb: 2 }}>

                                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                                Bill Discount (optional)
                                            </Typography>

                                            <Box sx={{ display: "flex", gap: 1, mb: discount > 0 ? 1 : 0 }}>

                                                <TextField
                                                    size="small"
                                                    type="number"
                                                    label="Amount"
                                                    value={discountAmount}
                                                    onChange={(event) => setDiscountAmount(event.target.value)}
                                                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                                                    sx={{ width: 130 }}
                                                />

                                                <TextField
                                                    size="small"
                                                    label="Reason"
                                                    placeholder="e.g. Loyal customer, service delay"
                                                    value={discountReason}
                                                    onChange={(event) => setDiscountReason(event.target.value)}
                                                    fullWidth
                                                />

                                            </Box>

                                            {discount > 0 && (
                                                <Typography variant="body2" fontWeight={700} color="success.main">
                                                    Amount Due: {formatCurrency(amountDue)}
                                                </Typography>
                                            )}

                                        </Box>

                                    )}

                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>

                                        <Typography variant="subtitle2" fontWeight={700}>
                                            {splitMode ? "Split Bill" : "Payment Method"}
                                        </Typography>

                                        {/* A group splitting the bill three ways with three
                                            different payment methods is common enough that this
                                            needs its own dedicated flow, not just a note in Order
                                            Notes - see TableVisitPayments (server migration
                                            0038). */}
                                        <Button size="small" onClick={toggleSplitMode} sx={{ minWidth: 0, textTransform: "none" }}>
                                            {splitMode ? "Cancel Split" : "Split Bill"}
                                        </Button>

                                    </Box>

                                    {splitMode ? (

                                        <Box sx={{ mb: 2 }}>

                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1.5 }}>

                                                {splits.map((split, index) => (

                                                    <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center" }}>

                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label={`Split ${index + 1}`}
                                                            value={split.amount}
                                                            onChange={(event) => updateSplit(index, "amount", event.target.value)}
                                                            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                                                            sx={{ width: 120 }}
                                                        />

                                                        <Select
                                                            size="small"
                                                            value={split.paymentMethod}
                                                            onChange={(event) => updateSplit(index, "paymentMethod", event.target.value)}
                                                            sx={{ minWidth: 90 }}
                                                        >
                                                            {PAYMENT_METHODS.map((method) => (
                                                                <MenuItem key={method} value={method}>{method}</MenuItem>
                                                            ))}
                                                        </Select>

                                                        <IconButton
                                                            size="small"
                                                            onClick={() => removeSplit(index)}
                                                            disabled={splits.length <= 2}
                                                            aria-label={`Remove split ${index + 1}`}
                                                        >
                                                            <DeleteOutlineRoundedIcon fontSize="small" />
                                                        </IconButton>

                                                    </Box>

                                                ))}

                                            </Box>

                                            <Button size="small" onClick={addSplit} sx={{ textTransform: "none", mb: 1 }}>
                                                + Add Split
                                            </Button>

                                            <Typography
                                                variant="body2"
                                                fontWeight={700}
                                                color={splitRemaining === 0 ? "success.main" : "error.main"}
                                            >
                                                {splitRemaining === 0
                                                    ? "Splits match the amount due."
                                                    : `${splitRemaining > 0 ? "Remaining" : "Over"}: ${formatCurrency(Math.abs(splitRemaining))}`}
                                            </Typography>

                                        </Box>

                                    ) : (

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

                                    )}

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
                            disabled={settling || (splitMode && splitRemaining !== 0)}
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
