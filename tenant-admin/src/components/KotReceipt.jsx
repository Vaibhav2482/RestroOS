import { Box, Divider, Typography } from "@mui/material";

function formatTime(dateString) {

    const date = dateString ? new Date(dateString) : new Date();

    return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit"
    });

}

// Kitchen-facing ticket - deliberately carries no prices (the kitchen
// doesn't need them and showing money on a ticket that's often pinned up
// or handed to a stranger is bad practice) and leads with order type/table
// in large type since that's the single fact a busy line cook needs first,
// same convention as a KOT off any commercial POS.
function KotReceipt({ order, restaurantName, kotNumber }) {

    const isDineIn = order.DeliveryType === "Dine In";
    const totalItems = (order.Items || []).reduce((sum, item) => sum + Number(item.Quantity || 0), 0);

    return (

        <Box className="kot-receipt-print" sx={{ maxWidth: 380, mx: "auto" }}>

            <Box sx={{ textAlign: "center", mb: 2 }}>
                <Typography variant="overline" sx={{ letterSpacing: 2, color: "text.secondary" }}>
                    Kitchen Order Ticket
                </Typography>
                <Typography variant="h6" fontWeight={800}>{restaurantName}</Typography>
                {order.BranchName && (
                    <Typography variant="body2" color="text.secondary">{order.BranchName}</Typography>
                )}
            </Box>

            <Box sx={{ border: "1px dashed #9CA3AF", borderRadius: 2, p: 2, mb: 2, textAlign: "center" }}>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: 0.5 }}>
                    {isDineIn ? `TABLE ${order.TableNumber}` : (order.DeliveryType || "").toUpperCase()}
                </Typography>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="body2" fontWeight={700}>KOT #{kotNumber ?? order.OrderId}</Typography>
                <Typography variant="body2" color="text.secondary">{formatTime(order.OrderDate)}</Typography>
            </Box>

            <Divider sx={{ borderStyle: "dashed", mb: 1.5 }} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

                {(order.Items || []).map((item, index) => (

                    <Box key={item.OrderItemId ?? index} sx={{ display: "flex", gap: 1.5 }}>

                        <Typography fontWeight={800} sx={{ minWidth: 32 }}>{item.Quantity}x</Typography>

                        <Box>
                            <Typography fontWeight={700}>{item.ItemName}</Typography>
                            {item.SelectedOptions?.length > 0 && (
                                <Typography variant="caption" color="text.secondary" component="div">
                                    {item.SelectedOptions.map((option) => option.OptionName).join(", ")}
                                </Typography>
                            )}
                        </Box>

                    </Box>

                ))}

            </Box>

            {order.OrderNotes && (

                <Box sx={{ mt: 2, p: 1.5, bgcolor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={700}>Note</Typography>
                    <Typography variant="body2">{order.OrderNotes}</Typography>
                </Box>

            )}

            <Divider sx={{ borderStyle: "dashed", mt: 2, mb: 1 }} />

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center" }}>
                {totalItems} item{totalItems === 1 ? "" : "s"} total
            </Typography>

        </Box>

    );

}

export default KotReceipt;
