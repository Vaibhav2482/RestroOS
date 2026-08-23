import { useCallback, useRef, useState } from "react";
import { Autocomplete, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Box, Button, TextField, Typography } from "@mui/material";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import toast from "react-hot-toast";

const LIBRARIES = ["places"];
const MAP_CONTAINER_STYLE = { width: "100%", height: "220px", borderRadius: "12px" };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India, roughly centered - only used before a pin exists.

// Optional by design - VITE_GOOGLE_MAPS_API_KEY may not be set (the .env.example
// says as much), and this component renders nothing at all when it isn't,
// so AddressDialog's existing plain text fields keep working unchanged.
function MapLocationPicker({ latitude, longitude, onPick }) {

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: apiKey || "",
        libraries: LIBRARIES
    });

    const autocompleteRef = useRef(null);
    const [locating, setLocating] = useState(false);

    const hasPin = typeof latitude === "number" && typeof longitude === "number";
    const center = hasPin ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;

    const handlePlaceChanged = useCallback(() => {

        const place = autocompleteRef.current?.getPlace();
        const location = place?.geometry?.location;

        if (!location) {
            return;
        }

        onPick({
            latitude: location.lat(),
            longitude: location.lng(),
            formattedAddress: place.formatted_address || ""
        });

    }, [onPick]);

    const handleMapClick = useCallback((event) => {
        onPick({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
    }, [onPick]);

    const handleMarkerDragEnd = useCallback((event) => {
        onPick({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
    }, [onPick]);

    const handleUseCurrentLocation = () => {

        if (!navigator.geolocation) {
            toast.error("Your browser doesn't support location detection.");
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocating(false);
                onPick({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            },
            () => {
                setLocating(false);
                toast.error("Couldn't get your location. Check your browser's location permission.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );

    };

    if (!apiKey) {
        return null;
    }

    if (!isLoaded) {
        return (
            <Typography variant="body2" color="text.secondary">
                Loading map...
            </Typography>
        );
    }

    return (

        <Box>

            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>

                <Autocomplete onLoad={(instance) => { autocompleteRef.current = instance; }} onPlaceChanged={handlePlaceChanged}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search for your area, street..."
                    />
                </Autocomplete>

                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<MyLocationRoundedIcon />}
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    sx={{ whiteSpace: "nowrap" }}
                >
                    {locating ? "Locating..." : "Use my location"}
                </Button>

            </Box>

            <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={center}
                zoom={hasPin ? 16 : 5}
                onClick={handleMapClick}
                options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
            >
                {hasPin && <Marker position={center} draggable onDragEnd={handleMarkerDragEnd} />}
            </GoogleMap>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {hasPin ? "Drag the pin to fine-tune the exact spot." : "Search above, use your location, or tap the map to drop a pin."}
            </Typography>

        </Box>

    );

}

export default MapLocationPicker;
