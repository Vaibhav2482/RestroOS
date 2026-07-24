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
import { getStoredAuth } from "../utils/adminAuth";
import { formatCurrency, getStatusChipColor, isToday, isTerminalStatus } from "./orderStatusUtils";

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

    const { admin } = getStoredAuth() || {};

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Only the first load shows the blocking spinner - the periodic
    // background refresh below keeps the existing stats/table visible
    // instead of blanking the page out every time.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        loadOrders();

        // Live-ish view: silently re-check for new orders/status changes
        // without requiring a manual refresh.
        const interval = setInterval(() => {

            if (document.visibilityState === "visible") {
                loadOrders(true);
            }

        }, 15000);

        return () => clearInterval(interval);

    }, []);

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

            {loading ? (

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
                                            <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                                <Typography color="text.secondary">No orders yet.</Typography>
                                            </TableCell>
                                        </TableRow>

                                    ) : (

                                        recentOrders.map((order) => (

                                            <TableRow key={order.OrderId} hover>

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

        </Box>

    );

}

export default Dashboard;
