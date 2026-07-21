import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import toast from "react-hot-toast";

import * as tableService from "../services/tableService";
import * as branchService from "../services/branchService";
import { getStoredAuth, isOwner } from "../utils/adminAuth";
import TableDialog from "./TableDialog";

function Tables() {

    const auth = getStoredAuth();
    const owner = isOwner(auth?.admin);

    const [branches, setBranches] = useState([]);
    const [selectedBranchId, setSelectedBranchId] = useState(owner ? "" : auth?.admin?.BranchId ?? "");
    const [branchesLoading, setBranchesLoading] = useState(owner);

    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);

    const [deactivateTarget, setDeactivateTarget] = useState(null);
    const [deactivating, setDeactivating] = useState(false);

    // Only the first load shows the blocking spinner - reloading after a
    // create/edit/deactivate keeps the existing table visible instead of
    // blanking the page out on every action.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        if (owner) {
            loadBranches();
        } else {
            loadTables();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {

        if (owner && selectedBranchId) {
            loadTables();
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBranchId]);

    const loadBranches = async () => {

        try {

            setBranchesLoading(true);

            const response = await branchService.getAllBranches();

            if (response.success) {

                setBranches(response.data);

                if (response.data.length > 0) {
                    setSelectedBranchId(response.data[0].BranchId);
                } else {
                    setLoading(false);
                }

            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load branches.");

        } finally {

            setBranchesLoading(false);

        }

    };

    const loadTables = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = owner
                ? await tableService.getAllTables(selectedBranchId)
                : await tableService.getAllTables();

            if (response.success) {
                setTables(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load tables.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleCreate = async (payload) => {

        try {

            const branchId = owner ? selectedBranchId : auth?.admin?.BranchId;

            const response = await tableService.createTable({ ...payload, branchId });

            if (response.success) {
                await loadTables();
                toast.success("Table created successfully.");
                setDialogOpen(false);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create table.");

        }

    };

    const handleUpdate = async (payload) => {

        try {

            const response = await tableService.updateTable(selectedTable.TableId, payload);

            if (response.success) {
                await loadTables();
                toast.success("Table updated successfully.");
                setDialogOpen(false);
                setSelectedTable(null);
                setIsEditMode(false);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update table.");

        }

    };

    const handleDeactivate = async () => {

        if (!deactivateTarget) {
            return;
        }

        try {

            setDeactivating(true);

            const response = await tableService.deactivateTable(deactivateTarget.TableId);

            if (response.success) {
                await loadTables();
                toast.success("Table deactivated successfully.");
                setDeactivateTarget(null);
            } else {
                toast.error(response.message);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to deactivate table.");

        } finally {

            setDeactivating(false);

        }

    };

    const openAddDialog = () => {
        setSelectedTable(null);
        setIsEditMode(false);
        setDialogOpen(true);
    };

    const openEditDialog = (table) => {
        setSelectedTable(table);
        setIsEditMode(true);
        setDialogOpen(true);
    };

    const showTableLoading = owner ? (branchesLoading || loading) : loading;

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Box>
                    <Typography variant="h4">
                        Tables
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {owner ? "Manage tables across your branches." : "Manage tables for your branch."}
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>

                    {owner && (

                        <FormControl size="small" sx={{ minWidth: 220 }}>

                            <InputLabel id="branch-select-label">Branch</InputLabel>

                            <Select
                                labelId="branch-select-label"
                                label="Branch"
                                value={selectedBranchId}
                                onChange={(event) => setSelectedBranchId(event.target.value)}
                                disabled={branchesLoading || branches.length === 0}
                            >

                                {branches.map((branch) => (
                                    <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                        {branch.BranchName}
                                    </MenuItem>
                                ))}

                            </Select>

                        </FormControl>

                    )}

                    <Button
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        onClick={openAddDialog}
                        disabled={owner && !selectedBranchId}
                    >
                        Add Table
                    </Button>

                </Box>

            </Box>

            {showTableLoading ? (

                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
                    <CircularProgress />
                </Box>

            ) : owner && branches.length === 0 ? (

                <Paper elevation={0} sx={{ border: "1px solid #E5E7EB", p: 6, textAlign: "center" }}>
                    <Typography color="text.secondary">
                        No branches found. Add a branch first before creating tables.
                    </Typography>
                </Paper>

            ) : (

                <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                    <Table>

                        <TableHead>

                            <TableRow>
                                <TableCell>Table Name</TableCell>
                                {owner && <TableCell>Branch</TableCell>}
                                <TableCell>Capacity</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {tables.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={owner ? 5 : 4} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">
                                            No tables found for this branch.
                                        </Typography>
                                    </TableCell>
                                </TableRow>

                            ) : (

                                tables.map((table) => (

                                    <TableRow key={table.TableId} hover>

                                        <TableCell>
                                            <Typography fontWeight={600}>
                                                {table.TableName}
                                            </Typography>
                                        </TableCell>

                                        {owner && (
                                            <TableCell>
                                                {table.BranchName || "-"}
                                            </TableCell>
                                        )}

                                        <TableCell>
                                            {table.Capacity || "-"}
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={table.IsActive ? "Active" : "Inactive"}
                                                color={table.IsActive ? "success" : "default"}
                                                size="small"
                                            />
                                        </TableCell>

                                        <TableCell align="right">

                                            <Tooltip title="Edit">
                                                <IconButton color="primary" onClick={() => openEditDialog(table)}>
                                                    <EditRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>

                                            <Tooltip title={table.IsActive ? "Deactivate" : "Already inactive"}>
                                                <span>
                                                    <IconButton
                                                        color="error"
                                                        disabled={!table.IsActive}
                                                        onClick={() => setDeactivateTarget(table)}
                                                    >
                                                        <DeleteRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>

                                        </TableCell>

                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            )}

            <TableDialog
                open={dialogOpen}
                onClose={() => {
                    setDialogOpen(false);
                    setSelectedTable(null);
                    setIsEditMode(false);
                }}
                onSave={isEditMode ? handleUpdate : handleCreate}
                selectedTable={selectedTable}
                isEditMode={isEditMode}
            />

            <Dialog open={Boolean(deactivateTarget)} onClose={() => setDeactivateTarget(null)} fullWidth maxWidth="xs">

                <DialogTitle>
                    Deactivate Table
                </DialogTitle>

                <DialogContent>

                    <Typography>
                        Are you sure you want to deactivate <strong>{deactivateTarget?.TableName}</strong>?
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Past orders keep this table on record — it just stops appearing as an
                        option when staff create a new dine-in order.
                    </Typography>

                </DialogContent>

                <DialogActions>

                    <Button onClick={() => setDeactivateTarget(null)} disabled={deactivating}>
                        Cancel
                    </Button>

                    <Button color="error" variant="contained" onClick={handleDeactivate} disabled={deactivating}>
                        Deactivate
                    </Button>

                </DialogActions>

            </Dialog>

        </Box>

    );

}

export default Tables;
