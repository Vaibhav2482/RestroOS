// Shared between AddressMapPicker (the full-screen "drop a pin" step) and
// anywhere else in storefront that turns coordinates into an address -
// pulled out rather than left inline so both call sites parse
// address_components identically.

export const parseAddressComponents = (components = []) => {

    const findByType = (type) => components.find((component) => component.types.includes(type))?.long_name || "";

    return {
        // sublocality/neighborhood - the short, human "which part of town"
        // name shown as the headline on the confirm card (e.g. "Hanuman
        // Nagar"), distinct from the full formatted address below it.
        shortName: findByType("sublocality_level_1") || findByType("neighborhood") || findByType("sublocality"),
        city: findByType("locality") || findByType("postal_town") || findByType("administrative_area_level_2"),
        state: findByType("administrative_area_level_1"),
        pincode: findByType("postal_code")
    };

};

// Best-effort by design - a pin still drops (and the customer can always
// type the address themselves on the next screen) even if this fails or
// the Geocoding API isn't enabled on the caller's Google Cloud project.
export const reverseGeocode = async (geocoder, lat, lng) => {

    try {

        const { results } = await geocoder.geocode({ location: { lat, lng } });
        const result = results?.[0];

        if (!result) {
            return null;
        }

        return {
            latitude: lat,
            longitude: lng,
            formattedAddress: result.formatted_address || "",
            ...parseAddressComponents(result.address_components)
        };

    } catch {

        return null;

    }

};
