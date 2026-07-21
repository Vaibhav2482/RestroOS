import axiosClient from "../api/axiosClient";

// Public, unauthenticated endpoint - returns the option groups (and their
// options) available for customizing a given menu item. Used to populate
// the ItemCustomizationDialog before adding an item to the cart.
export const getGroupsForMenuItem = async (menuItemId) => {
    const response = await axiosClient.get(`/menu-options/menu-item/${menuItemId}`);
    return response.data;
};
