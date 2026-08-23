import { useCallback, useRef, useState } from "react";
import { Autocomplete, GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Box, Button, TextField, Typography } from "@mui/material";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import toast from "react-hot-toast";

const LIBRARIES = ["places"];
const MAP_CONTAINER_STYLE = { width: "100%", height: "220px", borderRadius: "12px" };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India, roughly centered - only used before a pin exists.

// Pulls city/state/pincode out of a Geocoder result the same way Places'
// formatted_address is used above - address_components is an unordered bag
// of {long_name, types[]}, so each field is picked out by its type rather
// than by position.
const parseAddressComponents = (components = []) => {

    const findByType = (type) => components.find((component) => component.types.includes(type))?.long_name || "";

    return {
        city: findByType("locality") || findByType("postal_town") || findByType("administrative_area_level_2"),
        state: findByType("administrative_area_level_1"),
        pincode: findByType("postal_code")
    };

};

// Optional by design - VITE_GOOGLE_MAPS_API_KEY may not be set, and this
// component renders nothing at all when it isn't, so BranchDialog's
// existing plain text fields keep working unchanged. Mirrors storefront's
// MapLocationPicker (separate apps, no shared package to put this in).
function MapLocationPicker({ latitude, longitude, onPick }) {

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: apiKey || "",
        libraries: LIBRARIES
    });

    const autocompleteRef = useRef(null);
    const geocoderRef = useRef(null);
    const [locating, setLocating] = useState(false);

    const hasPin = typeof latitude === "number" && typeof longitude === "number";
    const center = hasPin ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;

    // Reverse geocoding is best-effort - a pin still drops (and the admin
    // can always type the address themselves) even if this fails or the
    // Geocoding API isn't enabled on the caller's Google Cloud project, so
    // errors here are swallowed rather than surfaced as a toast.
    const reverseGeocode = useCallback(async (lat, lng) => {

        if (!geocoderRef.current) {
            geocoderRef.current = new window.google.maps.Geocoder();
        }

        try {

            const { results } = await geocoderRef.current.geocode({ location: { lat, lng } });
            const result = results?.[0];

            if (!result) {
                return {};
            }

            return { formattedAddress: result.formatted_address || "", ...parseAddressComponents(result.address_components) };

        } catch {

            return {};

        }

    }, []);

    const handlePlaceChanged = useCallback(() => {

        const place = autocompleteRef.current?.getPlace();
        const location = place?.geometry?.location;

        if (!location) {
            return;
        }

        onPick({
            latitude: location.lat(),
            longitude: location.lng(),
            formattedAddress: place.formatted_address || "",
            ...parseAddressComponents(place.address_components)
        });

    }, [onPick]);

    const pickWithReverseGeocode = useCallback(async (lat, lng) => {

        onPick({ latitude: lat, longitude: lng });

        const details = await reverseGeocode(lat, lng);

        if (Object.keys(details).length > 0) {
            onPick({ latitude: lat, longitude: lng, ...details });
        }

    }, [onPick, reverseGeocode]);

    const handleMapClick = useCallback((event) => {
        pickWithReverseGeocode(event.latLng.lat(), event.latLng.lng());
    }, [pickWithReverseGeocode]);

    const handleMarkerDragEnd = useCallback((event) => {
        pickWithReverseGeocode(event.latLng.lat(), event.latLng.lng());
    }, [pickWithReverseGeocode]);

    const handleUseCurrentLocation = () => {

        if (!navigator.geolocation) {
            toast.error("Your browser doesn't support location detection.");
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                await pickWithReverseGeocode(position.coords.latitude, position.coords.longitude);
                setLocating(false);
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
                        placeholder="Search for the branch's location..."
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
