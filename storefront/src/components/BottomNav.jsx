import { Badge, BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";

import { useStorefront } from "../context/StorefrontContext";

const routeToValue = (pathname, tenantSlug) => {

    const base = `/${tenantSlug}`;

    if (pathname === base || pathname === `${base}/`) return "menu";
    if (pathname.startsWith(`${base}/cart`)) return "cart";
    if (pathname.startsWith(`${base}/orders`)) return "orders";
    if (pathname.startsWith(`${base}/addresses`) || pathname.startsWith(`${base}/login`) || pathname.startsWith(`${base}/register`)) return "profile";

    return false;

};

// Mobile-only bottom navigation, mirroring a standard food-ordering app
// shell (Menu / Cart / Orders / Profile) instead of relying solely on the
// small header icons for primary navigation.
function BottomNav() {

    const location = useLocation();
    const navigate = useNavigate();
    const { tenantSlug, isLoggedIn, cartCount } = useStorefront();

    const goProtected = (path) => {
        navigate(isLoggedIn ? path : `/${tenantSlug}/login`);
    };

    return (

        <Paper
            elevation={8}
            sx={{
                display: { xs: "block", md: "none" },
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 30,
                borderTop: "1px solid #E5E7EB"
            }}
        >

            <BottomNavigation value={routeToValue(location.pathname, tenantSlug)} showLabels sx={{ height: 64 }}>

                <BottomNavigationAction
                    label="Menu"
                    value="menu"
                    icon={<RestaurantMenuRoundedIcon />}
                    onClick={() => navigate(`/${tenantSlug}`)}
                />

                <BottomNavigationAction
                    label="Cart"
                    value="cart"
                    icon={
                        <Badge badgeContent={cartCount} color="primary">
                            <ShoppingCartRoundedIcon />
                        </Badge>
                    }
                    onClick={() => navigate(`/${tenantSlug}/cart`)}
                />

                <BottomNavigationAction
                    label="Orders"
                    value="orders"
                    icon={<ReceiptLongRoundedIcon />}
                    onClick={() => goProtected(`/${tenantSlug}/orders`)}
                />

                <BottomNavigationAction
                    label={isLoggedIn ? "Profile" : "Log In"}
                    value="profile"
                    icon={<PersonRoundedIcon />}
                    onClick={() => goProtected(`/${tenantSlug}/addresses`)}
                />

            </BottomNavigation>

        </Paper>

    );

}

export default BottomNav;
