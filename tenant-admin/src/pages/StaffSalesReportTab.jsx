import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

// Cashier/waiter performance - who's actually taking how many orders and
// how much revenue. A customer's own storefront order has no staff member
// on it at all (CreatedByAdminId null) - grouped here as its own "Customer
// (Online)" row rather than dropped, so this report's total still
// reconciles with Sales Summary's for the same range.
function StaffSalesReportTab({ branchId, range, onRangeChange }) {

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (branchId) {
            loadReport();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, range.from, range.to]);

    const loadReport = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await analyticsService.getStaffSales(branchId, range.from, range.to);

            if (response.success) {
                setRows(response.data);
            } else {
                toast.error(response.message || "Failed to load staff sales.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load staff sales.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleExport = () => {

        downloadCsv(
            `staff-sales_${range.from}_to_${range.to}.csv`,
            ["Staff Member", "Orders", "Revenue", "Avg Order Value"],
            rows.map((row) => [
                row.StaffName,
                row.OrderCount,
                Number(row.Revenue).toFixed(2),
                Number(row.AvgOrderValue).toFixed(2)
            ])
        );

    };

    return (

        <Box>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", mb: 2 }}>

                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>

                    <TextField
                        size="small"
                        type="date"
                        label="From"
                        value={range.from}
                        onChange={(event) => onRangeChange((prev) => ({ ...prev, from: event.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />

                    <TextField
                        size="small"
                        type="date"
                        label="To"
                        value={range.to}
                        onChange={(event) => onRangeChange((prev) => ({ ...prev, to: event.target.value }))}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />

                </Box>

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={rows.length === 0}>
                    Export CSV
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Staff Member</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Orders</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Revenue</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Avg Order Value</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : rows.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={4} sx={{ py: 0 }}>
                                        <EmptyState icon={<BadgeOutlinedIcon />} title="No orders in this range" description="Try widening the date range." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                rows.map((row) => (

                                    <TableRow key={row.CreatedByAdminId ?? "online"} hover>
                                        <TableCell>{row.StaffName}</TableCell>
                                        <TableCell align="right">{row.OrderCount}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.Revenue)}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.AvgOrderValue)}</TableCell>
                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            </Paper>

        </Box>

    );

}

export default StaffSalesReportTab;
