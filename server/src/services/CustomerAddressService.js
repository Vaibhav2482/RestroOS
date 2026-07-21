import * as CustomerAddressRepository from "../repositories/CustomerAddressRepository.js";

const validate = (address) => {

    if (!address.addressTitle || address.addressTitle.trim() === "") {
        return "Address Title is required.";
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

export const updateCustomerAddress = async (addressId, address) => {

    const validationError = validate(address);

    if (validationError) {
        return { success: false, message: validationError };
    }

    const updated = await CustomerAddressRepository.updateCustomerAddress({ ...address, addressId: Number(addressId) });

    return { success: true, message: "Address updated successfully.", data: updated };

};

export const deleteCustomerAddress = async (addressId) => {

    const existing = await CustomerAddressRepository.getCustomerAddressById(addressId);

    if (!existing) {
        return { success: false, message: "Address not found." };
    }

    await CustomerAddressRepository.deleteCustomerAddress(addressId);

    return { success: true, message: "Address deleted successfully." };

};
