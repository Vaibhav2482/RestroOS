import { useState } from "react";
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
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import KitchenOutlinedIcon from "@mui/icons-material/KitchenOutlined";
import TableRestaurantOutlinedIcon from "@mui/icons-material/TableRestaurantOutlined";
import RestaurantMenuOutlinedIcon from "@mui/icons-material/RestaurantMenuOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { NavLink, useNavigate } from "react-router-dom";

import { clearStoredAuth, getStoredAuth, isOwner } from "../utils/adminAuth";

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
    { label: "Dashboard", to: "/", icon: <DashboardOutlinedIcon /> },
    { label: "Orders", to: "/orders", icon: <ReceiptLongOutlinedIcon /> },
    { label: "Take Order", to: "/pos", icon: <PointOfSaleOutlinedIcon /> },
    { label: "Kitchen", to: "/kitchen", icon: <KitchenOutlinedIcon /> },
    { label: "Tables", to: "/tables", icon: <TableRestaurantOutlinedIcon /> },
    { label: "Menu", to: "/menu", icon: <RestaurantMenuOutlinedIcon /> },
    { label: "Categories", to: "/categories", icon: <CategoryOutlinedIcon /> },
    { label: "Coupons", to: "/coupons", icon: <LocalOfferOutlinedIcon />, ownerOnly: true },
    { label: "Branches", to: "/branches", icon: <StoreOutlinedIcon />, ownerOnly: true },
    { label: "Staff", to: "/admins", icon: <GroupOutlinedIcon />, ownerOnly: true }
];

function Layout({ children }) {

    const navigate = useNavigate();
    const auth = getStoredAuth();
    const owner = isOwner(auth?.admin);

    const [mobileOpen, setMobileOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState(null);

    const handleLogout = () => {
        clearStoredAuth();
        navigate("/login");
    };

    const drawerContent = (

        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>

            <Toolbar sx={{ px: 3 }}>
                <Typography variant="h6" fontWeight={800} sx={{ color: "#4F46E5" }}>
                    RestroOS
                </Typography>
            </Toolbar>

            <Divider />

            <List sx={{ flex: 1, px: 2, py: 2 }}>

                {NAV_ITEMS.filter((item) => !item.ownerOnly || owner).map((item) => (

                    <ListItemButton
                        key={item.to}
                        component={NavLink}
                        to={item.to}
                        end={item.to === "/"}
                        onClick={() => setMobileOpen(false)}
                        sx={{
                            borderRadius: 2,
                            mb: 0.5,
                            "&.active": {
                                backgroundColor: "rgba(79, 70, 229, 0.1)",
                                color: "#4F46E5",
                                "& .MuiListItemIcon-root": { color: "#4F46E5" }
                            }
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItemButton>

                ))}

            </List>

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
                    borderBottom: "1px solid #E5E7EB",
                    backgroundColor: "#FFFFFF"
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

                    <IconButton onClick={(event) => setMenuAnchor(event.currentTarget)}>
                        <Avatar sx={{ bgcolor: "#4F46E5", width: 36, height: 36 }}>
                            {auth?.admin?.FullName?.[0]?.toUpperCase() || "A"}
                        </Avatar>
                    </IconButton>

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
