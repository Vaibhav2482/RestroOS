import { useEffect, useRef, useState } from "react";
import {
    AppBar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Toolbar,
    Typography,
    Paper
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { getAllTenants, createTenant } from "../services/tenantService";
import { clearStoredAuth, getStoredAuth } from "../utils/platformAuth";
import TenantDialog from "./TenantDialog";

function Tenants() {

    const navigate = useNavigate();
    const auth = getStoredAuth();

    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

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

            toast.success(response.message);
            setDialogOpen(false);
            await loadTenants();
            return true;

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to create tenant.");
            return false;

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
                                </TableRow>

                            </TableHead>

                            <TableBody>

                                {tenants.length === 0 ? (

                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
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

        </Box>

    );

}

export default Tenants;
