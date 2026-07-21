import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    FormControlLabel,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from "@mui/material";
import LocalMallOutlinedIcon from "@mui/icons-material/LocalMallOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import toast from "react-hot-toast";

import * as cartService from "../services/cartService";
import * as addressService from "../services/addressService";
import * as checkoutService from "../services/checkoutService";
import * as paymentService from "../services/paymentService";
import * as couponService from "../services/couponService";
import { useStorefront } from "../context/StorefrontContext";

const PAYMENT_METHODS = [
    { value: "Cash", label: "Cash", icon: <PaymentsOutlinedIcon fontSize="small" /> },
    { value: "Card", label: "Card", icon: <CreditCardOutlinedIcon fontSize="small" /> },
    { value: "UPI", label: "UPI", icon: <QrCode2OutlinedIcon fontSize="small" /> }
];

function formatCurrency(value) {
    return `₹${Number(value ?? 0).toFixed(2)}`;
}

function SectionCard({ title, children }) {

    return (

        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, border: "1px solid #E5E7EB" }}>

            <Typography fontWeight={700} sx={{ mb: 2 }}>
                {title}
            </Typography>

            {children}

        </Paper>

    );

}

function Checkout() {

    const { tenantSlug } = useParams();
    const navigate = useNavigate();
    const { customer, refreshCartCount } = useStorefront();

    const [cartItems, setCartItems] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [deliveryType, setDeliveryType] = useState("Delivery");
    const [addressId, setAddressId] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [notes, setNotes] = useState("");
    const [placingOrder, setPlacingOrder] = useState(false);

    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [applyingCoupon, setApplyingCoupon] = useState(false);

    useEffect(() => {

        let cancelled = false;

        (async () => {

            try {

                setLoading(true);

                const [cartResponse, addressResponse] = await Promise.all([
                    cartService.getCart(customer.CustomerId),
                    addressService.getAddresses(customer.CustomerId)
                ]);

                if (cancelled) {
                    return;
                }

                if (!cartResponse.success) {
                    toast.error(cartResponse.message);
                    return;
                }

                if (cartResponse.data.length === 0) {
                    navigate(`/${tenantSlug}/cart`);
                    return;
                }

                setCartItems(cartResponse.data);

                if (addressResponse.success) {

                    setAddresses(addressResponse.data);

                    const defaultAddress = addressResponse.data.find((address) => address.IsDefault) || addressResponse.data[0];

                    if (defaultAddress) {
                        setAddressId(defaultAddress.AddressId);
                    }

                }

            } catch (error) {

                toast.error(error.response?.data?.message || "Failed to load checkout details.");

            } finally {

                if (!cancelled) {
                    setLoading(false);
                }

            }

        })();

        return () => { cancelled = true; };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customer.CustomerId]);

    const subtotal = cartItems.reduce((sum, item) => sum + Number(item.TotalPrice), 0);
    const discountAmount = appliedCoupon ? Number(appliedCoupon.discountAmount) || 0 : 0;
    const estimatedTotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    const handleApplyCoupon = async () => {

        const code = couponInput.trim();

        if (!code) {
            toast.error("Please enter a coupon code.");
            return;
        }

        try {

            setApplyingCoupon(true);

            const response = await couponService.previewCoupon({
                code,
                customerId: customer.CustomerId,
                subtotal
            });

            if (!response.success) {
                toast.error(response.message);
                return;
            }

            setAppliedCoupon({
                code,
                discountAmount: response.data.discountAmount,
                couponId: response.data.couponId
            });

            toast.success(`Coupon ${code} applied: -${formatCurrency(response.data.discountAmount)}`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to apply coupon.");

        } finally {

            setApplyingCoupon(false);

        }

    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setCouponInput("");
    };

    const handlePlaceOrder = async () => {

        if (deliveryType === "Delivery" && !addressId) {
            toast.error("Please select a delivery address.");
            return;
        }

        try {

            setPlacingOrder(true);

            const checkoutResponse = await checkoutService.checkout({
                customerId: customer.CustomerId,
                addressId: deliveryType === "Delivery" ? addressId : undefined,
                deliveryType,
                paymentMethod,
                notes: notes.trim() || undefined,
                couponCode: appliedCoupon ? appliedCoupon.code : undefined
            });

            if (!checkoutResponse.success) {
                toast.error(checkoutResponse.message);
                return;
            }

            const order = checkoutResponse.data;

            try {

                const paymentResponse = await paymentService.createPayment({
                    orderId: order.OrderId,
                    paymentMethod,
                    amount: order.TotalAmount
                });

                if (!paymentResponse.success) {
                    toast.error(paymentResponse.message);
                }

            } catch (paymentError) {

                toast.error(paymentError.response?.data?.message || "Order placed, but recording the payment failed.");

            }

            await refreshCartCount();
            toast.success("Order placed successfully!");
            navigate(`/${tenantSlug}/orders/${order.OrderId}`);

        } catch (error) {

            toast.error(error.response?.data?.message || "Failed to place order.");

        } finally {

            setPlacingOrder(false);

        }

    };

    if (loading) {

        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress />
            </Box>
        );

    }

    return (

        <Box sx={{ pb: { xs: 2, md: 0 } }}>

            <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>
                Checkout
            </Typography>

            <Grid container spacing={3}>

                <Grid size={{ xs: 12, md: 7 }}>

                    <Stack spacing={3}>

                        <SectionCard title="Delivery Type">

                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                value={deliveryType}
                                onChange={(event, value) => value && setDeliveryType(value)}
                                sx={{
                                    "& .MuiToggleButton-root": {
                                        py: 1.25,
                                        gap: 1,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        "&.Mui-selected": {
                                            bgcolor: "#EEF2FF",
                                            color: "#4F46E5",
                                            borderColor: "#4F46E5",
                                            "&:hover": { bgcolor: "#E0E7FF" }
                                        }
                                    }
                                }}
                            >
                                <ToggleButton value="Delivery">
                                    <LocalMallOutlinedIcon fontSize="small" />
                                    Delivery
                                </ToggleButton>
                                <ToggleButton value="Dine In">
                                    <RestaurantOutlinedIcon fontSize="small" />
                                    Dine In
                                </ToggleButton>
                            </ToggleButtonGroup>

                            {deliveryType === "Delivery" && (

                                <Box sx={{ mt: 2.5 }}>

                                    {addresses.length === 0 ? (

                                        <Box
                                            sx={{
                                                textAlign: "center",
                                                py: 3,
                                                px: 2,
                                                border: "1px dashed #E5E7EB",
                                                borderRadius: 2,
                                                bgcolor: "#FAFAFA"
                                            }}
                                        >

                                            <PlaceOutlinedIcon sx={{ color: "#9CA3AF", fontSize: 28, mb: 1 }} />

                                            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                                You don't have any saved addresses yet.
                                            </Typography>

                                            <Button component={RouterLink} to={`/${tenantSlug}/addresses`} variant="contained" size="small">
                                                Add an Address
                                            </Button>

                                        </Box>

                                    ) : (

                                        <>

                                            <TextField
                                                select
                                                fullWidth
                                                label="Deliver To"
                                                value={addressId}
                                                onChange={(event) => setAddressId(event.target.value)}
                                                slotProps={{
                                                    input: {
                                                        startAdornment: <PlaceOutlinedIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
                                                    }
                                                }}
                                            >
                                                {addresses.map((address) => (
                                                    <MenuItem key={address.AddressId} value={address.AddressId}>
                                                        <Box>
                                                            <Typography fontWeight={600} component="span">
                                                                {address.AddressTitle}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" component="div">
                                                                {address.FullAddress}, {address.City}
                                                            </Typography>
                                                        </Box>
                                                    </MenuItem>
                                                ))}
                                            </TextField>

                                            <Typography variant="body2" sx={{ mt: 1.5 }}>
                                                <RouterLink to={`/${tenantSlug}/addresses`} style={{ color: "#4F46E5", fontWeight: 600 }}>
                                                    Manage addresses
                                                </RouterLink>
                                            </Typography>

                                        </>

                                    )}

                                </Box>

                            )}

                        </SectionCard>

                        <SectionCard title="Payment Method">

                            <RadioGroup
                                value={paymentMethod}
                                onChange={(event) => setPaymentMethod(event.target.value)}
                            >

                                <Stack spacing={1}>

                                    {PAYMENT_METHODS.map((method) => (

                                        <Box
                                            key={method.value}
                                            onClick={() => setPaymentMethod(method.value)}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                border: "1px solid",
                                                borderColor: paymentMethod === method.value ? "#4F46E5" : "#E5E7EB",
                                                bgcolor: paymentMethod === method.value ? "#EEF2FF" : "transparent",
                                                borderRadius: 2,
                                                px: 1.5,
                                                py: 1,
                                                cursor: "pointer",
                                                transition: "border-color .15s ease, background-color .15s ease"
                                            }}
                                        >

                                            <FormControlLabel
                                                value={method.value}
                                                control={<Radio size="small" />}
                                                label={
                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        {method.icon}
                                                        <Typography fontWeight={600}>{method.label}</Typography>
                                                    </Stack>
                                                }
                                                sx={{ m: 0, flex: 1 }}
                                            />

                                        </Box>

                                    ))}

                                </Stack>

                            </RadioGroup>

                        </SectionCard>

                        <SectionCard title="Order Notes (optional)">

                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                placeholder="Any special instructions for the kitchen..."
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                            />

                        </SectionCard>

                    </Stack>

                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>

                    <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, border: "1px solid #E5E7EB", position: { md: "sticky" }, top: { md: 88 } }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>
                            Order Summary
                        </Typography>

                        <Stack spacing={1.5} sx={{ mb: 2.5 }}>

                            {cartItems.map((item) => {

                                const optionsSummary = item.SelectedOptions && item.SelectedOptions.length > 0
                                    ? item.SelectedOptions.map((option) => option.OptionName).join(", ")
                                    : null;

                                return (

                                    <Box key={item.CartId} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>

                                        <Box sx={{ minWidth: 0 }}>

                                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                    {item.ItemName}
                                                </Typography>
                                                <Chip label={`x${item.Quantity}`} size="small" sx={{ height: 18, fontSize: 11 }} />
                                            </Stack>

                                            {optionsSummary ? (
                                                <Typography variant="caption" color="text.secondary" component="div" noWrap>
                                                    {optionsSummary}
                                                </Typography>
                                            ) : null}

                                        </Box>

                                        <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
                                            {formatCurrency(item.TotalPrice)}
                                        </Typography>

                                    </Box>

                                );

                            })}

                        </Stack>

                        <Divider sx={{ mb: 2.5 }} />

                        <Box sx={{ mb: 2.5 }}>

                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                                <LocalOfferOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                                <Typography variant="body2" fontWeight={600}>
                                    Have a coupon?
                                </Typography>
                            </Stack>

                            {appliedCoupon ? (

                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 1,
                                        bgcolor: "#F0FDF4",
                                        border: "1px solid #BBF7D0",
                                        borderRadius: 2,
                                        px: 1.5,
                                        py: 1
                                    }}
                                >

                                    <Typography variant="body2" sx={{ color: "#166534" }}>
                                        <strong>{appliedCoupon.code}</strong> applied: -{formatCurrency(discountAmount)}
                                    </Typography>

                                    <Button size="small" onClick={handleRemoveCoupon} sx={{ color: "#166534" }}>
                                        Remove
                                    </Button>

                                </Box>

                            ) : (

                                <Stack direction="row" spacing={1}>

                                    <TextField
                                        size="small"
                                        fullWidth
                                        placeholder="Enter coupon code"
                                        value={couponInput}
                                        onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                                        disabled={applyingCoupon}
                                    />

                                    <Button
                                        variant="outlined"
                                        onClick={handleApplyCoupon}
                                        disabled={applyingCoupon}
                                        sx={{ flexShrink: 0 }}
                                    >
                                        {applyingCoupon ? "Checking..." : "Apply"}
                                    </Button>

                                </Stack>

                            )}

                        </Box>

                        <Stack spacing={0.75}>

                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                                <Typography variant="body2">{formatCurrency(subtotal)}</Typography>
                            </Box>

                            {appliedCoupon ? (

                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="body2" sx={{ color: "#166534" }}>Coupon Discount</Typography>
                                    <Typography variant="body2" sx={{ color: "#166534" }}>-{formatCurrency(discountAmount)}</Typography>
                                </Box>

                            ) : null}

                        </Stack>

                        <Divider sx={{ my: 1.5 }} />

                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <Typography fontWeight={700}>
                                {appliedCoupon ? "Estimated Total" : "Estimated Total"}
                            </Typography>
                            <Typography variant="h6" fontWeight={800}>
                                {formatCurrency(estimatedTotalAfterDiscount)}
                            </Typography>
                        </Box>

                        <Typography variant="caption" color="text.secondary">
                            + GST calculated at checkout
                        </Typography>

                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={placingOrder}
                            onClick={handlePlaceOrder}
                            sx={{ mt: 3, height: 48 }}
                        >
                            {placingOrder ? "Placing Order..." : "Place Order"}
                        </Button>

                    </Paper>

                </Grid>

            </Grid>

        </Box>

    );

}

export default Checkout;
