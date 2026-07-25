import { useEffect, useRef, useState } from "react";
import {
    AppBar,
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
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Toolbar,
    Tooltip,
    Typography,
    Paper
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { getAllTenants, createTenant, resetOwnerPassword } from "../services/tenantService";
import { clearStoredAuth, getStoredAuth } from "../utils/platformAuth";
import TenantDialog from "./TenantDialog";
import TemporaryPasswordDialog from "./TemporaryPasswordDialog";

function Tenants() {

    const navigate = useNavigate();
    const auth = getStoredAuth();

    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmResetTenant, setConfirmResetTenant] = useState(null);
    const [resettingTenantId, setResettingTenantId] = useState(null);
    const [credentialResult, setCredentialResult] = useState(null);

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
            }

        } catch {

            toast.error("Failed to load tenants.");

        } finally {

            setLoading(false);
            hasLoadedRef.current = true;

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

    const handleLogout = () => {
        clearStoredAuth();
        navigate("/login");
    };

    return (

        <Box>

            <AppBar position="sticky" elevation={0}>

                <Toolbar>

                    <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, color: "#4F46E5" }}>
                        RestroOS
                    </Typography>

                    <Typography color="text.secondary" sx={{ mr: 2, display: { xs: "none", sm: "block" } }}>
                        {auth?.admin?.Email}
                    </Typography>

                    <Button startIcon={<LogoutRoundedIcon />} onClick={handleLogout}>
                        Logout
                    </Button>

                </Toolbar>

            </AppBar>

            <Container maxWidth="lg" sx={{ py: 4 }}>

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>

                    <Typography variant="h4">Tenants</Typography>

                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialogOpen(true)}>
                        Onboard Restaurant
                    </Button>

                </Box>

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

                                {tenants.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">
                                                No tenants yet. Onboard your first restaurant to get started.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>

                                ) : (

                                    tenants.map((tenant) => (

                                        <TableRow key={tenant.TenantId} hover>
                                            <TableCell>{tenant.TenantName}</TableCell>
                                            <TableCell>{tenant.Slug}</TableCell>
                                            <TableCell>{tenant.OwnerEmail}</TableCell>
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
                                            </TableCell>
                                        </TableRow>

                                    ))

                                )}

                            </TableBody>

                        </Table>

                    </TableContainer>

                )}

            </Container>

            <TenantDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSave={handleCreate}
            />

            <Dialog open={Boolean(confirmResetTenant)} onClose={() => setConfirmResetTenant(null)}>

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

            <TemporaryPasswordDialog
                open={Boolean(credentialResult)}
                onClose={() => setCredentialResult(null)}
                email={credentialResult?.email}
                password={credentialResult?.temporaryPassword}
            />

        </Box>

    );

}

export default Tenants;
