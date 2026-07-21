import * as MenuOptionRepository from "../repositories/MenuOptionRepository.js";

export const getGroupsForMenuItem = async (menuItemId) => {

    const groups = await MenuOptionRepository.getGroupsForMenuItem(menuItemId);

    return { success: true, message: "Option groups fetched successfully.", data: groups };

};

export const createGroup = async (group) => {

    if (!group.menuItemId) {
        return { success: false, message: "Menu Item Id is required." };
    }

    if (!group.groupName || group.groupName.trim() === "") {
        return { success: false, message: "Group Name is required." };
    }

    if (group.minSelect < 0 || group.maxSelect < 1 || group.minSelect > group.maxSelect) {
        return { success: false, message: "Min/Max selection values are invalid." };
    }

    const created = await MenuOptionRepository.createGroup(group);

    return { success: true, message: "Option group created successfully.", data: created };

};

export const updateGroup = async (groupId, group) => {

    if (!group.groupName || group.groupName.trim() === "") {
        return { success: false, message: "Group Name is required." };
    }

    if (group.minSelect < 0 || group.maxSelect < 1 || group.minSelect > group.maxSelect) {
        return { success: false, message: "Min/Max selection values are invalid." };
    }

    const updated = await MenuOptionRepository.updateGroup({ ...group, groupId: Number(groupId) });

    return { success: true, message: "Option group updated successfully.", data: updated };

};

export const deleteGroup = async (groupId) => {

    await MenuOptionRepository.deleteGroup(groupId);

    return { success: true, message: "Option group deleted successfully." };

};

export const createOption = async (groupId, option) => {

    if (!option.optionName || option.optionName.trim() === "") {
        return { success: false, message: "Option Name is required." };
    }

    const created = await MenuOptionRepository.createOption({ ...option, groupId: Number(groupId) });

    return { success: true, message: "Option created successfully.", data: created };

};

export const updateOption = async (optionId, option) => {

    if (!option.optionName || option.optionName.trim() === "") {
        return { success: false, message: "Option Name is required." };
    }

    const updated = await MenuOptionRepository.updateOption({ ...option, optionId: Number(optionId) });

    return { success: true, message: "Option updated successfully.", data: updated };

};

export const deleteOption = async (optionId) => {

    await MenuOptionRepository.deleteOption(optionId);

    return { success: true, message: "Option deleted successfully." };

};
