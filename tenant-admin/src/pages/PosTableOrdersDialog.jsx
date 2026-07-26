import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import { POS_STATUS_COLOR } from "./posOrderStatus";
import { formatCurrency } from "./orderStatusUtils";

// Shown when a table has more than one still-active order at once (e.g. a
// second round ordered before the first is delivered) - lets staff open
// whichever one they mean instead of only ever reaching the newest, and
// gives them a direct way to start yet another round on the same table.
function PosTableOrdersDialog({ open, table, orders, onSelectOrder, onAddAnotherOrder, onClose }) {

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">

            <DialogTitle>
                Table {table?.TableName} &mdash; {orders.length} Active Orders
            </DialogTitle>

            <DialogContent>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>

                    {orders.map((order) => (

                        <Box
                            key={order.OrderId}
                            onClick={() => onSelectOrder(order.OrderId)}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1.5,
                                p: 1.5,
                                border: "1px solid #E5E7EB",
                                borderRadius: 2,
                                cursor: "pointer",
                                transition: "border-color .15s",
                                "&:hover": { borderColor: "primary.main" }
                            }}
                        >

                            <Box>
                                <Typography fontWeight={600}>Order #{order.OrderId}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {new Date(order.OrderDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </Typography>
                            </Box>

                            <Box sx={{ textAlign: "right" }}>
                                <Chip
                                    label={order.OrderStatus}
                                    color={POS_STATUS_COLOR[order.OrderStatus] || "default"}
                                    size="small"
                                    sx={{ mb: 0.5 }}
                                />
                                <Typography variant="body2" fontWeight={600}>
                                    {formatCurrency(order.TotalAmount)}
                                </Typography>
                            </Box>

                        </Box>

                    ))}

                </Box>

                <Divider sx={{ my: 2 }} />

                <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AddRoundedIcon />}
                    onClick={onAddAnotherOrder}
                >
                    Start Another Order for This Table
                </Button>

            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

        </Dialog>

    );

}

export default PosTableOrdersDialog;
