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
    FormControlLabel,
    Grid,
    IconButton,
    MenuItem,
    Paper,
    Switch,
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

import * as adminService from "../services/adminService";
import * as branchService from "../services/branchService";
import { getStoredAuth } from "../utils/adminAuth";

const OWNER_VALUE = "owner";

const emptyForm = {
    fullName: "",
    email: "",
    password: "",
    branchId: OWNER_VALUE,
    isActive: true
};

function AdminDialog({ open, onClose, onSave, editingAdmin, branches, saving }) {

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState({});

    const isEditMode = Boolean(editingAdmin);

    useEffect(() => {

        if (open && editingAdmin) {

            setFormData({
                fullName: editingAdmin.FullName ?? "",
                email: editingAdmin.Email ?? "",
                password: "",
                branchId: editingAdmin.BranchId ?? OWNER_VALUE,
                isActive: editingAdmin.IsActive
            });

        } else if (open) {

            setFormData(emptyForm);

        }

        setErrors({});

    }, [open, editingAdmin]);

    const handleChange = (event) => {

        const { name, value, checked, type } = event.target;

        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));

    };

    const handleSubmit = () => {

        const nextErrors = {};

        if (!formData.fullName.trim()) {
            nextErrors.fullName = "Full name is required.";
        }

        if (!isEditMode) {

            if (!formData.email.trim()) {
                nextErrors.email = "Email is required.";
            }

            if (!formData.password.trim()) {
                nextErrors.password = "Password is required.";
            }

        }

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        const branchId = formData.branchId === OWNER_VALUE ? null : formData.branchId;

        if (isEditMode) {

            onSave({
                fullName: formData.fullName.trim(),
                branchId,
                isActive: formData.isActive
            });

        } else {

            onSave({
                fullName: formData.fullName.trim(),
                email: formData.email.trim(),
                password: formData.password,
                branchId
            });

        }

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">

            <DialogTitle sx={{ fontWeight: 700 }}>
                {isEditMode ? "Edit Staff" : "Add Staff"}
            </DialogTitle>

            <DialogContent>

                <Grid container spacing={2} sx={{ mt: 0.5 }}>

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            required
                            label="Full Name"
                            name="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            error={Boolean(errors.fullName)}
                            helperText={errors.fullName}
                        />
                    </Grid>

                    {!isEditMode && (

                        <>

                            <Grid size={12}>
                                <TextField
                                    fullWidth
                                    required
                                    type="email"
                                    label="Email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    error={Boolean(errors.email)}
                                    helperText={errors.email}
                                />
                            </Grid>

                            <Grid size={12}>
                                <TextField
                                    fullWidth
                                    required
                                    type="password"
                                    label="Password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    error={Boolean(errors.password)}
                                    helperText={errors.password}
                                />
                            </Grid>

                        </>

                    )}

                    <Grid size={12}>
                        <TextField
                            fullWidth
                            select
                            label="Branch Access"
                            name="branchId"
                            value={formData.branchId}
                            onChange={handleChange}
                        >
                            <MenuItem value={OWNER_VALUE}>Owner (all branches)</MenuItem>
                            {branches.map((branch) => (
                                <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                    {branch.BranchName}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    {isEditMode && (

                        <Grid size={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        name="isActive"
                                        checked={formData.isActive}
                                        onChange={handleChange}
                                    />
                                }
                                label="Active"
                            />
                        </Grid>

                    )}

                </Grid>

            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? "Saving..." : isEditMode ? "Save Changes" : "Create Staff"}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

function Admins() {

    const auth = getStoredAuth();
    const currentAdminId = auth?.admin?.AdminId;

    const [admins, setAdmins] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [saving, setSaving] = useState(false);

    // Only the first load shows the blocking spinner - reloading after a
    // create/edit/deactivate keeps the existing table visible instead of
    // blanking the page out on every action.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        loadAdmins();
        loadBranches();

    }, []);

    const loadAdmins = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await adminService.getAllAdmins();

            if (response.success) {
                setAdmins(response.data);
            }

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to load staff.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const loadBranches = async () => {

        try {

            const response = await branchService.getAllBranches();

            if (response.success) {
                setBranches(response.data);
            }

        } catch {

            // Branch dropdown is a secondary concern; the table itself still works without it.

        }

    };

    const handleOpenCreate = () => {
        setEditingAdmin(null);
        setDialogOpen(true);
    };

    const handleOpenEdit = (admin) => {
        setEditingAdmin(admin);
        setDialogOpen(true);
    };

    const handleClose = () => {
        setDialogOpen(false);
        setEditingAdmin(null);
    };

    const handleSave = async (formData) => {

        try {

            setSaving(true);

            const response = editingAdmin
                ? await adminService.updateAdmin(editingAdmin.AdminId, formData)
                : await adminService.createAdmin(formData);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success(editingAdmin ? "Staff updated." : "Staff created.");
            handleClose();
            loadAdmins();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to save staff.");

        } finally {

            setSaving(false);

        }

    };

    const handleDeactivate = async (admin) => {

        if (!window.confirm(`Deactivate "${admin.FullName}"? They will no longer be able to log in.`)) {
            return;
        }

        try {

            const response = await adminService.deactivateAdmin(admin.AdminId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            toast.success("Staff deactivated.");
            loadAdmins();

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to deactivate staff.");

        }

    };

    return (

        <Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>

                <Box>
                    <Typography variant="h5" fontWeight={700}>Staff</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Manage the admins and branch staff on your account.
                    </Typography>
                </Box>

                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleOpenCreate}>
                    Add Staff
                </Button>

            </Box>

            <Paper elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

                <TableContainer>

                    <Table>

                        <TableHead>

                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Branch</TableCell>
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

                            ) : admins.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">No staff yet. Add your first team member to get started.</Typography>
                                    </TableCell>
                                </TableRow>

                            ) : (

                                admins.map((admin) => {

                                    const isSelf = String(admin.AdminId) === String(currentAdminId);

                                    return (

                                        <TableRow key={admin.AdminId} hover>

                                            <TableCell>
                                                <Typography fontWeight={600}>
                                                    {admin.FullName}
                                                    {isSelf && (
                                                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                                            (you)
                                                        </Typography>
                                                    )}
                                                </Typography>
                                            </TableCell>

                                            <TableCell>{admin.Email}</TableCell>

                                            <TableCell>
                                                {admin.BranchId ? (
                                                    <Chip label={admin.BranchName} size="small" variant="outlined" />
                                                ) : (
                                                    <Chip label="Owner" size="small" color="primary" />
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                <Chip
                                                    label={admin.IsActive ? "Active" : "Inactive"}
                                                    color={admin.IsActive ? "success" : "default"}
                                                    size="small"
                                                />
                                            </TableCell>

                                            <TableCell align="right">

                                                <IconButton size="small" onClick={() => handleOpenEdit(admin)}>
                                                    <EditOutlinedIcon fontSize="small" />
                                                </IconButton>

                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    disabled={!admin.IsActive || isSelf}
                                                    onClick={() => handleDeactivate(admin)}
                                                >
                                                    <DeleteOutlineRoundedIcon fontSize="small" />
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

            <AdminDialog
                open={dialogOpen}
                onClose={handleClose}
                onSave={handleSave}
                editingAdmin={editingAdmin}
                branches={branches}
                saving={saving}
            />

        </Box>

    );

}

export default Admins;
