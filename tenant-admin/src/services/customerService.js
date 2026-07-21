import axiosClient from "../api/axiosClient";

export const getAllCustomers = async () => {
    const response = await axiosClient.get("/customers");
    return response.data;
};

export const getCustomerById = async (id) => {
    const response = await axiosClient.get(`/customers/${id}`);
    return response.data;
};

// Resolves a real Customer row by phone (creating one if needed) so a
// walk-in diner can be attached to an order without ever setting a password.
export const findOrCreateWalkInCustomer = async (customer) => {
    const response = await axiosClient.post("/customers/walk-in", customer);
    return response.data;
};

// A single no-details placeholder customer for orders where staff don't
// want to collect a name/phone at all.
export const getOrCreateGuestCustomer = async () => {
    const response = await axiosClient.post("/customers/guest");
    return response.data;
};
