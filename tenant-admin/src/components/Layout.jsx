import { useEffect, useState } from "react";
import {
    AppBar,
    Avatar,
    Box,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Toolbar,
    Typography
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import KitchenOutlinedIcon from "@mui/icons-material/KitchenOutlined";
import TableRestaurantOutlinedIcon from "@mui/icons-material/TableRestaurantOutlined";
import RestaurantMenuOutlinedIcon from "@mui/icons-material/RestaurantMenuOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import { NavLink, useNavigate } from "react-router-dom";
import { alpha } from "@mui/material/styles";

import { AUTH_CHANGED_EVENT, clearStoredAuth, getStoredAuth, hasPermission, isOwner, setStoredAuth } from "../utils/adminAuth";
import * as adminService from "../services/adminService";

const DRAWER_WIDTH = 260;

// Grouped rather than one flat list - a 16-item unbroken list is what made
// the sidebar read as a plain nav dump rather than a designed IA. Each
// group only renders if it still has at least one item visible to the
// current admin (a Branch Admin never sees "Management"/"System" at all).
const NAV_GROUPS = [
    {
        label: "Overview",
        items: [
            { label: "Dashboard", to: "/", icon: <DashboardOutlinedIcon /> },
            { label: "Analytics", to: "/analytics", icon: <InsightsOutlinedIcon />, permission: "view_analytics" },
            { label: "Reports", to: "/reports", icon: <SummarizeOutlinedIcon />, permission: "view_reports" }
        ]
    },
    {
        label: "Operations",
        items: [
            { label: "Orders", to: "/orders", icon: <ReceiptLongOutlinedIcon />, permission: "manage_orders" },
            { label: "Customers", to: "/customers", icon: <PersonOutlineOutlinedIcon />, permission: "view_customers" },
            { label: "Take Order", to: "/pos", icon: <PointOfSaleOutlinedIcon />, permission: "manage_orders" },
            { label: "Kitchen", to: "/kitchen", icon: <KitchenOutlinedIcon />, permission: "manage_orders" },
            { label: "Tables", to: "/tables", icon: <TableRestaurantOutlinedIcon />, permission: "manage_tables" }
        ]
    },
    {
        label: "Catalog",
        items: [
            { label: "Menu", to: "/menu", icon: <RestaurantMenuOutlinedIcon />, permission: "manage_menu" },
            { label: "Inventory", to: "/inventory", icon: <Inventory2OutlinedIcon />, permission: ["manage_inventory", "manage_ingredients"] },
            { label: "Categories", to: "/categories", icon: <CategoryOutlinedIcon />, permission: "manage_categories" }
        ]
    },
    {
        label: "Management",
        items: [
            { label: "Coupons", to: "/coupons", icon: <LocalOfferOutlinedIcon />, permission: "manage_coupons" },
            { label: "Branches", to: "/branches", icon: <StoreOutlinedIcon />, ownerOnly: true },
            { label: "Staff", to: "/admins", icon: <GroupOutlinedIcon />, ownerOnly: true },
            { label: "Integrations", to: "/integrations", icon: <ExtensionOutlinedIcon />, permission: "manage_integrations" }
        ]
    },
    {
        label: "System",
        items: [
            { label: "Activity Log", to: "/activity-log", icon: <HistoryOutlinedIcon />, permission: "view_activity_log" },
            { label: "Branding", to: "/settings", icon: <PaletteOutlinedIcon />, permission: "manage_branding" }
        ]
    }
];

function Layout({ children }) {

    const navigate = useNavigate();

    // State, not a plain getStoredAuth() read - MyProfile.jsx saves through
    // to localStorage from a route this component is the parent of, which
    // never re-renders Layout on its own. Listening for the event
    // setStoredAuth now dispatches is what makes the header avatar/name
    // actually update right after a profile save, instead of only after
    // the next full navigation remounts this component.
    const [auth, setAuth] = useState(() => getStoredAuth());
    const owner = isOwner(auth?.admin);

    const [mobileOpen, setMobileOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState(null);

    useEffect(() => {

        const handleAuthChanged = () => setAuth(getStoredAuth());

        window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
        return () => window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);

    }, []);

    // requirePermission on the backend already enforces a permission change
    // live on every request (see middleware/Auth.js) - this just keeps the
    // cached admin object driving what buttons/nav a Branch Admin SEES from
    // lagging behind that by up to a full login session. Same 60s/
    // visible-tab-only cadence as Dashboard.jsx's order refresh, so an
    // Owner's grant/revoke shows up without the Branch Admin re-logging in.
    useEffect(() => {

        const interval = setInterval(async () => {

            const current = getStoredAuth();

            if (!current?.token || document.visibilityState !== "visible") {
                return;
            }

            try {

                const response = await adminService.getOwnProfile();

                if (!response.success) {
                    return;
                }

                const fresh = response.data;

                const permissionsChanged = JSON.stringify([...(current.admin?.Permissions || [])].sort()) !==
                    JSON.stringify([...(fresh.Permissions || [])].sort());

                const changed = permissionsChanged ||
                    String(current.admin?.BranchId ?? "") !== String(fresh.BranchId ?? "") ||
                    current.admin?.FullName !== fresh.FullName ||
                    current.admin?.AvatarUrl !== fresh.AvatarUrl;

                if (changed) {
                    setStoredAuth({ ...current, admin: { ...current.admin, ...fresh } });
                }

            } catch {
                // Silent - a transient network hiccup here shouldn't disrupt
                // the UI; a truly dead session is already handled by the
                // axios 401 interceptor on whatever request hits that first.
            }

        }, 60000);

        return () => clearInterval(interval);

    }, []);

    const handleLogout = () => {
        clearStoredAuth();
        navigate("/login");
    };

    const drawerContent = (

        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>

            <Toolbar sx={{ px: 2.5, py: 2, height: "auto" }}>
                <Box
                    component={NavLink}
                    to="/orders"
                    onClick={() => setMobileOpen(false)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        textDecoration: "none",
                        color: "#4F46E5",
                        width: "100%"
                    }}
                >
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
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={800} sx={{ color: "inherit", lineHeight: 1.15 }}>
                            RestroOS
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {auth?.admin?.tenantName || "Admin Console"}
                        </Typography>
                    </Box>
                </Box>
            </Toolbar>

            <Divider />

            <List sx={{ flex: 1, px: 1.5, py: 2, overflowY: "auto" }}>

                {NAV_GROUPS.map((group) => {

                    const visibleItems = group.items.filter((item) => {

                        if (item.ownerOnly) {
                            return owner;
                        }

                        if (item.permission) {
                            const required = Array.isArray(item.permission) ? item.permission : [item.permission];
                            return required.some((key) => hasPermission(auth?.admin, key));
                        }

                        return true;

                    });

                    if (visibleItems.length === 0) {
                        return null;
                    }

                    return (

                        <Box key={group.label} sx={{ mb: 1.5 }}>

                            <Typography
                                variant="caption"
                                sx={{
                                    display: "block",
                                    px: 1.5,
                                    mb: 0.5,
                                    color: "text.secondary",
                                    fontWeight: 700,
                                    letterSpacing: "0.07em",
                                    textTransform: "uppercase",
                                    fontSize: "0.68rem"
                                }}
                            >
                                {group.label}
                            </Typography>

                            {visibleItems.map((item) => (

                                <ListItemButton
                                    key={item.to}
                                    component={NavLink}
                                    to={item.to}
                                    end={item.to === "/"}
                                    onClick={() => setMobileOpen(false)}
                                    sx={{
                                        borderRadius: 2,
                                        mb: 0.25,
                                        pl: 1.25,
                                        borderLeft: "3px solid transparent",
                                        color: "text.primary",
                                        "& .MuiListItemIcon-root": { minWidth: 38, color: "text.secondary", transition: "color .15s" },
                                        "&.active": {
                                            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                            borderLeftColor: "primary.main",
                                            color: "primary.main",
                                            fontWeight: 700,
                                            "& .MuiListItemIcon-root": { color: "primary.main" },
                                            "& .MuiListItemText-primary": { fontWeight: 700 }
                                        },
                                        "&:hover:not(.active)": { backgroundColor: "rgba(17,24,39,.04)" }
                                    }}
                                >
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.label} />
                                </ListItemButton>

                            ))}

                        </Box>

                    );

                })}

            </List>

            <Divider />

            <Box
                component={NavLink}
                to="/profile"
                onClick={() => setMobileOpen(false)}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    px: 2,
                    py: 1.5,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "background-color .15s",
                    "&:hover": { backgroundColor: "rgba(17,24,39,.04)" }
                }}
            >
                <Avatar src={auth?.admin?.AvatarUrl || undefined} sx={{ bgcolor: "#4F46E5", width: 34, height: 34, fontSize: 14 }}>
                    {auth?.admin?.FullName?.[0]?.toUpperCase() || "A"}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                        {auth?.admin?.FullName || "Admin"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {owner ? "Owner" : "Branch Admin"}
                    </Typography>
                </Box>
            </Box>

        </Box>

    );

    return (

        <Box sx={{ display: "flex", minHeight: "100vh" }}>

            <AppBar
                position="fixed"
                color="inherit"
                elevation={0}
                sx={{
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { md: `${DRAWER_WIDTH}px` },
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 1px 2px rgba(17,24,39,.04), 0 6px 20px rgba(17,24,39,.04)"
                }}
            >

                <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>

                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={() => setMobileOpen(true)}
                        sx={{ display: { md: "none" } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                        {auth?.admin?.tenantName}
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>

                        {/* Redundant with the sidebar's identity footer on
                            desktop, but the sidebar is a closed temporary
                            Drawer on mobile - this is the only place a
                            Branch Admin sees who they're logged in as
                            without opening the menu first. */}
                        <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "right" }}>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>
                                {auth?.admin?.FullName || "Admin"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
                                {owner ? "Owner" : "Branch Admin"}
                            </Typography>
                        </Box>

                        <IconButton
                            onClick={(event) => setMenuAnchor(event.currentTarget)}
                            sx={{
                                p: 0.5,
                                transition: "box-shadow .15s",
                                "&:hover": { boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.15)" }
                            }}
                        >
                            <Avatar src={auth?.admin?.AvatarUrl || undefined} sx={{ bgcolor: "#4F46E5", width: 36, height: 36 }}>
                                {auth?.admin?.FullName?.[0]?.toUpperCase() || "A"}
                            </Avatar>
                        </IconButton>

                    </Box>

                    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>

                        <MenuItem disabled sx={{ opacity: "1 !important" }}>
                            <Box>
                                <Typography variant="body2" fontWeight={600}>{auth?.admin?.FullName}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {owner ? "Owner" : "Branch Admin"}
                                </Typography>
                            </Box>
                        </MenuItem>

                        <Divider />

                        <MenuItem
                            onClick={() => {
                                setMenuAnchor(null);
                                navigate("/profile");
                            }}
                        >
                            <ListItemIcon><PersonOutlineRoundedIcon fontSize="small" /></ListItemIcon>
                            My Profile
                        </MenuItem>

                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>
                            Log Out
                        </MenuItem>

                    </Menu>

                </Toolbar>

            </AppBar>

            <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>

                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
                >
                    {drawerContent}
                </Drawer>

                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: "none", md: "block" },
                        "& .MuiDrawer-paper": { width: DRAWER_WIDTH, borderRight: "1px solid #E5E7EB" }
                    }}
                    open
                >
                    {drawerContent}
                </Drawer>

            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    p: { xs: 2, md: 4 },
                    mt: 8
                }}
            >
                {children}
            </Box>

        </Box>

    );

}

export default Layout;
