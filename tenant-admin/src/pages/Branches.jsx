import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import toast from "react-hot-toast";

import * as branchService from "../services/branchService";

const emptyForm = {
    branchName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: ""
};

function BranchDialog({ open, onClose, onSave, editingBranch, saving }) {

    const [formData, setFormData] = useState(emptyForm);
    const [error, setError] = useState("");

    const isEditMode = Boolean(editingBranch);

    useEffect(() => {

        if (open && editingBranch) {

            setFormData({
                branchName: editingBranch.BranchName ?? "",
                address: editingBranch.Address ?? "",
                city: editingBranch.City ?? "",
                state: editingBranch.State ?? "",
                pincode: editingBranch.Pincode ?? "",
                phone: editingBranch.Phone ?? ""
            });

        } else if (open) {

            setFormData(emptyForm);

        }

        setError("");

    }, [open, editingBranch]);

    const handleChange = (event) => {
        setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = () => {

        if (!formData.branchName.trim()) {
            setError("Branch name is required.");
            return;
        }

        onSave(formData);

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ fontWeight: 700 }}>
                {isEditMode ? "Edit Branch" : "Add Branch"}
            </DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            required
                            label="Branch Name"
                            name="branchName"
                            value={formData.branchName}
                            onChange={handleChange}
                            error={Boolean(error)}
                            helperText={error}
                        />
                    </Grid>

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            label="Address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            multiline
                            rows={2}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth
                            label="City"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth
                            label="State"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth
                            label="Pincode"
                            name="pincode"
                            value={formData.pincode}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            label="Phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                        />
                    </Grid>

                </Grid>

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? "Saving..." : isEditMode ? "Save Changes" : "Create Branch"}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

function Branches() {

    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {

        loadBranches();

    }, []);

    const loadBranches = async () => {

        try {

            setLoading(true);

            const response = await branchService.getAllBranches();

            if (response.success) {
                setBranches(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load branches.");

        } finally {

            setLoading(false);

        }

    };

    const handleOpenCreate = () => {
        setEditingBranch(null);
        setDialogOpen(true);
    };

    const handleOpenEdit = (branch) => {
        setEditingBranch(branch);
        setDialogOpen(true);
    };

    const handleClose = () => {
        setDialogOpen(false);
        setEditingBranch(null);
    };

    const handleSave = async (formData) => {

        try {

            setSaving(true);

            const response = editingBranch
                ? await branchService.updateBranch(editingBranch.BranchId, formData)
                : await branchService.createBranch(formData);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(editingBranch ? "Branch updated." : "Branch created.");
            handleClose();
            loadBranches();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to save branch.");

        } finally {

            setSaving(false);

        }

    };

    const handleDeactivate = async (branch) => {

        if (!window.confirm(`Deactivate "${branch.BranchName}"? It will stop appearing as an option for new orders.`)) {
            return;
        }

        try {

            const response = await branchService.deactivateBranch(branch.BranchId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Branch deactivated.");
            loadBranches();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to deactivate branch.");

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Box>
                    <Typography variant="h5" fontWeight={700}>Branches</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage the outlets that belong to your restaurant.
                    </Typography>
                </Box>

                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenCreate}>
                    Add Branch
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>

                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Branch Name</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>City</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
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

                            ) : branches.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">No branches yet. Add your first branch to get started.</Typography>
                                    </TableCell>
                                </TableRow>

                            ) : (

                                branches.map((branch) => (

                                    <TableRow key={branch.BranchId} hover>

                                        <TableCell>
                                            <Typography fontWeight={600}>{branch.BranchName}</Typography>
                                            {branch.Address && (
                                                <Typography variant="caption" color="text.secondary">
                                                    {branch.Address}
                                                </Typography>
                                            )}
                                        </TableCell>

                                        <TableCell>{branch.City || "-"}</TableCell>

                                        <TableCell>{branch.Phone || "-"}</TableCell>

                                        <TableCell>
                                            <Chip
                                                label={branch.IsActive ? "Active" : "Inactive"}
                                                color={branch.IsActive ? "success" : "default"}
                                                size="small"
                                            />
                                        </TableCell>

                                        <TableCell align="right">

                                            <IconButton size="small" onClick={() => handleOpenEdit(branch)}>
                                                <EditOutlinedIcon fontSize="small" />
                                            </IconButton>

                                            <IconButton
                                                size="small"
                                                color="error"
                                                disabled={!branch.IsActive}
                                                onClick={() => handleDeactivate(branch)}
                                            >
                                                <DeleteOutlineRoundedIcon fontSize="small" />
                                            </IconButton>

                                        </TableCell>

                                    </TableRow>

                                ))

                            )}

                        </TableBody>

                    </Table>

                </TableContainer>

            </Paper>

            <BranchDialog
                open={dialogOpen}
                onClose={handleClose}
                onSave={handleSave}
                editingBranch={editingBranch}
                saving={saving}
            />

        </Box>

    );

}

export default Branches;
