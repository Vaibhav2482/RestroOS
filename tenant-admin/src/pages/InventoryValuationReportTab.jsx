import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import toast from "react-hot-toast";

import * as inventoryService from "../services/inventoryService";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

function InventoryValuationReportTab({ branchId }) {

    const [items, setItems] = useState([]);
    const [totalValue, setTotalValue] = useState(0);
    const [ingredientsMissingCost, setIngredientsMissingCost] = useState(0);
    const [loading, setLoading] = useState(true);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (branchId) {
            loadReport();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    const loadReport = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await inventoryService.getValuation(branchId);

            if (response.success) {
                setItems(response.data.items);
                setTotalValue(response.data.totalValue);
                setIngredientsMissingCost(response.data.ingredientsMissingCost);
            } else {
                toast.error(response.message || "Failed to load inventory valuation.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load inventory valuation.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleExport = () => {

        downloadCsv(
            "inventory-valuation.csv",
            ["Ingredient", "Current Balance", "Cost per Unit", "Stock Value"],
            items.map((row) => [
                row.Name,
                `${Number(row.CurrentQuantityBase)} ${row.BaseUnit}`,
                row.CostPerBaseUnit !== null ? Number(row.CostPerBaseUnit).toFixed(4) : "Not set",
                row.StockValue !== null ? Number(row.StockValue).toFixed(2) : "Unknown"
            ])
        );

    };

    return (

        <Box>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", mb: 2 }}>

                <Paper elevation={0} sx={{ p: 2, border: "1px solid #E5E7EB" }}>
                    <Typography variant="caption" color="text.secondary">Total Stock Value</Typography>
                    <Typography variant="h6" fontWeight={700}>{formatCurrency(totalValue)}</Typography>
                </Paper>

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={items.length === 0}>
                    Export CSV
                </Button>

            </Box>

            {ingredientsMissingCost > 0 && (

                <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mb: 2 }}>
                    {ingredientsMissingCost} ingredient{ingredientsMissingCost === 1 ? "" : "s"} {ingredientsMissingCost === 1 ? "has" : "have"} no cost set -
                    the total above excludes {ingredientsMissingCost === 1 ? "it" : "them"}.
                </Alert>

            )}

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Ingredient</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Current Balance</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Cost per Unit</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Stock Value</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : items.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={4} sx={{ py: 0 }}>
                                        <EmptyState icon={<Inventory2OutlinedIcon />} title="No ingredients yet" description="Add ingredients under Inventory to see their stock value here." />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                items.map((row) => (

                                    <TableRow key={row.IngredientId} hover>
                                        <TableCell>{row.Name}</TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                            {Number(row.CurrentQuantityBase)} {row.BaseUnit}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.CostPerBaseUnit !== null ? `₹${Number(row.CostPerBaseUnit).toFixed(2)}/${row.BaseUnit}` : "-"}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.StockValue !== null ? formatCurrency(row.StockValue) : "-"}
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

export default InventoryValuationReportTab;
