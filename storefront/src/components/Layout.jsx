import { useState } from "react";
import {
    AppBar,
    Avatar,
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
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import RestaurantMenuOutlinedIcon from "@mui/icons-material/RestaurantMenuOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

import { useStorefront } from "../context/StorefrontContext";
import BottomNav from "./BottomNav";

function Layout({ children }) {

    const navigate = useNavigate();
    const location = useLocation();
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

    const isMenuActive = location.pathname === `/${tenantSlug}`;
    const isOrdersActive = location.pathname.startsWith(`/${tenantSlug}/orders`);

    const navButtonSx = (active) => ({
        fontWeight: 600,
        borderRadius: 2,
        color: active ? "primary.main" : "inherit",
        bgcolor: active ? "rgba(79, 70, 229, 0.1)" : "transparent"
    });

    return (

        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid #E5E7EB", backgroundColor: "#FFFFFF" }}>

                <Toolbar sx={{ gap: 2 }}>

                    <Box
                        component={RouterLink}
                        to={`/${tenantSlug}`}
                        sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", flexShrink: 0 }}
                    >

                        {tenant?.LogoUrl && (
                            <Box
                                component="img"
                                src={tenant.LogoUrl}
                                alt=""
                                sx={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                            />
                        )}

                        <Typography
                            variant="h6"
                            fontWeight={800}
                            sx={{ color: "primary.main" }}
                        >
                            {tenant?.TenantName || "RestroOS"}
                        </Typography>

                    </Box>

                    {/* BottomNav (Menu/Cart/Orders/Profile) is hidden above md,
                        and the logo being clickable back to the menu isn't an
                        obvious nav affordance - without this, there's no
                        visible way back to the menu from Cart/Orders/Addresses
                        on desktop except the browser back button. */}
                    <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5 }}>

                        <Button
                            component={RouterLink}
                            to={`/${tenantSlug}`}
                            startIcon={<RestaurantMenuOutlinedIcon fontSize="small" />}
                            sx={navButtonSx(isMenuActive)}
                        >
                            Menu
                        </Button>

                        <Button
                            component={RouterLink}
                            to={`/${tenantSlug}/orders`}
                            startIcon={<ReceiptLongOutlinedIcon fontSize="small" />}
                            sx={navButtonSx(isOrdersActive)}
                        >
                            Orders
                        </Button>

                    </Box>

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

                        <IconButton
                            component={RouterLink}
                            to={`/${tenantSlug}/cart`}
                            sx={{
                                transition: "box-shadow .15s",
                                "&:hover": { boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.1)" }
                            }}
                        >
                            <Badge badgeContent={cartCount} color="primary">
                                <ShoppingCartOutlinedIcon />
                            </Badge>
                        </IconButton>

                        {isLoggedIn ? (

                            <>
                                <IconButton
                                    onClick={(event) => setMenuAnchor(event.currentTarget)}
                                    sx={{
                                        p: 0.5,
                                        transition: "box-shadow .15s",
                                        "&:hover": { boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.1)" }
                                    }}
                                >
                                    <Avatar src={customer?.AvatarUrl || undefined} sx={{ bgcolor: "primary.main", width: 32, height: 32, fontSize: 14 }}>
                                        {customer?.FullName?.[0]?.toUpperCase() || "U"}
                                    </Avatar>
                                </IconButton>

                                <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>

                                    <MenuItem disabled sx={{ opacity: "1 !important" }}>
                                        <Typography variant="body2" fontWeight={600}>{customer?.FullName}</Typography>
                                    </MenuItem>

                                    <Divider />

                                    <MenuItem component={RouterLink} to={`/${tenantSlug}/profile`} onClick={() => setMenuAnchor(null)}>
                                        My Profile
                                    </MenuItem>

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
