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
    Tooltip,
    Typography
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
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
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import { NavLink, useNavigate } from "react-router-dom";
import { alpha } from "@mui/material/styles";

import { AUTH_CHANGED_EVENT, clearStoredAuth, getStoredAuth, hasPermission, isFeatureEnabled, isOwner, setStoredAuth } from "../utils/adminAuth";
import * as adminService from "../services/adminService";
import * as tenantService from "../services/tenantService";

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 80;

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
            { label: "Branches", to: "/branches", icon: <StoreOutlinedIcon />, ownerOnly: true, feature: "manage_branches" },
            { label: "Staff", to: "/admins", icon: <GroupOutlinedIcon />, ownerOnly: true },
            { label: "Integrations", to: "/integrations", icon: <ExtensionOutlinedIcon />, permission: "manage_integrations" }
        ]
    },
    {
        label: "System",
        items: [
            { label: "Activity Log", to: "/activity-log", icon: <HistoryOutlinedIcon />, permission: "view_activity_log" },
            { label: "Branding", to: "/settings", icon: <PaletteOutlinedIcon />, permission: "manage_branding" },
            { label: "Features", to: "/features", icon: <TuneOutlinedIcon />, ownerOnly: true }
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
    // Icon-only rail mode (the pattern Square/Toast/Lightspeed all use on
    // their POS screens to give the working area more room) - desktop only,
    // persisted so it survives a refresh instead of resetting every load.
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "1");
    const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("sidebarCollapsed", next ? "1" : "0");
            return next;
        });
    };

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

                // allSettled, not all - a hiccup fetching the tenant record
                // shouldn't also block the admin profile refresh (or vice
                // versa); each just falls back to its last-known value.
                const [profileResult, tenantResult] = await Promise.allSettled([
                    adminService.getOwnProfile(),
                    tenantService.getOwnTenant()
                ]);

                if (profileResult.status !== "fulfilled" || !profileResult.value.success) {
                    return;
                }

                const fresh = profileResult.value.data;
                const freshTenantDisabledFeatures = tenantResult.status === "fulfilled" && tenantResult.value.success
                    ? (tenantResult.value.data.DisabledFeatures || [])
                    : current.admin?.tenantDisabledFeatures;

                const permissionsChanged = JSON.stringify([...(current.admin?.Permissions || [])].sort()) !==
                    JSON.stringify([...(fresh.Permissions || [])].sort());

                const featuresChanged = JSON.stringify([...(current.admin?.tenantDisabledFeatures || [])].sort()) !==
                    JSON.stringify([...(freshTenantDisabledFeatures || [])].sort());

                const changed = permissionsChanged || featuresChanged ||
                    String(current.admin?.BranchId ?? "") !== String(fresh.BranchId ?? "") ||
                    current.admin?.FullName !== fresh.FullName ||
                    current.admin?.AvatarUrl !== fresh.AvatarUrl;

                if (changed) {
                    setStoredAuth({ ...current, admin: { ...current.admin, ...fresh, tenantDisabledFeatures: freshTenantDisabledFeatures } });
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

    const renderDrawerContent = (isCollapsed, showToggle) => (

        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>

            <Toolbar
                sx={{
                    px: isCollapsed ? 1.5 : 2.5,
                    py: 2,
                    height: "auto",
                    position: "relative",
                    flexDirection: isCollapsed ? "column" : "row",
                    gap: isCollapsed ? 1 : 0
                }}
            >
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
                        width: "100%",
                        justifyContent: isCollapsed ? "center" : "flex-start"
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
                    {!isCollapsed && (
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={800} sx={{ color: "inherit", lineHeight: 1.15 }}>
                            RestroOS
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {auth?.admin?.tenantName || "Admin Console"}
                        </Typography>
                    </Box>
                    )}
                </Box>

                {/* Expanded: pinned to the right edge, vertically centered
                    over the whole toolbar. Collapsed: stacked below the logo
                    in normal flow instead - absolutely positioning it half
                    outside the toolbar's own box (the first cut of this) put
                    it underneath the nav List rendered right after, which
                    then intercepted every click before it ever reached the
                    button. */}
                {showToggle && !isCollapsed && (
                    <IconButton
                        size="small"
                        onClick={toggleCollapsed}
                        sx={{
                            position: "absolute",
                            right: 4,
                            top: "50%",
                            transform: "translateY(-50%)",
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            boxShadow: 1,
                            width: 24,
                            height: 24,
                            "&:hover": { bgcolor: "primary.main", color: "#fff" }
                        }}
                    >
                        <ChevronLeftRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                )}

                {showToggle && isCollapsed && (
                    <IconButton
                        size="small"
                        onClick={toggleCollapsed}
                        sx={{
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            boxShadow: 1,
                            width: 24,
                            height: 24,
                            "&:hover": { bgcolor: "primary.main", color: "#fff" }
                        }}
                    >
                        <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                )}

            </Toolbar>

            <Divider />

            <List
                sx={(theme) => ({
                    flex: 1,
                    px: 1.5,
                    py: 2,
                    overflowY: "auto",
                    // Pure-CSS scroll shadow: the two radial-gradient layers
                    // are pinned to the viewport (backgroundAttachment:
                    // "scroll") while the two solid-fade layers scroll WITH
                    // the content (backgroundAttachment: "local") - the
                    // interplay hides the shadow at each end automatically,
                    // so a short/unscrolled nav shows no cue while a long
                    // one (most Owner accounts) gets a visible fade instead
                    // of hard-clipping the last item with no affordance.
                    // NOTE: the per-layer position offsets ("0 100%") are only
                    // valid inside the `background` shorthand, not the
                    // `backgroundImage` longhand - putting them there makes the
                    // whole declaration invalid and silently dropped. The
                    // longhand overrides below must come after the shorthand so
                    // they win the cascade for their sub-property.
                    background: `linear-gradient(${theme.palette.background.paper} 30%, transparent), linear-gradient(transparent, ${theme.palette.background.paper} 70%) 0 100%, radial-gradient(farthest-side at 50% 0, rgba(0,0,0,.15), rgba(0,0,0,0)), radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,.15), rgba(0,0,0,0)) 0 100%`,
                    backgroundRepeat: "no-repeat",
                    backgroundColor: theme.palette.background.paper,
                    backgroundSize: "100% 24px, 100% 24px, 100% 10px, 100% 10px",
                    backgroundAttachment: "local, local, scroll, scroll"
                })}
            >

                {NAV_GROUPS.map((group) => {

                    const visibleItems = group.items.filter((item) => {

                        if (item.ownerOnly && !owner) {
                            return false;
                        }

                        // feature is for ownerOnly pages (Branches) with no
                        // per-admin permission of their own but that still
                        // respect the tenant-wide toggle.
                        if (item.feature && !isFeatureEnabled(auth?.admin, item.feature)) {
                            return false;
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

                            {!isCollapsed && (
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
                            )}

                            {visibleItems.map((item) => (

                                <Tooltip key={item.to} title={isCollapsed ? item.label : ""} placement="right">
                                <ListItemButton
                                    component={NavLink}
                                    to={item.to}
                                    end={item.to === "/"}
                                    onClick={() => setMobileOpen(false)}
                                    sx={{
                                        borderRadius: 2,
                                        mb: 0.25,
                                        pl: 1.25,
                                        justifyContent: isCollapsed ? "center" : "flex-start",
                                        borderLeft: "3px solid transparent",
                                        color: "text.primary",
                                        "& .MuiListItemIcon-root": { minWidth: isCollapsed ? "auto" : 38, color: "text.secondary", transition: "color .15s" },
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
                                    {!isCollapsed && <ListItemText primary={item.label} />}
                                </ListItemButton>
                                </Tooltip>

                            ))}

                        </Box>

                    );

                })}

            </List>

            <Divider />

            {/* Identity and Log Out share a row when expanded, and stack in
                rail mode where there isn't width for both side by side. */}
            <Box sx={{ display: "flex", flexDirection: isCollapsed ? "column" : "row", alignItems: "center" }}>

            <Tooltip title={isCollapsed ? `${auth?.admin?.FullName || "Admin"} · ${owner ? "Owner" : "Branch Admin"}` : ""} placement="right">
                <Box
                    component={NavLink}
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        flex: 1,
                        minWidth: 0,
                        px: isCollapsed ? 0 : 2,
                        py: 1.5,
                        justifyContent: isCollapsed ? "center" : "flex-start",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "background-color .15s",
                        "&:hover": { backgroundColor: "rgba(17,24,39,.04)" }
                    }}
                >
                    <Avatar src={auth?.admin?.AvatarUrl || undefined} sx={{ bgcolor: "#4F46E5", width: 34, height: 34, fontSize: 14 }}>
                        {auth?.admin?.FullName?.[0]?.toUpperCase() || "A"}
                    </Avatar>
                    {!isCollapsed && (
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                            {auth?.admin?.FullName || "Admin"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {owner ? "Owner" : "Branch Admin"}
                        </Typography>
                    </Box>
                    )}
                </Box>
            </Tooltip>

            {/* Explicit, always-visible Log Out. It used to live only in the
                avatar menu on the top bar - which no longer exists from md up,
                so without this there would be no way to sign out on desktop.
                A visible control beats one hidden behind a menu for something
                this consequential. */}
            <Tooltip title="Log Out" placement="right">
                <IconButton
                    onClick={handleLogout}
                    aria-label="Log Out"
                    sx={{ flexShrink: 0, mr: isCollapsed ? 0 : 1, mb: isCollapsed ? 1 : 0 }}
                >
                    <LogoutOutlinedIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            </Box>

        </Box>

    );

    return (

        <Box sx={{ display: "flex", minHeight: "100vh" }}>

            {/* Gone entirely from md up: every item on it - tenant name, admin
                name, role, avatar menu - already lives in the sidebar, so it
                was a full-height strip restating what was on screen. Below md
                the sidebar is a closed temporary Drawer, so this stays as the
                only route to the menu, but dense and stripped to the
                hamburger, tenant name and avatar. */}
            <AppBar
                position="fixed"
                color="inherit"
                elevation={0}
                sx={{
                    display: { xs: "block", md: "none" },
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    ml: { md: `${drawerWidth}px` },
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 1px 2px rgba(17,24,39,.04), 0 6px 20px rgba(17,24,39,.04)",
                    transition: (theme) => theme.transitions.create(["width", "margin"], { duration: theme.transitions.duration.shorter })
                }}
            >

                <Toolbar variant="dense" sx={{ display: "flex", justifyContent: "space-between" }}>

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


                </Toolbar>

            </AppBar>

            {/* Lives outside the AppBar, which is display:none from md up.
                It is opened from the sidebar identity footer there, and Log Out
                is only reachable through it - too important to leave nested
                inside a hidden subtree. */}
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

            <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, transition: (theme) => theme.transitions.create("width", { duration: theme.transitions.duration.shorter }) }}>

                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
                >
                    {renderDrawerContent(false, false)}
                </Drawer>

                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: "none", md: "block" },
                        "& .MuiDrawer-paper": {
                            width: drawerWidth,
                            borderRight: "1px solid #E5E7EB",
                            overflowX: "hidden",
                            transition: (theme) => theme.transitions.create("width", { duration: theme.transitions.duration.shorter })
                        }
                    }}
                    open
                >
                    {renderDrawerContent(collapsed, true)}
                </Drawer>

            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    p: { xs: 2, md: 3 },
                    // Clears the fixed AppBar only where one still exists. It
                    // used to reserve 64px on every breakpoint; from md up
                    // there's no bar to clear, and that was the empty strip
                    // above the page heading.
                    mt: { xs: 6, md: 0 },
                    transition: (theme) => theme.transitions.create("width", { duration: theme.transitions.duration.shorter })
                }}
            >
                {children}
            </Box>

        </Box>

    );

}

export default Layout;
