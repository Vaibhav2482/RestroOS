import { Box, Chip, Divider, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

function formatMoney(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    return new Date(dateString).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });

}

// The whole point of TableVisits (see server migration
// 0024_table_visits): several rounds/Orders at the same table, each its
// own KOT, but ONE bill here - Items is already consolidated server-side
// (identical items across rounds summed into one line), same layout as the
// single-order BillReceipt otherwise so a settled table's bill looks like
// every other receipt this app prints.
function TableVisitBillReceipt({ visit, restaurantName, branchName }) {

    const paymentMethod = visit.PaymentMethod;

    return (

        <Box className="bill-receipt-print" sx={{ maxWidth: 420, mx: "auto" }}>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 2 }}>
                <Typography variant="h6" fontWeight={800}>Table Bill</Typography>
                <Typography variant="caption" color="text.secondary">{formatDate(visit.ClosedAt || visit.OpenedAt)}</Typography>
            </Box>

            <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 3, p: 2.5 }}>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2 }}>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Table</Typography>
                        <Typography variant="body2" fontWeight={600}>{visit.TableNumber}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Orders on This Visit</Typography>
                        <Typography variant="body2" fontWeight={600}>{visit.OrderCount}</Typography>
                    </Box>

                </Box>

                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 2 }}>
                    <StorefrontOutlinedIcon sx={{ color: "#4F46E5", mt: 0.25 }} />
                    <Box>
                        <Typography fontWeight={700}>{restaurantName}{branchName ? ` · ${branchName}` : ""}</Typography>
                    </Box>
                </Box>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ pl: 0, color: "text.secondary" }}>Item</TableCell>
                            <TableCell align="right" sx={{ color: "text.secondary" }}>Qty.</TableCell>
                            <TableCell align="right" sx={{ pr: 0, color: "text.secondary" }}>Price</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(visit.Items || []).map((item) => (
                            <TableRow key={`${item.MenuItemId}-${item.FirstOrderItemId}`}>
                                <TableCell sx={{ pl: 0 }}>{item.ItemName}</TableCell>
                                <TableCell align="right">x{item.Quantity}</TableCell>
                                <TableCell align="right" sx={{ pr: 0 }}>{formatMoney(item.TotalPrice)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                        <Typography variant="body2">{formatMoney(visit.SubTotal)}</Typography>
                    </Box>

                    {Number(visit.DiscountAmount) > 0 && (
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">Discount</Typography>
                            <Typography variant="body2" color="success.main">-{formatMoney(visit.DiscountAmount)}</Typography>
                        </Box>
                    )}

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">CGST</Typography>
                        <Typography variant="body2">{formatMoney(visit.CgstAmount)}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">SGST</Typography>
                        <Typography variant="body2">{formatMoney(visit.SgstAmount)}</Typography>
                    </Box>

                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="h6" fontWeight={800} sx={{ color: "#4F46E5" }}>Total Bill</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: "#4F46E5" }}>{formatMoney(visit.TotalAmount)}</Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">Inclusive of CGST + SGST</Typography>
                    <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                </Box>

            </Box>

            <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 3, p: 2.5, mt: 2 }}>

                <Typography fontWeight={700} sx={{ mb: 1.5 }}>Payment Info</Typography>

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

                    <Box>
                        <Typography variant="body2">
                            Paid Amount: <strong>{formatMoney(visit.TotalAmount)}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">By: {paymentMethod || "-"}</Typography>
                    </Box>

                    <Chip
                        label={visit.Status === "Closed" ? "Settled" : "Pending"}
                        size="small"
                        sx={{
                            fontWeight: 700,
                            bgcolor: visit.Status === "Closed" ? "#DCFCE7" : "#FEF3C7",
                            color: visit.Status === "Closed" ? "#15803D" : "#92400E"
                        }}
                    />

                </Box>

            </Box>

        </Box>

    );

}

export default TableVisitBillReceipt;
