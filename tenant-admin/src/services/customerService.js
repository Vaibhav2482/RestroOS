import axiosClient from "../api/axiosClient";

// params can additionally carry { page, limit, search } - passing either of
// page/limit opts into the paginated response shape ({ customers, total }),
// server-side; omitting both keeps the plain array every other caller of
// this shape still expects.
export const getAllCustomers = async (params = {}) => {
    const response = await axiosClient.get("/customers", { params });
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
