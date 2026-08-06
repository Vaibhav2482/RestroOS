import { useEffect, useRef, useState } from "react";
import { Box, Button, Chip, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RestaurantMenuOutlinedIcon from "@mui/icons-material/RestaurantMenuOutlined";
import toast from "react-hot-toast";

import * as analyticsService from "../services/analyticsService";
import { downloadCsv } from "../utils/csvExport";
import { formatCurrency } from "./orderStatusUtils";
import EmptyState from "../components/EmptyState";

function MenuProfitabilityReportTab({ branchId }) {

    const [items, setItems] = useState([]);
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

            const response = await analyticsService.getMenuProfitability(branchId);

            if (response.success) {
                setItems(response.data);
            } else {
                toast.error(response.message || "Failed to load menu profitability.");
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load menu profitability.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleExport = () => {

        downloadCsv(
            "menu-item-profitability.csv",
            ["Item", "Price", "Ingredient Cost", "Margin", "Margin %"],
            items.map((row) => [
                row.ItemName,
                Number(row.Price).toFixed(2),
                row.IngredientCost !== null ? Number(row.IngredientCost).toFixed(2) : "Unknown",
                row.Margin !== null ? Number(row.Margin).toFixed(2) : "Unknown",
                row.MarginPercent !== null ? `${Number(row.MarginPercent).toFixed(1)}%` : "Unknown"
            ])
        );

    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>

                <Box sx={{ color: "text.secondary", fontSize: 14 }}>
                    Only items with a recipe defined appear here - add one under Menu → Recipe.
                </Box>

                <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={handleExport} disabled={items.length === 0}>
                    Export CSV
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Price</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Ingredient Cost</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Margin</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Margin %</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : items.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={5} sx={{ py: 0 }}>
                                        <EmptyState
                                            icon={<RestaurantMenuOutlinedIcon />}
                                            title="No recipes yet"
                                            description="Add a recipe to a menu item (Menu → Recipe) to see its ingredient cost and margin here."
                                        />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                items.map((row) => (

                                    <TableRow key={row.MenuItemId} hover>
                                        <TableCell>{row.ItemName}</TableCell>
                                        <TableCell align="right">{formatCurrency(row.Price)}</TableCell>
                                        <TableCell align="right">
                                            {row.IngredientCost !== null ? formatCurrency(row.IngredientCost) : "-"}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.Margin !== null ? formatCurrency(row.Margin) : "-"}
                                        </TableCell>
                                        <TableCell align="right">
                                            {row.MarginPercent !== null ? (
                                                <Chip
                                                    size="small"
                                                    label={`${Number(row.MarginPercent).toFixed(1)}%`}
                                                    color={row.MarginPercent >= 50 ? "success" : row.MarginPercent >= 25 ? "warning" : "error"}
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Chip size="small" label="Cost incomplete" variant="outlined" />
                                            )}
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

export default MenuProfitabilityReportTab;
