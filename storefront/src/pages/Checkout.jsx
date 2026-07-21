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
import toast from "react-hot-toast";

import * as cartService from "../services/cartService";
import * as addressService from "../services/addressService";
import * as checkoutService from "../services/checkoutService";
import * as paymentService from "../services/paymentService";
import * as couponService from "../services/couponService";
import { useStorefront } from "../context/StorefrontContext";

const PAYMENT_METHODS = ["Cash", "Card", "UPI"];

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

            toast.success(`Coupon ${code} applied: -₹${Number(response.data.discountAmount).toFixed(2)}`);

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

        <Box>

            <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>
                Checkout
            </Typography>

            <Grid container spacing={3}>

                <Grid item xs={12} md={7}>

                    <Stack spacing={3}>

                        <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB" }}>

                            <Typography fontWeight={700} sx={{ mb: 2 }}>
                                Delivery Type
                            </Typography>

                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                value={deliveryType}
                                onChange={(event, value) => value && setDeliveryType(value)}
                            >
                                <ToggleButton value="Delivery">
                                    <LocalMallOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                                    Delivery
                                </ToggleButton>
                                <ToggleButton value="Dine In">
                                    <RestaurantOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                                    Dine In
                                </ToggleButton>
                            </ToggleButtonGroup>

                            {deliveryType === "Delivery" && (

                                <Box sx={{ mt: 3 }}>

                                    {addresses.length === 0 ? (

                                        <Box sx={{ textAlign: "center", py: 3 }}>

                                            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                                You don't have any saved addresses yet.
                                            </Typography>

                                            <Button component={RouterLink} to={`/${tenantSlug}/addresses`} variant="outlined">
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
                                            >
                                                {addresses.map((address) => (
                                                    <MenuItem key={address.AddressId} value={address.AddressId}>
                                                        {address.AddressTitle} - {address.FullAddress}, {address.City}
                                                    </MenuItem>
                                                ))}
                                            </TextField>

                                            <Typography variant="body2" sx={{ mt: 1 }}>
                                                <RouterLink to={`/${tenantSlug}/addresses`}>Manage addresses</RouterLink>
                                            </Typography>

                                        </>

                                    )}

                                </Box>

                            )}

                        </Paper>

                        <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB" }}>

                            <Typography fontWeight={700} sx={{ mb: 2 }}>
                                Payment Method
                            </Typography>

                            <RadioGroup
                                row
                                value={paymentMethod}
                                onChange={(event) => setPaymentMethod(event.target.value)}
                            >
                                {PAYMENT_METHODS.map((method) => (
                                    <FormControlLabel
                                        key={method}
                                        value={method}
                                        control={<Radio />}
                                        label={method}
                                    />
                                ))}
                            </RadioGroup>

                        </Paper>

                        <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB" }}>

                            <Typography fontWeight={700} sx={{ mb: 2 }}>
                                Order Notes (optional)
                            </Typography>

                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                placeholder="Any special instructions for the kitchen..."
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                            />

                        </Paper>

                    </Stack>

                </Grid>

                <Grid item xs={12} md={5}>

                    <Paper elevation={0} sx={{ p: 3, border: "1px solid #E5E7EB", position: "sticky", top: 88 }}>

                        <Typography fontWeight={700} sx={{ mb: 2 }}>
                            Order Summary
                        </Typography>

                        <Stack spacing={1.5} sx={{ mb: 2 }}>

                            {cartItems.map((item) => {

                                const optionsSummary = item.SelectedOptions && item.SelectedOptions.length > 0
                                    ? item.SelectedOptions.map((option) => option.OptionName).join(", ")
                                    : null;

                                return (

                                    <Box key={item.CartId} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>

                                        <Box sx={{ minWidth: 0 }}>

                                            <Typography variant="body2">
                                                {item.ItemName} <Chip label={`x${item.Quantity}`} size="small" sx={{ ml: 0.5 }} />
                                            </Typography>

                                            {optionsSummary ? (
                                                <Typography variant="caption" color="text.secondary" component="div" noWrap>
                                                    {optionsSummary}
                                                </Typography>
                                            ) : null}

                                        </Box>

                                        <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
                                            ₹{Number(item.TotalPrice).toFixed(2)}
                                        </Typography>

                                    </Box>

                                );

                            })}

                        </Stack>

                        <Divider sx={{ mb: 2 }} />

                        <Box sx={{ mb: 2 }}>

                            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                                Have a coupon?
                            </Typography>

                            {appliedCoupon ? (

                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, bgcolor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 1, px: 1.5, py: 1 }}>

                                    <Typography variant="body2" sx={{ color: "#166534" }}>
                                        Coupon <strong>{appliedCoupon.code}</strong> applied: -₹{discountAmount.toFixed(2)}
                                    </Typography>

                                    <Button size="small" onClick={handleRemoveCoupon}>
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

                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                            <Typography fontWeight={700}>Subtotal</Typography>
                            <Typography fontWeight={700}>₹{subtotal.toFixed(2)}</Typography>
                        </Box>

                        {appliedCoupon ? (

                            <>

                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                    <Typography variant="body2" sx={{ color: "#166534" }}>Coupon Discount</Typography>
                                    <Typography variant="body2" sx={{ color: "#166534" }}>-₹{discountAmount.toFixed(2)}</Typography>
                                </Box>

                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                    <Typography fontWeight={700}>Estimated Total</Typography>
                                    <Typography fontWeight={700}>₹{estimatedTotalAfterDiscount.toFixed(2)}</Typography>
                                </Box>

                            </>

                        ) : null}

                        <Typography variant="caption" color="text.secondary">
                            + GST added at checkout
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
