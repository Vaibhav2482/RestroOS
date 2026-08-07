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

// Shared by the on-screen "View Bill" dialog and print output - same layout
// either way, so what staff previews is exactly what prints.
function BillReceipt({ order, restaurantName }) {

    const isCancelled = order.OrderStatus === "Cancelled";

    return (

        <Box className="bill-receipt-print" sx={{ maxWidth: 420, mx: "auto" }}>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 2 }}>
                <Typography variant="h6" fontWeight={800}>Detailed Bill</Typography>
                <Typography variant="caption" color="text.secondary">{formatDate(order.OrderDate)}</Typography>
            </Box>

            <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 3, p: 2.5 }}>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2 }}>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Order ID</Typography>
                        <Typography variant="body2" fontWeight={600}>#{order.OrderId}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Order Type</Typography>
                        <Typography variant="body2" fontWeight={600}>
                            {order.DeliveryType}
                            {order.DeliveryType === "Dine In" && order.TableNumber ? ` (Table ${order.TableNumber})` : ""}
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">Customer</Typography>
                        <Typography variant="body2" fontWeight={600}>{order.CustomerName || "Guest"}</Typography>
                    </Box>

                </Box>

                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 2 }}>
                    <StorefrontOutlinedIcon sx={{ color: "#4F46E5", mt: 0.25 }} />
                    <Box>
                        <Typography fontWeight={700}>{restaurantName}{order.BranchName ? ` · ${order.BranchName}` : ""}</Typography>
                        {order.BranchAddress && (
                            <Typography variant="caption" color="text.secondary" component="div">
                                {[order.BranchAddress, order.BranchCity, order.BranchPincode].filter(Boolean).join(", ")}
                            </Typography>
                        )}
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
                        {(order.Items || []).map((item) => (
                            <TableRow key={item.OrderItemId}>
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
                        <Typography variant="body2">{formatMoney(order.SubTotal)}</Typography>
                    </Box>

                    {Number(order.DiscountAmount) > 0 && (
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography variant="body2" color="text.secondary">Discount</Typography>
                            <Typography variant="body2" color="success.main">-{formatMoney(order.DiscountAmount)}</Typography>
                        </Box>
                    )}

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">CGST</Typography>
                        <Typography variant="body2">{formatMoney(order.CgstAmount)}</Typography>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography variant="body2" color="text.secondary">SGST</Typography>
                        <Typography variant="body2">{formatMoney(order.SgstAmount)}</Typography>
                    </Box>

                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="h6" fontWeight={800} sx={{ color: "#4F46E5" }}>Total Bill</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: "#4F46E5" }}>{formatMoney(order.TotalAmount)}</Typography>
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
                            Paid Amount: <strong>{formatMoney(order.TotalAmount)}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">By: {order.PaymentMethod || "-"}</Typography>
                    </Box>

                    <Chip
                        label={isCancelled ? "Cancelled" : "Success"}
                        size="small"
                        sx={{
                            fontWeight: 700,
                            bgcolor: isCancelled ? "#FEE2E2" : "#DCFCE7",
                            color: isCancelled ? "#B91C1C" : "#15803D"
                        }}
                    />

                </Box>

            </Box>

        </Box>

    );

}

export default BillReceipt;
