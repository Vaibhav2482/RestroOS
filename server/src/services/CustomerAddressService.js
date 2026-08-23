import * as CustomerAddressRepository from "../repositories/CustomerAddressRepository.js";

const ADDRESS_TYPES = new Set(["Home", "Work", "Other"]);

const validate = (address) => {

    if (!address.addressTitle || address.addressTitle.trim() === "") {
        return "Address Title is required.";
    }

    // Optional - a row saved before this existed (or a caller that skips
    // it) just has no type, and the frontend falls back to inferring one
    // from the title text for display.
    if (address.addressType && !ADDRESS_TYPES.has(address.addressType)) {
        return "Address type must be Home, Work, or Other.";
    }

    if (!address.fullAddress || address.fullAddress.trim() === "") {
        return "Full Address is required.";
    }

    if (!address.city || address.city.trim() === "") {
        return "City is required.";
    }

    if (!address.state || address.state.trim() === "") {
        return "State is required.";
    }

    if (!address.pincode || address.pincode.trim() === "") {
        return "Pincode is required.";
    }

    return null;

};

export const createCustomerAddress = async (address) => {

    if (!address.customerId) {
        return { success: false, message: "Customer Id is required." };
    }

    const validationError = validate(address);

    if (validationError) {
        return { success: false, message: validationError };
    }

    const created = await CustomerAddressRepository.createCustomerAddress(address);

    return { success: true, message: "Customer Address created successfully.", data: created };

};

export const getCustomerAddresses = async (customerId) => {

    const addresses = await CustomerAddressRepository.getCustomerAddresses(customerId);

    return { success: true, message: "Addresses fetched successfully.", data: addresses };

};

export const getCustomerAddressById = async (addressId) => {

    return CustomerAddressRepository.getCustomerAddressById(addressId);

};

export const updateCustomerAddress = async (addressId, address, tenantId) => {

    const validationError = validate(address);

    if (validationError) {
        return { success: false, message: validationError };
    }

    const updated = await CustomerAddressRepository.updateCustomerAddress({ ...address, addressId: Number(addressId) }, tenantId);

    if (!updated) {
        return { success: false, message: "Address not found." };
    }

    return { success: true, message: "Address updated successfully.", data: updated };

};

export const deleteCustomerAddress = async (addressId, tenantId) => {

    const existing = await CustomerAddressRepository.getCustomerAddressById(addressId);

    if (!existing) {
        return { success: false, message: "Address not found." };
    }

    await CustomerAddressRepository.deleteCustomerAddress(addressId, tenantId);

    return { success: true, message: "Address deleted successfully." };

};
