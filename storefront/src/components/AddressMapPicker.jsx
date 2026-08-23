import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { Box, Button, Dialog, IconButton, InputAdornment, Paper, TextField, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";

import { reverseGeocode } from "../utils/geocoding";

const LIBRARIES = ["places"];
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India, roughly centered - only used when geolocation isn't available/granted.

// Full-screen, Swiggy/Zomato-style "drop a pin" step: the pin stays fixed
// at the exact center of the screen and the map pans underneath it - once
// panning settles (onIdle), the center coordinate is reverse-geocoded and
// shown on the bottom confirm card. This is step 1 of adding an address;
// AddressDialog (step 2) handles the house number/landmark/label details
// once a location's been confirmed here.
function AddressMapPicker({ open, onClose, onConfirm }) {

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: apiKey || "",
        libraries: LIBRARIES
    });

    const mapRef = useRef(null);
    const geocoderRef = useRef(null);
    const autocompleteRef = useRef(null);
    const idleTimerRef = useRef(null);

    const [resolving, setResolving] = useState(false);
    const [resolved, setResolved] = useState(null);

    const resolveCenter = useCallback(async () => {

        const map = mapRef.current;

        if (!map) {
            return;
        }

        if (!geocoderRef.current) {
            geocoderRef.current = new window.google.maps.Geocoder();
        }

        const center = map.getCenter();

        setResolving(true);

        const result = await reverseGeocode(geocoderRef.current, center.lat(), center.lng());

        setResolving(false);
        setResolved(result);

    }, []);

    // Debounced - onIdle can fire in a burst while a drag settles, and each
    // call is a billed Geocoding API request.
    const handleIdle = useCallback(() => {

        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(resolveCenter, 400);

    }, [resolveCenter]);

    // Centers on the customer's current location the moment the map opens,
    // the same way Swiggy's picker already has a resolved address on
    // screen before you touch anything - falls back to DEFAULT_CENTER
    // (and stays there) if geolocation isn't available or is denied.
    useEffect(() => {

        if (!open || !isLoaded) {
            return;
        }

        if (navigator.geolocation) {

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    mapRef.current?.panTo({ lat: position.coords.latitude, lng: position.coords.longitude });
                    mapRef.current?.setZoom(17);
                    resolveCenter();
                },
                () => resolveCenter(),
                { enableHighAccuracy: true, timeout: 8000 }
            );

        } else {

            resolveCenter();

        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isLoaded]);

    const handleUseCurrentLocation = () => {

        if (!navigator.geolocation) {
            return;
        }

        setResolving(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                mapRef.current?.panTo({ lat: position.coords.latitude, lng: position.coords.longitude });
                mapRef.current?.setZoom(17);
            },
            () => setResolving(false),
            { enableHighAccuracy: true, timeout: 8000 }
        );

    };

    const handlePlaceChanged = () => {

        const place = autocompleteRef.current?.getPlace();
        const location = place?.geometry?.location;

        if (!location) {
            return;
        }

        mapRef.current?.panTo(location);
        mapRef.current?.setZoom(17);

    };

    const handleConfirm = () => {

        if (!resolved) {
            return;
        }

        onConfirm(resolved);

    };

    if (!apiKey) {
        return null;
    }

    return (

        <Dialog open={open} onClose={onClose} fullScreen>

            {!isLoaded ? (

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                    <Typography color="text.secondary">Loading map...</Typography>
                </Box>

            ) : (

                <Box sx={{ position: "relative", height: "100%", width: "100%" }}>

                    <GoogleMap
                        mapContainerStyle={MAP_CONTAINER_STYLE}
                        center={DEFAULT_CENTER}
                        zoom={5}
                        onLoad={(map) => { mapRef.current = map; }}
                        onIdle={handleIdle}
                        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false, zoomControl: false }}
                    />

                    {/* Fixed at the exact center of the map div - the map pans
                        underneath it, so this never itself moves. */}
                    <Box
                        sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -100%)",
                            pointerEvents: "none",
                            zIndex: 2
                        }}
                    >
                        <RoomRoundedIcon sx={{ fontSize: 44, color: "primary.main", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }} />
                    </Box>

                    <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, p: 2, display: "flex", gap: 1, zIndex: 3 }}>

                        <Paper elevation={2} sx={{ borderRadius: "50%" }}>
                            <IconButton onClick={onClose}>
                                <ArrowBackRoundedIcon />
                            </IconButton>
                        </Paper>

                        <Autocomplete onLoad={(instance) => { autocompleteRef.current = instance; }} onPlaceChanged={handlePlaceChanged}>
                            <TextField
                                fullWidth
                                placeholder="Search an area or address"
                                sx={{ bgcolor: "background.paper", borderRadius: 2, "& fieldset": { border: "none" } }}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchRoundedIcon color="action" />
                                            </InputAdornment>
                                        )
                                    }
                                }}
                            />
                        </Autocomplete>

                    </Box>

                    <Box sx={{ position: "absolute", right: 16, bottom: 200, zIndex: 3 }}>
                        <Button
                            variant="contained"
                            color="inherit"
                            size="small"
                            startIcon={<MyLocationRoundedIcon fontSize="small" />}
                            onClick={handleUseCurrentLocation}
                            sx={{ bgcolor: "background.paper", "&:hover": { bgcolor: "background.paper" } }}
                        >
                            Current location
                        </Button>
                    </Box>

                    <Paper
                        elevation={4}
                        sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: 2.5, borderRadius: "16px 16px 0 0", zIndex: 3 }}
                    >

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Place the pin at exact delivery location
                        </Typography>

                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 2, minHeight: 44 }}>

                            <RoomRoundedIcon color="primary" sx={{ mt: 0.25 }} />

                            <Box sx={{ minWidth: 0 }}>

                                {resolving ? (
                                    <Typography color="text.secondary">Locating address...</Typography>
                                ) : resolved ? (
                                    <>
                                        <Typography fontWeight={700} noWrap>{resolved.shortName || resolved.city || "Selected location"}</Typography>
                                        <Typography variant="body2" color="text.secondary">{resolved.formattedAddress}</Typography>
                                    </>
                                ) : (
                                    <Typography color="text.secondary">Move the map to select a location</Typography>
                                )}

                            </Box>

                        </Box>

                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={!resolved || resolving}
                            onClick={handleConfirm}
                        >
                            Confirm &amp; proceed
                        </Button>

                    </Paper>

                </Box>

            )}

        </Dialog>

    );

}

export default AddressMapPicker;
