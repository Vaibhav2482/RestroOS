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
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { defaultDateRange } from "../utils/dateRange";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

function CouponUsageReportTab({ branchId }) {

    const [range, setRange] = useState(() => defaultDateRange(30));
    const [coupons, setCoupons] = useState([]);
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

            const response = await analyticsService.getCouponUsage(branchId, range.from, range.to);

            if (response.success) {
                setCoupons(response.data);
            } else {
                toast.error(response.message || "Failed to load coupon usage.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load coupon usage.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleExport = () => {

        downloadCsv(
            `coupon-usage_${range.from}_to_${range.to}.csv`,
            ["Coupon Code", "Times Used", "Total Discount Given", "Revenue From Orders"],
            coupons.map((row) => [
                row.Code, row.TimesUsed, Number(row.TotalDiscount).toFixed(2), Number(row.RevenueFromOrders).toFixed(2)
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

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={coupons.length === 0}>
                    Export CSV
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Coupon Code</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Times Used</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Total Discount Given</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Revenue From Orders</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : coupons.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={4} sx={{ py: 0 }}>
                                        <EmptyState icon={<LocalOfferOutlinedIcon />} title="No coupons used in this range" description="Try widening the date range." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                coupons.map((row) => (

                                    <TableRow key={row.CouponId} hover>
                                        <TableCell>{row.Code}</TableCell>
                                        <TableCell align="right">{row.TimesUsed}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.TotalDiscount)}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.RevenueFromOrders)}</TableCell>
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

export default CouponUsageReportTab;
