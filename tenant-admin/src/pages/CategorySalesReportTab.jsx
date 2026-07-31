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
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { defaultDateRange } from "../utils/dateRange";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

function CategorySalesReportTab({ branchId }) {

    const [range, setRange] = useState(() => defaultDateRange(30));
    const [categories, setCategories] = useState([]);
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

            const response = await analyticsService.getCategorySales(branchId, range.from, range.to);

            if (response.success) {
                setCategories(response.data);
            } else {
                toast.error(response.message || "Failed to load category sales.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load category sales.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const totalRevenue = categories.reduce((sum, row) => sum + Number(row.Revenue), 0);

    const handleExport = () => {

        downloadCsv(
            `category-sales_${range.from}_to_${range.to}.csv`,
            ["Category", "Quantity Sold", "Revenue", "% of Total"],
            categories.map((row) => [
                row.CategoryName, row.QuantitySold, Number(row.Revenue).toFixed(2),
                totalRevenue > 0 ? `${((Number(row.Revenue) / totalRevenue) * 100).toFixed(1)}%` : "0%"
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
                        onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        size="small"
                        type="date"
                        label="To"
                        value={range.to}
                        onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                </Box>

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={categories.length === 0}>
                    Export CSV
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Quantity Sold</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Revenue</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">% of Total</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : categories.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={4} sx={{ py: 0 }}>
                                        <EmptyState icon={<CategoryOutlinedIcon />} title="No orders in this range" description="Try widening the date range." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                categories.map((row) => (

                                    <TableRow key={row.CategoryId} hover>
                                        <TableCell>{row.CategoryName}</TableCell>
                                        <TableCell align="right">{row.QuantitySold}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.Revenue)}</TableCell>
                                        <TableCell align="right">
                                            {totalRevenue > 0 ? `${((Number(row.Revenue) / totalRevenue) * 100).toFixed(1)}%` : "-"}
                                        </TableCell>
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

export default CategorySalesReportTab;
