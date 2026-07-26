import * as CategoryRepository from "../repositories/CategoryRepository.js";
import * as MenuRepository from "../repositories/MenuRepository.js";

// One-time content seed for the "ccc" (Chai Chakana Company) tenant,
// requested directly by the restaurant owner: fill in the categories that
// had zero items yet, and add several categories/items from their real
// physical menu that weren't in the system at all. Every insert is guarded
// by an existence check (checkCategoryExists / checkMenuItemExists), so
// this is safe to leave wired in - it becomes a no-op once everything
// listed here already exists, regardless of how many times a cold start
// re-runs it.
const TENANT_ID = 1;
const BRANCH_ID = 1;

const img = (keyword, lock) => `https://loremflickr.com/400/400/${keyword}?lock=${lock}`;

const EXISTING_CATEGORY_ITEMS = [
    {
        categoryId: 5, // Soups
        items: [
            { itemName: "Tomato Soup", description: "Classic Indian-style tomato soup.", price: 60, imageUrl: img("tomato-soup", 501) },
            { itemName: "Sweet Corn Soup", description: "Veg sweet corn soup.", price: 70, imageUrl: img("corn-soup", 502) },
            { itemName: "Hot & Sour Soup", description: "Spicy and tangy veg soup.", price: 70, imageUrl: img("hot-sour-soup", 503) }
        ]
    },
    {
        categoryId: 6, // Salad
        items: [
            { itemName: "Salad Bowl", description: "Cucumber, lettuce, tomato.", price: 69, imageUrl: img("salad-bowl", 504) },
            { itemName: "Mix Fruit Bowl", description: "Seasonal fresh fruit bowl.", price: 99, imageUrl: img("fruit-bowl", 505) },
            { itemName: "Mix Fruit Custard Bowl", description: "Fresh fruit with custard.", price: 139, imageUrl: img("fruit-custard", 506) }
        ]
    },
    {
        categoryId: 7, // Beverages
        items: [
            { itemName: "Rooh Afza", description: "Chilled rose sherbet.", price: 59, imageUrl: img("rose-drink", 507) },
            { itemName: "Lime Juice", description: "Sweet, salt, or mixed.", price: 59, imageUrl: img("lime-juice", 508) },
            { itemName: "Buttermilk / Chaas", description: "Spiced chilled buttermilk.", price: 59, imageUrl: img("buttermilk", 509) },
            { itemName: "Kesar Thandai", description: "Saffron milk cooler.", price: 89, imageUrl: img("thandai", 510) }
        ]
    }
];

const NEW_CATEGORIES = [
    {
        categoryName: "Chatpata Corner",
        description: "Street-style chaat.",
        displayOrder: 8,
        imageUrl: img("chaat", 520),
        items: [
            { itemName: "Pani Puri", description: "6 pieces.", price: 39, imageUrl: img("panipuri", 521) },
            { itemName: "Dahi Puri", description: "Puri with curd and chutneys.", price: 89, imageUrl: img("dahipuri", 522) },
            { itemName: "Bhel Puri", description: "Puffed rice chaat.", price: 79, imageUrl: img("bhelpuri", 523) },
            { itemName: "Samosa Ragada Chaat", description: "Samosa with ragada and chutneys.", price: 129, imageUrl: img("samosa-chaat", 524) }
        ]
    },
    {
        categoryName: "Momos",
        description: "Steamed veg momos, 5 pieces.",
        displayOrder: 9,
        imageUrl: img("momos", 530),
        items: [
            { itemName: "Veg Momo", description: "5 pieces.", price: 109, imageUrl: img("veg-momo", 531) },
            { itemName: "Paneer Momo", description: "5 pieces.", price: 139, imageUrl: img("paneer-momo", 532) },
            { itemName: "Mushroom Cheese Momo", description: "5 pieces.", price: 169, imageUrl: img("mushroom-momo", 533) }
        ]
    },
    {
        categoryName: "Poori & Kachori",
        description: "Served with aloo curry.",
        displayOrder: 10,
        imageUrl: img("kachori", 540),
        items: [
            { itemName: "Poori - Aloo Curry", description: "UP-style poori with aloo curry.", price: 119, imageUrl: img("poori", 541) },
            { itemName: "Kachori - Aloo Curry", description: "Kachori with aloo curry.", price: 139, imageUrl: img("kachori-curry", 542) }
        ]
    },
    {
        categoryName: "Chole Bhature",
        description: "Delhi-style chole bhature.",
        displayOrder: 11,
        imageUrl: img("chole-bhature", 550),
        items: [
            { itemName: "Dilli Chole Bhature", description: "Fluffy bhature with chole.", price: 129, imageUrl: img("chole", 551) }
        ]
    },
    {
        categoryName: "Rice & More",
        description: "Fried rice and pulao.",
        displayOrder: 12,
        imageUrl: img("fried-rice", 560),
        items: [
            { itemName: "Veg Fried Rice", description: "Street-style veg fried rice.", price: 129, imageUrl: img("veg-fried-rice", 561) },
            { itemName: "Lemon Coriander Rice", description: "Tangy lemon coriander rice.", price: 139, imageUrl: img("lemon-rice", 562) },
            { itemName: "Tawa Paneer Pulao", description: "Paneer pulao with spices.", price: 169, imageUrl: img("paneer-pulao", 563) }
        ]
    },
    {
        categoryName: "Parathas",
        description: "Home-style stuffed parathas.",
        displayOrder: 13,
        imageUrl: img("paratha", 570),
        items: [
            { itemName: "Aloo Paratha", description: "With homemade white butter.", price: 109, imageUrl: img("aloo-paratha", 571) },
            { itemName: "Paneer Paratha", description: "With homemade white butter.", price: 139, imageUrl: img("paneer-paratha", 572) },
            { itemName: "Sweet Paratha", description: "Sugar or jaggery.", price: 109, imageUrl: img("sweet-paratha", 573) }
        ]
    }
];

const seedItems = async (categoryId, items) => {

    for (const item of items) {

        const existing = await MenuRepository.checkMenuItemExists(item.itemName, BRANCH_ID);

        if (existing.length > 0) {
            continue;
        }

        await MenuRepository.createMenuItem({
            branchId: BRANCH_ID,
            categoryId,
            itemName: item.itemName,
            description: item.description,
            price: item.price,
            imageUrl: item.imageUrl,
            isVeg: true,
            isAvailable: true,
            isPopular: false,
            isActive: true
        });

    }

};

let seeded = false;

export const seedChaiChakhnaMenu = async () => {

    if (seeded) {
        return;
    }

    for (const group of EXISTING_CATEGORY_ITEMS) {
        await seedItems(group.categoryId, group.items);
    }

    for (const category of NEW_CATEGORIES) {

        const existing = await CategoryRepository.checkCategoryExists(TENANT_ID, category.categoryName);

        let categoryId;

        if (existing.length > 0) {
            categoryId = existing[0].CategoryId;
        } else {

            const created = await CategoryRepository.createCategory({
                tenantId: TENANT_ID,
                categoryName: category.categoryName,
                description: category.description,
                imageUrl: category.imageUrl,
                displayOrder: category.displayOrder
            });

            categoryId = created.CategoryId;

        }

        await seedItems(categoryId, category.items);

    }

    seeded = true;

};
