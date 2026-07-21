import { useState } from "react";
import {
    AppBar,
    Badge,
    Box,
    Button,
    CircularProgress,
    Container,
    Divider,
    IconButton,
    Menu,
    MenuItem,
    Select,
    Toolbar,
    Typography
} from "@mui/material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlineOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import { useStorefront } from "../context/StorefrontContext";
import BottomNav from "./BottomNav";

function Layout({ children }) {

    const navigate = useNavigate();
    const {
        tenantSlug,
        tenant,
        branches,
        selectedBranchId,
        selectBranch,
        isLoggedIn,
        customer,
        logout,
        cartCount,
        loading,
        notFound
    } = useStorefront();

    const [menuAnchor, setMenuAnchor] = useState(null);

    if (loading) {

        return (
            <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress />
            </Box>
        );

    }

    if (notFound) {

        return (
            <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 3, textAlign: "center" }}>
                <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                    Restaurant not found
                </Typography>
                <Typography color="text.secondary">
                    "{tenantSlug}" doesn't match a restaurant on RestroOS. Double-check the link you were given.
                </Typography>
            </Box>
        );

    }

    const handleLogout = () => {
        setMenuAnchor(null);
        logout();
        navigate(`/${tenantSlug}`);
    };

    return (

        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid #E5E7EB", backgroundColor: "#FFFFFF" }}>

                <Toolbar sx={{ gap: 2 }}>

                    <Typography
                        component={RouterLink}
                        to={`/${tenantSlug}`}
                        variant="h6"
                        fontWeight={800}
                        sx={{ color: "#4F46E5", textDecoration: "none", flexShrink: 0 }}
                    >
                        {tenant?.TenantName || "RestroOS"}
                    </Typography>

                    {branches.length > 1 && (

                        <Select
                            size="small"
                            value={selectedBranchId ?? ""}
                            onChange={(event) => selectBranch(event.target.value)}
                            startAdornment={<PlaceOutlinedIcon fontSize="small" sx={{ mr: 0.5, color: "text.secondary" }} />}
                            sx={{ ml: "auto", maxWidth: 220 }}
                        >
                            {branches.map((branch) => (
                                <MenuItem key={branch.BranchId} value={branch.BranchId}>
                                    {branch.BranchName}
                                </MenuItem>
                            ))}
                        </Select>

                    )}

                    <Box sx={{ ml: branches.length > 1 ? 1 : "auto", display: "flex", alignItems: "center", gap: 1 }}>

                        <IconButton component={RouterLink} to={`/${tenantSlug}/cart`}>
                            <Badge badgeContent={cartCount} color="primary">
                                <ShoppingCartOutlinedIcon />
                            </Badge>
                        </IconButton>

                        {isLoggedIn ? (

                            <>
                                <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)}>
                                    <PersonOutlineIcon />
                                </IconButton>

                                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>

                                    <MenuItem disabled sx={{ opacity: "1 !important" }}>
                                        <Typography variant="body2" fontWeight={600}>{customer?.FullName}</Typography>
                                    </MenuItem>

                                    <Divider />

                                    <MenuItem component={RouterLink} to={`/${tenantSlug}/orders`} onClick={() => setMenuAnchor(null)}>
                                        My Orders
                                    </MenuItem>

                                    <MenuItem component={RouterLink} to={`/${tenantSlug}/addresses`} onClick={() => setMenuAnchor(null)}>
                                        My Addresses
                                    </MenuItem>

                                    <Divider />

                                    <MenuItem onClick={handleLogout}>
                                        Log Out
                                    </MenuItem>

                                </Menu>
                            </>

                        ) : (

                            <Button component={RouterLink} to={`/${tenantSlug}/login`} variant="outlined" size="small">
                                Log In
                            </Button>

                        )}

                    </Box>

                </Toolbar>

            </AppBar>

            <Container maxWidth="lg" sx={{ flex: 1, py: 3, pb: { xs: 9, md: 3 } }}>
                {children}
            </Container>

            <BottomNav />

        </Box>

    );

}

export default Layout;
