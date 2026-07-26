import { useEffect, useRef, useState } from "react";
import {
    Box,
    Chip,
    CircularProgress,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import toast from "react-hot-toast";

import * as inventoryService from "../services/inventoryService";
import StockActionDialog from "./StockActionDialog";

const stockStatus = (row) => {

    const balance = Number(row.CurrentQuantityBase || 0);

    if (balance <= 0) {
        return { label: "Out of Stock", color: "error" };
    }

    if (row.LowStockThreshold !== null && row.LowStockThreshold !== undefined && balance <= Number(row.LowStockThreshold)) {
        return { label: "Low Stock", color: "warning" };
    }

    return { label: "In Stock", color: "success" };

};

function BranchStockTab({ branchId }) {

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");

    const [menuAnchor, setMenuAnchor] = useState(null);
    const [menuTarget, setMenuTarget] = useState(null);

    const [actionMode, setActionMode] = useState(null);
    const [actionTarget, setActionTarget] = useState(null);
    const [saving, setSaving] = useState(false);

    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (branchId) {
            loadStock();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    const loadStock = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await inventoryService.getBranchStock(branchId);

            if (response.success) {
                setRows(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load branch stock.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleOpenMenu = (event, row) => {
        setMenuAnchor(event.currentTarget);
        setMenuTarget(row);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
        setMenuTarget(null);
    };

    const handleOpenAction = (mode) => {
        setActionTarget(menuTarget);
        setActionMode(mode);
        handleCloseMenu();
    };

    const handleCloseAction = () => {
        if (saving) return;
        setActionMode(null);
        setActionTarget(null);
    };

    const handleSaveAction = async (payload) => {

        try {

            setSaving(true);

            const body = { ...payload, branchId };

            const response = actionMode === "opening"
                ? await inventoryService.recordOpeningStock(body)
                : actionMode === "wastage"
                    ? await inventoryService.recordWastage(body)
                    : await inventoryService.recordAdjustment(body);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(
                actionMode === "opening" ? "Opening stock recorded." :
                    actionMode === "wastage" ? "Wastage recorded." : "Adjustment recorded."
            );

            setActionMode(null);
            setActionTarget(null);
            loadStock();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to record stock movement.");

        } finally {

            setSaving(false);

        }

    };

    const filteredRows = rows.filter((row) => row.Name.toLowerCase().includes(searchText.trim().toLowerCase()));

    return (

        <Box>

            <TextField
                size="small"
                placeholder="Search ingredients..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                sx={{ mb: 2, minWidth: 260 }}
            />

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>

                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Ingredient</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Current Balance</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : filteredRows.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">
                                            {rows.length === 0 ? "No ingredients yet - add one under the Ingredients tab first." : "No ingredients match your search."}
                                        </Typography>
                                    </TableCell>
                                </TableRow>

                            ) : (

                                filteredRows.map((row) => {

                                    const status = stockStatus(row);

                                    return (

                                        <TableRow key={row.IngredientId} hover>

                                            <TableCell>
                                                <Typography fontWeight={600}>{row.Name}</Typography>
                                            </TableCell>

                                            <TableCell>{row.Category || "-"}</TableCell>

                                            <TableCell align="right">
                                                <Typography sx={{ fontVariantNumeric: "tabular-nums" }}>
                                                    {Number(row.CurrentQuantityBase || 0)} {row.BaseUnit}
                                                </Typography>
                                            </TableCell>

                                            <TableCell>
                                                <Chip label={status.label} color={status.color} size="small" />
                                            </TableCell>

                                            <TableCell align="right">
                                                <IconButton size="small" onClick={(event) => handleOpenMenu(event, row)}>
                                                    <MoreVertRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>

                                        </TableRow>

                                    );

                                })

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            </Paper>

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleCloseMenu}>

                <MenuItem onClick={() => handleOpenAction("opening")}>
                    <ListItemIcon><Inventory2OutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Record Opening Stock</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleOpenAction("wastage")}>
                    <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Record Wastage</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleOpenAction("adjustment")}>
                    <ListItemIcon><TuneRoundedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Record Adjustment</ListItemText>
                </MenuItem>

            </Menu>

            <StockActionDialog
                open={Boolean(actionMode)}
                mode={actionMode}
                ingredient={actionTarget}
                currentBalance={actionTarget?.CurrentQuantityBase}
                onClose={handleCloseAction}
                onSave={handleSaveAction}
                saving={saving}
            />

        </Box>

    );

}

export default BranchStockTab;
