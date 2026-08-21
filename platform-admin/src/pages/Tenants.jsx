import { useEffect, useMemo, useRef, useState } from "react";
import {
    AppBar,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Grid,
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
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import NewReleasesRoundedIcon from "@mui/icons-material/NewReleasesRounded";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { getAllTenants, createTenant, resetOwnerPassword, suspendTenant, reactivateTenant } from "../services/tenantService";
import { clearStoredAuth, getStoredAuth } from "../utils/platformAuth";
import TenantDialog from "./TenantDialog";
import TemporaryPasswordDialog from "./TemporaryPasswordDialog";
import TenantFeaturesDialog from "./TenantFeaturesDialog";
import ChangePasswordDialog from "./ChangePasswordDialog";
import EmptyState from "../components/EmptyState";

// Same visual language as tenant-admin's Dashboard stat cards, so the two
// consoles read as one product rather than two differently-designed apps.
function StatCard({ icon, label, value, color }) {

    return (

        <Card elevation={0} sx={{ border: "1px solid #E5E7EB" }}>

            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>

                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${color}1A`,
                        color,
                        flexShrink: 0
                    }}
                >
                    {icon}
                </Box>

                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>{label}</Typography>
                    <Typography variant="h5" fontWeight={800}>{value}</Typography>
                </Box>

            </CardContent>

        </Card>

    );

}

// Deterministic color per restaurant, purely so the row-identity avatars in
// the table aren't all the same flat purple - picked from the same palette
// family already used across the app rather than random hues.
const AVATAR_PALETTE = ["#4F46E5", "#0F766E", "#B45309", "#BE185D", "#0369A1", "#7C3AED"];

function avatarColorFor(name) {
    const code = (name || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

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
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
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

    const stats = useMemo(() => {

        const now = new Date();

        return {
            total: tenants.length,
            active: tenants.filter((tenant) => tenant.IsActive).length,
            inactive: tenants.filter((tenant) => !tenant.IsActive).length,
            newThisMonth: tenants.filter((tenant) => {
                const createdAt = new Date(tenant.CreatedAt);
                return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
            }).length
        };

    }, [tenants]);

    return (

        <Box>

            <AppBar
                position="sticky"
                color="inherit"
                elevation={0}
                sx={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}
            >

                <Toolbar>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexGrow: 1 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 2.5,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                bgcolor: "#4F46E5",
                                color: "#fff",
                                boxShadow: "0 4px 12px rgba(79,70,229,.35)"
                            }}
                        >
                            <RestaurantRoundedIcon fontSize="small" />
                        </Box>
                        <Typography variant="h6" fontWeight={800} sx={{ color: "#4F46E5" }}>
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

                        <MenuItem onClick={() => { setMenuAnchor(null); setChangePasswordOpen(true); }}>
                            <ListItemIcon><VpnKeyRoundedIcon fontSize="small" /></ListItemIcon>
                            Change Password
                        </MenuItem>

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

                    <Grid container spacing={2} sx={{ mb: 3 }}>

                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<StorefrontRoundedIcon />} label="Total Restaurants" value={stats.total} color="#4F46E5" />
                        </Grid>

                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<CheckCircleRoundedIcon />} label="Active" value={stats.active} color="#22C55E" />
                        </Grid>

                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<BlockRoundedIcon />} label="Inactive" value={stats.inactive} color="#EF4444" />
                        </Grid>

                        <Grid size={{ xs: 6, sm: 3 }}>
                            <StatCard icon={<NewReleasesRoundedIcon />} label="Onboarded This Month" value={stats.newThisMonth} color="#F59E0B" />
                        </Grid>

                    </Grid>

                )}

                {loading ? (

                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress />
                    </Box>

                ) : (

                    <Paper>

                        {tenants.length > 0 && (

                            <>

                                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", p: 2.5 }}>

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

                                <Divider />

                            </>

                        )}

                        <TableContainer>

                        <Table>

                            <TableHead>

                                <TableRow>
                                    <TableCell>Restaurant</TableCell>
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
                                        <TableCell colSpan={6} sx={{ py: 0 }}>
                                            <EmptyState
                                                icon={<ErrorOutlineRoundedIcon />}
                                                title="Couldn't load restaurants"
                                                description="Check your connection and try again."
                                                action={
                                                    <Button size="small" variant="outlined" onClick={handleRetry} disabled={retrying} startIcon={retrying ? <CircularProgress size={14} /> : null}>
                                                        {retrying ? "Retrying..." : "Retry"}
                                                    </Button>
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>

                                ) : tenants.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ py: 0 }}>
                                            <EmptyState
                                                icon={<StorefrontRoundedIcon />}
                                                title="No restaurants yet"
                                                description="Onboard your first restaurant to get started."
                                                action={
                                                    <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialogOpen(true)}>
                                                        Onboard Restaurant
                                                    </Button>
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>

                                ) : filteredTenants.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ py: 0 }}>
                                            <EmptyState
                                                icon={<SearchOffRoundedIcon />}
                                                title="No restaurants match"
                                                description="Try a different search term or status filter."
                                            />
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    pagedTenants.map((tenant) => (

                                        <TableRow key={tenant.TenantId} hover>
                                            <TableCell sx={{ maxWidth: 280 }}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                                    <Avatar
                                                        sx={{
                                                            width: 36,
                                                            height: 36,
                                                            bgcolor: avatarColorFor(tenant.TenantName),
                                                            fontSize: "0.9rem",
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        {tenant.TenantName?.[0]?.toUpperCase() || "?"}
                                                    </Avatar>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                                                            {tenant.TenantName}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                                                            {tenant.Slug}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 220, overflowWrap: "anywhere" }}>{tenant.OwnerEmail}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={tenant.PlanType}
                                                    size="small"
                                                    color={tenant.PlanType === "trial" ? "default" : "primary"}
                                                    variant={tenant.PlanType === "trial" ? "outlined" : "filled"}
                                                />
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

                        </TableContainer>

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

                    </Paper>

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

            <ChangePasswordDialog
                open={changePasswordOpen}
                onClose={() => setChangePasswordOpen(false)}
            />

        </Box>

    );

}

export default Tenants;
