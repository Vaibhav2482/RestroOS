import * as CustomerRepository from "../repositories/CustomerRepository.js";

export const getCustomerById = async (customerId) => {

    const customer = await CustomerRepository.getCustomerById(customerId);

    if (!customer) {
        return { success: false, message: "Customer not found." };
    }

    return { success: true, message: "Customer fetched successfully.", data: customer };

};

export const updateCustomer = async (customerId, customer) => {

    const existingCustomer = await CustomerRepository.getCustomerById(customerId);

    if (!existingCustomer) {
        return { success: false, message: "Customer not found." };
    }

    customer.customerId = Number(customerId);

    const updatedCustomer = await CustomerRepository.updateCustomer(customer);

    return { success: true, message: "Customer updated successfully.", data: updatedCustomer };

};

export const getAllCustomers = async (tenantId) => {

    const customers = await CustomerRepository.getAllCustomersByTenant(tenantId);

    return { success: true, message: "Customers fetched successfully.", data: customers };

};
