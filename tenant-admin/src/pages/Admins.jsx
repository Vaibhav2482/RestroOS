import { useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormGroup,
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
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import toast from "react-hot-toast";

import * as adminService from "../services/adminService";
import * as branchService from "../services/branchService";
import { getStoredAuth, isFeatureEnabled } from "../utils/adminAuth";
import { CORE_PERMISSION_KEYS, GRANTABLE_PERMISSIONS } from "../utils/permissions";
import EmptyState from "../components/EmptyState";

const OWNER_VALUE = "owner";

// A new Branch Admin starts with the "core" screens already checked - the
// operational access they'd have had unconditionally before this list
// existed. An Owner can still uncheck any of them; they just don't start
// from a blank slate that would otherwise lock a new hire out of Orders/
// Menu/etc until someone remembers to go grant everything by hand.
const emptyForm = {
    fullName: "",
    email: "",
    password: "",
    branchId: OWNER_VALUE,
    isActive: true,
    permissions: [...CORE_PERMISSION_KEYS]
};

function AdminDialog({ open, onClose, onSave, editingAdmin, branches, saving }) {

    const [formData, setFormData] = useState(emptyForm);
    const [errors, setErrors] = useState({});

    // A platform admin's tenant-wide Features toggle is the outer boundary -
    // granting a permission here that's disabled at that level would do
    // nothing (the backend checks disabledFeatures before Permissions
    // either way, see requirePermission in middleware/Auth.js), so it's
    // left out of the checklist entirely rather than shown as a checkbox
    // that silently can't take effect.
    const { admin: ownAdmin } = getStoredAuth() || {};
    const grantablePermissions = GRANTABLE_PERMISSIONS.filter((permission) => isFeatureEnabled(ownAdmin, permission.key));
    const permissionGroups = [...new Set(grantablePermissions.map((permission) => permission.group))];

    const isEditMode = Boolean(editingAdmin);

    useEffect(() => {

        if (open && editingAdmin) {

            setFormData({
                fullName: editingAdmin.FullName ?? "",
                email: editingAdmin.Email ?? "",
                password: "",
                branchId: editingAdmin.BranchId ?? OWNER_VALUE,
                isActive: editingAdmin.IsActive,
                permissions: editingAdmin.Permissions ?? []
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

    const handlePermissionToggle = (key) => {

        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(key)
                ? prev.permissions.filter((existing) => existing !== key)
                : [...prev.permissions, key]
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

        // Sent as empty for an Owner so a later demotion to Branch Admin
        // doesn't resurrect whatever was left checked from before.
        const permissions = branchId ? formData.permissions : [];

        if (isEditMode) {

            onSave({
                fullName: formData.fullName.trim(),
                branchId,
                isActive: formData.isActive,
                permissions
            });

        } else {

            onSave({
                fullName: formData.fullName.trim(),
                email: formData.email.trim(),
                password: formData.password,
                branchId,
                permissions
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

                    {formData.branchId !== OWNER_VALUE && (

                        <Grid size={12}>

                            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                                Screen & Feature Permissions
                            </Typography>

                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                                Every screen a Branch Admin can reach is controlled here. Uncheck anything they shouldn't see or act on.
                            </Typography>

                            {permissionGroups.map((group) => (

                                <Box key={group} sx={{ mb: 1.5 }}>

                                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                                        {group.toUpperCase()}
                                    </Typography>

                                    <FormGroup>

                                        {grantablePermissions.filter((permission) => permission.group === group).map((permission) => (

                                            <FormControlLabel
                                                key={permission.key}
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={formData.permissions.includes(permission.key)}
                                                        onChange={() => handlePermissionToggle(permission.key)}
                                                    />
                                                }
                                                label={permission.label}
                                            />

                                        ))}

                                    </FormGroup>

                                </Box>

                            ))}

                        </Grid>

                    )}

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

    // Client-side paging over the already-fetched list - the backend has
    // no page/limit param on GET /admins.
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

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
                                <TableCell sx={{ fontWeight: 600 }}>Permissions</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                            </TableRow>

                        </TableHead>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                        <CircularProgress size={28} />
                                    </TableCell>
                                </TableRow>

                            ) : admins.length === 0 ? (

                                <TableRow>
                                    <TableCell colSpan={6} sx={{ py: 0 }}>
                                        <EmptyState
                                            icon={<GroupOutlinedIcon />}
                                            title="No staff yet"
                                            description="Add your first team member to get started."
                                        />
                                    </TableCell>
                                </TableRow>

                            ) : (

                                admins.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((admin) => {

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
                                                {!admin.BranchId ? (
                                                    <Typography variant="body2" color="text.secondary">All (Owner)</Typography>
                                                ) : admin.Permissions?.length > 0 ? (
                                                    <Tooltip
                                                        title={admin.Permissions
                                                            .map((key) => GRANTABLE_PERMISSIONS.find((permission) => permission.key === key)?.label ?? key)
                                                            .join(", ")}
                                                    >
                                                        <Chip
                                                            size="small"
                                                            variant="outlined"
                                                            label={`${admin.Permissions.length} of ${GRANTABLE_PERMISSIONS.length}`}
                                                        />
                                                    </Tooltip>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">None</Typography>
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

                {admins.length > 0 && (

                    <TablePagination
                        component="div"
                        count={admins.length}
                        page={page}
                        onPageChange={(event, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(Number(event.target.value));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                    />

                )}

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
