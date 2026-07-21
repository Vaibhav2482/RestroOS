import * as CategoryRepository from "../repositories/CategoryRepository.js";

export const getAllCategoriesByTenantSlug = async (tenantSlug) => {

    if (!tenantSlug) {
        return { success: false, message: "Restaurant is required." };
    }

    const categories = await CategoryRepository.getAllCategoriesByTenantSlug(tenantSlug);

    return { success: true, message: "Categories fetched successfully.", data: categories };

};

export const getAllCategories = async (tenantId) => {

    const categories = await CategoryRepository.getAllCategories(tenantId);

    return { success: true, message: "Categories fetched successfully.", data: categories };

};

// tenantId is optional here - this is reached both from the public,
// unauthenticated customer storefront (no tenant to check against) and from
// an authenticated admin route (where it's enforced).
export const getCategoryById = async (categoryId, tenantId) => {

    const category = await CategoryRepository.getCategoryById(categoryId);

    if (!category || (tenantId !== undefined && category.TenantId !== tenantId)) {
        return { success: false, message: "Category not found." };
    }

    return { success: true, message: "Category fetched successfully.", data: category };

};

export const createCategory = async (category, tenantId) => {

    category.categoryName = category.categoryName?.trim();
    category.description = category.description?.trim();

    if (!category.categoryName) {
        return { success: false, message: "Category Name is required." };
    }

    if (!category.displayOrder || category.displayOrder <= 0) {
        return { success: false, message: "Display Order must be greater than 0." };
    }

    const existingCategory = await CategoryRepository.checkCategoryExists(tenantId, category.categoryName);

    if (existingCategory.length > 0) {
        return { success: false, message: "Category already exists." };
    }

    const result = await CategoryRepository.createCategory({ ...category, tenantId });

    return { success: true, message: "Category created successfully.", data: result };

};

export const updateCategory = async (categoryId, category, tenantId) => {

    category.categoryId = Number(categoryId);
    category.categoryName = category.categoryName?.trim();
    category.description = category.description?.trim();

    if (!category.categoryName) {
        return { success: false, message: "Category Name is required." };
    }

    if (!category.displayOrder || category.displayOrder <= 0) {
        return { success: false, message: "Display Order must be greater than 0." };
    }

    const existingCategory = await CategoryRepository.getCategoryById(categoryId);

    if (!existingCategory || existingCategory.TenantId !== tenantId) {
        return { success: false, message: "Category not found." };
    }

    const duplicateCategory = await CategoryRepository.checkCategoryExistsForUpdate(tenantId, categoryId, category.categoryName);

    if (duplicateCategory.length > 0) {
        return { success: false, message: "Category already exists." };
    }

    if (category.isActive === undefined) {
        category.isActive = true;
    }

    const updated = await CategoryRepository.updateCategory(category);

    return { success: true, message: "Category updated successfully.", data: updated };

};

export const deleteCategory = async (categoryId, tenantId) => {

    const category = await CategoryRepository.getCategoryById(categoryId);

    if (!category || category.TenantId !== tenantId) {
        return { success: false, message: "Category not found." };
    }

    await CategoryRepository.deleteCategory(categoryId);

    return { success: true, message: "Category deleted successfully." };

};
