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
import { alpha } from "@mui/material/styles";
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

    // Themed against whichever primary color this tenant picked in Branding
    // (alpha() blends it at low opacity), rather than a hardcoded indigo
    // that would clash with e.g. a teal or terracotta storefront.
    const navButtonSx = (active) => ({
        fontWeight: 600,
        borderRadius: 2.5,
        px: 2,
        color: active ? "primary.main" : "text.primary",
        bgcolor: active ? (theme) => alpha(theme.palette.primary.main, 0.1) : "transparent",
        "&:hover": {
            bgcolor: (theme) => alpha(theme.palette.primary.main, active ? 0.14 : 0.06)
        }
    });

    const iconButtonSx = {
        transition: "background-color .15s ease",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
        "&:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14) }
    };

    return (

        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            <AppBar
                position="sticky"
                color="inherit"
                elevation={0}
                sx={{
                    backgroundColor: "background.paper",
                    boxShadow: "0 1px 2px rgba(17,24,39,.04), 0 8px 24px rgba(17,24,39,.05)"
                }}
            >

                <Toolbar sx={{ gap: 2, py: 1 }}>

                    <Box
                        component={RouterLink}
                        to={`/${tenantSlug}`}
                        sx={{ display: "flex", alignItems: "center", gap: 1.25, textDecoration: "none", flexShrink: 0 }}
                    >

                        <Typography
                            variant="h6"
                            fontWeight={800}
                            sx={{ color: "primary.main", letterSpacing: "-0.01em" }}
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
                            startAdornment={<PlaceOutlinedIcon fontSize="small" sx={{ mr: 0.5, color: "primary.main" }} />}
                            sx={{
                                ml: "auto",
                                maxWidth: 220,
                                borderRadius: 2.5,
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                                "&:hover": { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1) }
                            }}
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
                            sx={iconButtonSx}
                        >
                            <Badge badgeContent={cartCount} color="primary">
                                <ShoppingCartOutlinedIcon />
                            </Badge>
                        </IconButton>

                        {isLoggedIn ? (

                            <>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    noWrap
                                    sx={{ display: { xs: "none", sm: "block" }, maxWidth: 140 }}
                                >
                                    Hi, {customer?.FullName?.split(" ")[0] || "there"}
                                </Typography>

                                <IconButton
                                    onClick={(event) => setMenuAnchor(event.currentTarget)}
                                    sx={{ p: 0.5, ...iconButtonSx, bgcolor: "transparent" }}
                                >
                                    <Avatar src={customer?.AvatarUrl || undefined} sx={{ bgcolor: "primary.main", width: 34, height: 34, fontSize: 14 }}>
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
