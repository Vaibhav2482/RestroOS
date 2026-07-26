import pool from "../config/db.js";

// The first seed pass (seedChaiChakhnaMenu.js) used loremflickr.com
// keyword URLs for photos - Flickr's keyword search isn't reliable enough
// for specific dish names and returned wrong/unrelated photos for several
// items. Replaced here with real, verified Wikimedia Commons photos of
// the actual dish. A plain UPDATE keyed by name is naturally idempotent
// (re-running just sets the same value again), so no "already run" guard
// is needed the way the create-based seed needed one.
const TENANT_ID = 1;
const BRANCH_ID = 1;

const ITEM_IMAGES = {
    "Tomato Soup": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Tomato_soup%2C_plant-based_%2844040252791%29.jpg/500px-Tomato_soup%2C_plant-based_%2844040252791%29.jpg",
    "Sweet Corn Soup": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/An_aesthetic_Chicken_Sweetcorn_soup.jpg/500px-An_aesthetic_Chicken_Sweetcorn_soup.jpg",
    "Hot & Sour Soup": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Ping_SJ_hot_%26_sour_soup.JPG/500px-Ping_SJ_hot_%26_sour_soup.JPG",
    "Salad Bowl": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Cucumber_lettuce_tomato_and_onion_salad.jpg/500px-Cucumber_lettuce_tomato_and_onion_salad.jpg",
    "Mix Fruit Bowl": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Fruktsallad_%28Fruit_salad%29.jpg/500px-Fruktsallad_%28Fruit_salad%29.jpg",
    "Mix Fruit Custard Bowl": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Fruktsallad_%28Fruit_salad%29.jpg/500px-Fruktsallad_%28Fruit_salad%29.jpg",
    "Rooh Afza": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Rooh_Afza_%28Sharbat%29.JPG/500px-Rooh_Afza_%28Sharbat%29.JPG",
    "Lime Juice": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Mint_lemonade_in_summer.jpg/500px-Mint_lemonade_in_summer.jpg",
    "Buttermilk / Chaas": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Mint_lassi.jpg/500px-Mint_lassi.jpg",
    "Kesar Thandai": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Thandai_%28Spiced_Indian_Milk_Drink%29.JPG/500px-Thandai_%28Spiced_Indian_Milk_Drink%29.JPG",
    "Pani Puri": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Golgappa_%28Pani_Puri%29.jpg/500px-Golgappa_%28Pani_Puri%29.jpg",
    "Dahi Puri": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Dahi_puri_3.jpg/500px-Dahi_puri_3.jpg",
    "Bhel Puri": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Behael_Puri_%286105489342%29.jpg/500px-Behael_Puri_%286105489342%29.jpg",
    "Samosa Ragada Chaat": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Delicious_Ragda_Patties_.HEIC.jpg/500px-Delicious_Ragda_Patties_.HEIC.jpg",
    "Veg Momo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/500px-Momo_nepal.jpg",
    "Paneer Momo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/500px-Momo_nepal.jpg",
    "Mushroom Cheese Momo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/500px-Momo_nepal.jpg",
    "Poori - Aloo Curry": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Fluffy_Poori_%28cropped%29.JPG/500px-Fluffy_Poori_%28cropped%29.JPG",
    "Kachori - Aloo Curry": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Rajasthani_Raj_Kachori.jpg/500px-Rajasthani_Raj_Kachori.jpg",
    "Dilli Chole Bhature": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Chole_Bhature_from_Nagpur.JPG/500px-Chole_Bhature_from_Nagpur.JPG",
    "Veg Fried Rice": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Veg_fried_rice_with_manchurian_made_by_me.jpg/500px-Veg_fried_rice_with_manchurian_made_by_me.jpg",
    "Lemon Coriander Rice": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/South_Indian_Lemon_rice.jpg/500px-South_Indian_Lemon_rice.jpg",
    "Tawa Paneer Pulao": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/VEGETABLE_PULAO_~_An_Indian_cuisine_made_from_fried_rice_mixed_with_fried_vegetables.jpg/500px-VEGETABLE_PULAO_~_An_Indian_cuisine_made_from_fried_rice_mixed_with_fried_vegetables.jpg",
    "Aloo Paratha": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Aloo_Paratha_%2896238%29.jpg/500px-Aloo_Paratha_%2896238%29.jpg",
    "Paneer Paratha": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Triangle_paratha_%28cropped%29.JPG/500px-Triangle_paratha_%28cropped%29.JPG",
    "Sweet Paratha": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Triangle_paratha_%28cropped%29.JPG/500px-Triangle_paratha_%28cropped%29.JPG"
};

const CATEGORY_IMAGES = {
    "Chatpata Corner": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Behael_Puri_%286105489342%29.jpg/500px-Behael_Puri_%286105489342%29.jpg",
    "Momos": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Momo_nepal.jpg/500px-Momo_nepal.jpg",
    "Poori & Kachori": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Fluffy_Poori_%28cropped%29.JPG/500px-Fluffy_Poori_%28cropped%29.JPG",
    "Chole Bhature": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Chole_Bhature_from_Nagpur.JPG/500px-Chole_Bhature_from_Nagpur.JPG",
    "Rice & More": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Veg_fried_rice_with_manchurian_made_by_me.jpg/500px-Veg_fried_rice_with_manchurian_made_by_me.jpg",
    "Parathas": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Triangle_paratha_%28cropped%29.JPG/500px-Triangle_paratha_%28cropped%29.JPG"
};

let fixed = false;

export const fixMenuImages = async () => {

    if (fixed) {
        return;
    }

    for (const [itemName, imageUrl] of Object.entries(ITEM_IMAGES)) {

        await pool.query(
            `UPDATE "MenuItems" SET "ImageUrl" = $1 WHERE "ItemName" = $2 AND "BranchId" = $3`,
            [imageUrl, itemName, BRANCH_ID]
        );

    }

    for (const [categoryName, imageUrl] of Object.entries(CATEGORY_IMAGES)) {

        await pool.query(
            `UPDATE "Categories" SET "ImageUrl" = $1 WHERE "CategoryName" = $2 AND "TenantId" = $3`,
            [imageUrl, categoryName, TENANT_ID]
        );

    }

    fixed = true;

};
