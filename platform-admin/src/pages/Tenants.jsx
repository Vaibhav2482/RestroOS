import { useEffect, useRef, useState } from "react";
import {
    AppBar,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    InputAdornment,
    Toolbar,
    Tooltip,
    Typography,
    Paper
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { getAllTenants, createTenant, resetOwnerPassword, suspendTenant, reactivateTenant } from "../services/tenantService";
import { clearStoredAuth, getStoredAuth } from "../utils/platformAuth";
import TenantDialog from "./TenantDialog";
import TemporaryPasswordDialog from "./TemporaryPasswordDialog";
import TenantFeaturesDialog from "./TenantFeaturesDialog";

function Tenants() {

    const navigate = useNavigate();
    const auth = getStoredAuth();

    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    // Distinct from "tenants is an empty array" - without this, a failed
    // load (network blip, backend down, stale/wrong-role token) rendered
    // the exact same "No tenants yet" empty state as a genuinely empty
    // platform, with nothing left once the 2.5s toast faded to tell an
    // operator those are two very different situations.
    const [loadError, setLoadError] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmResetTenant, setConfirmResetTenant] = useState(null);
    const [resettingTenantId, setResettingTenantId] = useState(null);
    const [credentialResult, setCredentialResult] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [retrying, setRetrying] = useState(false);
    const [confirmStatusTenant, setConfirmStatusTenant] = useState(null);
    const [updatingStatusId, setUpdatingStatusId] = useState(null);
    const [featuresTenant, setFeaturesTenant] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Only the first load shows the blocking spinner - reloading after
    // onboarding a tenant keeps the existing table visible instead of
    // blanking the page out.
    const hasLoadedRef = useRef(false);

    useEffect(() => {

        loadTenants();

    }, []);

    const loadTenants = async () => {

        try {

            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const response = await getAllTenants();

            if (response.success) {
                setTenants(response.data);
                setLoadError(false);
            } else {
                setLoadError(true);
                toast.error(response.message || "Failed to load tenants.");
            }

        } catch {

            setLoadError(true);
            toast.error("Failed to load tenants.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

        }

    };

    const handleRetry = async () => {

        setRetrying(true);

        try {
            await loadTenants();
        } finally {
            setRetrying(false);
        }

    };

    const handleCreate = async (formData) => {

        try {

            const response = await createTenant(formData);

            if (!response.success) {
                toast.error(response.message);
                return false;
            }

            setDialogOpen(false);
            // The owner's one-time login password lives in this response and
            // nowhere else retrievable - hand it off to the same dialog the
            // reset-password action uses instead of letting the toast (which
            // doesn't include it) be the only feedback.
            setCredentialResult({
                email: response.data.ownerAdmin.email,
                temporaryPassword: response.data.ownerAdmin.temporaryPassword
            });
            await loadTenants();
            return true;

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create tenant.");
            return false;

        }

    };

    const handleResetPassword = async (tenant) => {

        try {

            setResettingTenantId(tenant.TenantId);

            const response = await resetOwnerPassword(tenant.TenantId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            setCredentialResult({ email: response.data.email, temporaryPassword: response.data.temporaryPassword });

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to reset password.");

        } finally {

            setResettingTenantId(null);
            setConfirmResetTenant(null);

        }

    };

    const handleToggleStatus = async (tenant) => {

        try {

            setUpdatingStatusId(tenant.TenantId);

            const response = tenant.IsActive
                ? await suspendTenant(tenant.TenantId)
                : await reactivateTenant(tenant.TenantId);

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            setTenants((prev) => prev.map((row) => (row.TenantId === tenant.TenantId ? response.data : row)));
            toast.success(response.message);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to update restaurant status.");

        } finally {

            setUpdatingStatusId(null);
            setConfirmStatusTenant(null);

        }

    };

    const handleFeaturesSaved = (updatedTenant) => {
        setTenants((prev) => prev.map((row) => (row.TenantId === updatedTenant.TenantId ? updatedTenant : row)));
    };

    const handleLogout = () => {
        clearStoredAuth();
        navigate("/login");
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredTenants = tenants.filter((tenant) => {

        const matchesStatus = statusFilter === "all" || (statusFilter === "active") === tenant.IsActive;

        const matchesQuery = !normalizedQuery || [tenant.TenantName, tenant.Slug, tenant.OwnerEmail]
            .some((field) => field?.toLowerCase().includes(normalizedQuery));

        return matchesStatus && matchesQuery;

    });

    const pagedTenants = filteredTenants.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleStatusFilterChange = (event) => {
        setStatusFilter(event.target.value);
        setPage(0);
    };

    return (

        <Box>

            <AppBar
                position="sticky"
                color="inherit"
                elevation={0}
                sx={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}
            >

                <Toolbar>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1, color: "#4F46E5" }}>
                        <RestaurantRoundedIcon />
                        <Typography variant="h6" fontWeight={800} sx={{ color: "inherit" }}>
                            RestroOS
                        </Typography>
                        <Chip label="Platform Admin" size="small" sx={{ ml: 1, fontWeight: 600, display: { xs: "none", sm: "flex" } }} />

                        {!loading && (
                            <Chip
                                label={`${tenants.length} Restaurant${tenants.length === 1 ? "" : "s"}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontWeight: 600, display: { xs: "none", md: "flex" } }}
                            />
                        )}
                    </Box>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        sx={{ display: { xs: "none", sm: "block" }, maxWidth: 240, mr: 1.5 }}
                    >
                        {auth?.admin?.Email}
                    </Typography>

                    <IconButton
                        onClick={(event) => setMenuAnchor(event.currentTarget)}
                        sx={{
                            p: 0.5,
                            transition: "box-shadow .15s",
                            "&:hover": { boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.15)" }
                        }}
                    >
                        <Avatar sx={{ bgcolor: "#4F46E5", width: 36, height: 36 }}>
                            {auth?.admin?.Email?.[0]?.toUpperCase() || "A"}
                        </Avatar>
                    </IconButton>

                    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>

                        <MenuItem disabled sx={{ opacity: "1 !important" }}>
                            <Typography variant="body2" fontWeight={600}>{auth?.admin?.Email}</Typography>
                        </MenuItem>

                        <Divider />

                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
                            Log Out
                        </MenuItem>

                    </Menu>

                </Toolbar>

            </AppBar>

            <Container maxWidth="lg" sx={{ py: 4 }}>

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>

                    <Typography variant="h4">Tenants</Typography>

                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialogOpen(true)}>
                        Onboard Restaurant
                    </Button>

                </Box>

                {!loading && tenants.length > 0 && (

                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>

                        <TextField
                            size="small"
                            placeholder="Search by name, slug, or owner email"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            sx={{ minWidth: 280, flexGrow: 1 }}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchRoundedIcon fontSize="small" />
                                        </InputAdornment>
                                    )
                                }
                            }}
                        />

                        <TextField
                            select
                            size="small"
                            label="Status"
                            value={statusFilter}
                            onChange={handleStatusFilterChange}
                            sx={{ minWidth: 140 }}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                        </TextField>

                    </Box>

                )}

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress />
                    </Box>

                ) : (

                    <TableContainer component={Paper}>

                        <Table>

                            <TableHead>

                                <TableRow>
                                    <TableCell>Restaurant</TableCell>
                                    <TableCell>Slug</TableCell>
                                    <TableCell>Owner Email</TableCell>
                                    <TableCell>Plan</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Onboarded</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>

                            </TableHead>

                            <TableBody>

                                {loadError && tenants.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                            <Typography color="error.main" sx={{ mb: 1.5 }}>
                                                Couldn't load tenants.
                                            </Typography>
                                            <Button size="small" variant="outlined" onClick={handleRetry} disabled={retrying} startIcon={retrying ? <CircularProgress size={14} /> : null}>
                                                {retrying ? "Retrying..." : "Retry"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>

                                ) : tenants.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">
                                                No tenants yet. Onboard your first restaurant to get started.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>

                                ) : filteredTenants.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">
                                                No restaurants match your search or filter.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    pagedTenants.map((tenant) => (

                                        <TableRow key={tenant.TenantId} hover>
                                            <TableCell sx={{ maxWidth: 220, overflowWrap: "anywhere" }}>{tenant.TenantName}</TableCell>
                                            <TableCell sx={{ maxWidth: 160, overflowWrap: "anywhere" }}>{tenant.Slug}</TableCell>
                                            <TableCell sx={{ maxWidth: 220, overflowWrap: "anywhere" }}>{tenant.OwnerEmail}</TableCell>
                                            <TableCell>
                                                <Chip label={tenant.PlanType} size="small" />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={tenant.IsActive ? "Active" : "Inactive"}
                                                    color={tenant.IsActive ? "success" : "default"}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{new Date(tenant.CreatedAt).toLocaleDateString()}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Reset owner password">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setConfirmResetTenant(tenant)}
                                                        disabled={resettingTenantId === tenant.TenantId}
                                                        aria-label={`Reset owner password for ${tenant.TenantName}`}
                                                    >
                                                        <LockResetRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={tenant.IsActive ? "Suspend restaurant" : "Reactivate restaurant"}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setConfirmStatusTenant(tenant)}
                                                        disabled={updatingStatusId === tenant.TenantId}
                                                        aria-label={`${tenant.IsActive ? "Suspend" : "Reactivate"} ${tenant.TenantName}`}
                                                    >
                                                        {tenant.IsActive
                                                            ? <BlockRoundedIcon fontSize="small" />
                                                            : <CheckCircleRoundedIcon fontSize="small" />}
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Manage features">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setFeaturesTenant(tenant)}
                                                        aria-label={`Manage features for ${tenant.TenantName}`}
                                                    >
                                                        <TuneRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>

                                    ))

                                )}

                            </TableBody>

                        </Table>

                        {filteredTenants.length > 0 && (

                            <TablePagination
                                component="div"
                                count={filteredTenants.length}
                                page={page}
                                onPageChange={(event, newPage) => setPage(newPage)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(event) => {
                                    setRowsPerPage(Number(event.target.value));
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[10, 25, 50]}
                            />

                        )}

                    </TableContainer>

                )}

            </Container>

            <TenantDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={handleCreate}
            />

            <Dialog
                open={Boolean(confirmResetTenant)}
                onClose={() => {
                    // The Cancel button below is correctly disabled during
                    // the reset request, but Escape/backdrop-click go
                    // through this handler instead and had no equivalent
                    // guard - a stray Escape press mid-request closed the
                    // confirmation dialog while the (uncancellable) reset
                    // kept running, so TemporaryPasswordDialog then appears
                    // moments later with no visible confirmation having
                    // just happened.
                    if (resettingTenantId === confirmResetTenant?.TenantId) {
                        return;
                    }
                    setConfirmResetTenant(null);
                }}
                disableEscapeKeyDown={resettingTenantId === confirmResetTenant?.TenantId}
            >

                <DialogTitle>Reset password?</DialogTitle>

                <DialogContent>
                    <DialogContentText>
                        This immediately invalidates {confirmResetTenant?.OwnerEmail}&apos;s current password for
                        &quot;{confirmResetTenant?.TenantName}&quot;. A new temporary password will be generated and shown once.
                    </DialogContentText>
                </DialogContent>

                <DialogActions>

                    <Button
                        onClick={() => setConfirmResetTenant(null)}
                        disabled={resettingTenantId === confirmResetTenant?.TenantId}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        onClick={() => handleResetPassword(confirmResetTenant)}
                        disabled={resettingTenantId === confirmResetTenant?.TenantId}
                    >
                        {resettingTenantId === confirmResetTenant?.TenantId ? "Resetting..." : "Reset Password"}
                    </Button>

                </DialogActions>

            </Dialog>

            <Dialog
                open={Boolean(confirmStatusTenant)}
                onClose={() => {
                    if (updatingStatusId === confirmStatusTenant?.TenantId) {
                        return;
                    }
                    setConfirmStatusTenant(null);
                }}
                disableEscapeKeyDown={updatingStatusId === confirmStatusTenant?.TenantId}
            >

                <DialogTitle>
                    {confirmStatusTenant?.IsActive ? "Suspend restaurant?" : "Reactivate restaurant?"}
                </DialogTitle>

                <DialogContent>
                    <DialogContentText>
                        {confirmStatusTenant?.IsActive
                            ? `This immediately blocks "${confirmStatusTenant?.TenantName}"'s storefront and staff logins. Reactivating later restores both.`
                            : `This restores "${confirmStatusTenant?.TenantName}"'s storefront and lets staff log in again.`}
                    </DialogContentText>
                </DialogContent>

                <DialogActions>

                    <Button
                        onClick={() => setConfirmStatusTenant(null)}
                        disabled={updatingStatusId === confirmStatusTenant?.TenantId}
                    >
                        Cancel
                    </Button>

                    <Button
                        color={confirmStatusTenant?.IsActive ? "error" : "primary"}
                        onClick={() => handleToggleStatus(confirmStatusTenant)}
                        disabled={updatingStatusId === confirmStatusTenant?.TenantId}
                    >
                        {updatingStatusId === confirmStatusTenant?.TenantId
                            ? "Updating..."
                            : confirmStatusTenant?.IsActive ? "Suspend" : "Reactivate"}
                    </Button>

                </DialogActions>

            </Dialog>

            <TemporaryPasswordDialog
                open={Boolean(credentialResult)}
                onClose={() => setCredentialResult(null)}
                email={credentialResult?.email}
                password={credentialResult?.temporaryPassword}
            />

            <TenantFeaturesDialog
                open={Boolean(featuresTenant)}
                tenant={featuresTenant}
                onClose={() => setFeaturesTenant(null)}
                onSaved={handleFeaturesSaved}
            />

        </Box>

    );

}

export default Tenants;
