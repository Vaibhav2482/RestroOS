import { useEffect, useRef, useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import toast from "react-hot-toast";

import * as orderService from "../services/orderService";
import { hasPermission } from "../utils/adminAuth";
import { useStoredAuth } from "../hooks/useStoredAuth";
import { formatCurrency, getStatusChipColor, isToday, isTerminalStatus } from "./orderStatusUtils";
import OrderDetailsDialog from "./OrderDetailsDialog";
import EmptyState from "../components/EmptyState";

function StatCard({ icon, label, value, color }) {

    return (

        <Card elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>

                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${color}1A`,
                        color
                    }}
                >
                    {icon}
                </Box>

                <Box>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="h5" fontWeight={800}>{value}</Typography>
                </Box>

            </CardContent>

        </Card>

    );

}

function Dashboard() {

    const { admin } = useStoredAuth() || {};
    // Dashboard is the mandatory post-login landing page (never gated at
    // the route level, unlike every other screen) - a Branch Admin with
    // manage_orders revoked still needs somewhere to land, so this only
    // skips the order-stats section rather than the whole page.
    const canViewOrders = hasPermission(admin, "manage_orders");

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Only the first load shows the blocking spinner - the periodic
    // background refresh below keeps the existing stats/table visible
    // instead of blanking the page out every time.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (!canViewOrders) {
            setLoading(false);
            return;
        }

        loadOrders();

        // Live-ish view: silently re-check for new orders/status changes
        // without requiring a manual refresh. This still pulls the entire
        // order history just to derive 3 numbers (no lightweight "today"/
        // "summary" endpoint exists - /analytics/overview computes revenue
        // trend/top items/peak hours/COGS too, so it's not cheaper, and it
        // has no "active orders" concept at all). 60s instead of 15s until
        // a real summary endpoint exists is a stopgap, not the real fix.
        const interval = setInterval(() => {

            if (document.visibilityState === "visible") {
                loadOrders(true);
            }

        }, 60000);

        return () => clearInterval(interval);

    }, [canViewOrders]);

    const loadOrders = async (silent = false) => {

        try {

            if (!hasLoadedRef.current && !silent) {
                setLoading(true);
            }

            const response = await orderService.getAllOrders();

            if (response.success) {
                setOrders(response.data);
            } else if (!silent) {
                toast.error(response.message || "Failed to load orders.");
            }

        } catch (error) {

            if (!silent) {
                toast.error(error.response?.data?.message || "Failed to load orders.");
            }

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleRowClick = (orderId) => {
        setSelectedOrderId(orderId);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setSelectedOrderId(null);
    };

    const totalOrders = orders.length;

    const activeOrders = orders.filter((order) => !isTerminalStatus(order.OrderStatus)).length;

    const todaysRevenue = orders
        .filter((order) => isToday(order.OrderDate))
        .reduce((sum, order) => sum + Number(order.TotalAmount || 0), 0);

    const recentOrders = [...orders]
        .sort((a, b) => new Date(b.OrderDate) - new Date(a.OrderDate))
        .slice(0, 5);

    return (

        <Box>

            <Box sx={{ mb: 4 }}>

                <Typography variant="h4">
                    Welcome back, {admin?.FullName || "Admin"}
                </Typography>

                <Typography color="text.secondary">
                    {admin?.tenantName}
                </Typography>

            </Box>

            {!canViewOrders ? (

                <Typography color="text.secondary">
                    You don't have access to order data. Ask your Owner to grant it if you need it.
                </Typography>

            ) : loading ? (

                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress size={28} />
                </Box>

            ) : (

                <>

                    <Grid container spacing={3} sx={{ mb: 4 }}>

                        <Grid size={{ xs: 12, sm: 4 }}>
                            <StatCard
                                icon={<ReceiptLongOutlinedIcon />}
                                label="Total Orders"
                                value={totalOrders}
                                color="#4F46E5"
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 4 }}>
                            <StatCard
                                icon={<PendingActionsOutlinedIcon />}
                                label="Active Orders"
                                value={activeOrders}
                                color="#F59E0B"
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 4 }}>
                            <StatCard
                                icon={<PaidOutlinedIcon />}
                                label="Today's Revenue"
                                value={formatCurrency(todaysRevenue)}
                                color="#0F766E"
                            />
                        </Grid>

                    </Grid>

                    <Typography variant="h6" sx={{ mb: 2 }}>Recent Orders</Typography>

                    <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                        <TableContainer>

                            <Table>

                                <TableHead>

                                    <TableRow>
                                        <TableCell>Order ID</TableCell>
                                        <TableCell>Customer</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Date</TableCell>
                                    </TableRow>

                                </TableHead>

                                <TableBody>

                                    {recentOrders.length === 0 ? (

                                        <TableRow>
                                            <TableCell colSpan={6} sx={{ py: 0 }}>
                                                <EmptyState
                                                    icon={<ReceiptLongOutlinedIcon />}
                                                    title="No orders yet"
                                                    description="Orders will show up here as customers or staff place them."
                                                />
                                            </TableCell>
                                        </TableRow>

                                    ) : (

                                        recentOrders.map((order) => (

                                            <TableRow key={order.OrderId} hover sx={{ cursor: "pointer" }} onClick={() => handleRowClick(order.OrderId)}>

                                                <TableCell>#{order.OrderId}</TableCell>

                                                <TableCell>{order.CustomerName || "Guest"}</TableCell>

                                                <TableCell>
                                                    {order.DeliveryType}
                                                    {order.DeliveryType === "Dine In" && order.TableNumber ? ` (T-${order.TableNumber})` : ""}
                                                </TableCell>

                                                <TableCell align="right">{formatCurrency(order.TotalAmount)}</TableCell>

                                                <TableCell>
                                                    <Chip
                                                        label={order.OrderStatus}
                                                        color={getStatusChipColor(order.OrderStatus)}
                                                        size="small"
                                                    />
                                                </TableCell>

                                                <TableCell>{new Date(order.OrderDate).toLocaleString()}</TableCell>

                                            </TableRow>

                                        ))

                                    )}

                                </TableBody>

                            </Table>

                        </TableContainer>

                    </Paper>

                </>

            )}

            <OrderDetailsDialog
                open={dialogOpen}
                orderId={selectedOrderId}
                onClose={handleDialogClose}
                onChanged={() => loadOrders(true)}
            />

        </Box>

    );

}

export default Dashboard;
