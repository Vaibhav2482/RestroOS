-- Menu item customization: variants (e.g. size options with their own
-- price) and add-ons (extra items with a price delta) are modeled as the
-- same underlying structure - a MenuItem has any number of OptionGroups,
-- each with its own selection rule (required-single, optional-single, or
-- multi-select up to N), and each Group has any number of Options, each
-- carrying a PriceDelta added on top of the item's base Price.
--
-- A "Quantity: 300ml/500ml/750ml, required, select 1" group is expressed
-- by setting the base MenuItems.Price to the smallest variant's price and
-- giving each Option a PriceDelta equal to (that option's price - base
-- price), so 500ml's delta is +120 if 300ml is the ₹259 base. A
-- "select up to 5 add-ons" group is expressed the normal way, each add-on
-- carrying its own positive PriceDelta.

ALTER TABLE "MenuItems" ADD COLUMN "IsVeg" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE "MenuItemOptionGroups" (
    "GroupId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "MenuItemId" INT NOT NULL,
    "GroupName" VARCHAR(100) NOT NULL,
    "IsRequired" BOOLEAN NOT NULL DEFAULT FALSE,
    "MinSelect" INT NOT NULL DEFAULT 0,
    "MaxSelect" INT NOT NULL DEFAULT 1,
    "DisplayOrder" INT NOT NULL DEFAULT 1,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("GroupId")
);

ALTER TABLE "MenuItemOptionGroups" ADD CONSTRAINT "FK_OptionGroups_MenuItems"
    FOREIGN KEY ("MenuItemId") REFERENCES "MenuItems"("MenuItemId") ON DELETE CASCADE;

CREATE TABLE "MenuItemOptions" (
    "OptionId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "GroupId" INT NOT NULL,
    "OptionName" VARCHAR(100) NOT NULL,
    "PriceDelta" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "IsDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "DisplayOrder" INT NOT NULL DEFAULT 1,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY ("OptionId")
);

ALTER TABLE "MenuItemOptions" ADD CONSTRAINT "FK_Options_Groups"
    FOREIGN KEY ("GroupId") REFERENCES "MenuItemOptionGroups"("GroupId") ON DELETE CASCADE;

-- Cart/OrderItems snapshot the resolved unit price and the selected option
-- names/deltas at add-time (same "copy, don't live-join" pattern OrderItems
-- already used for ItemName/Price) - a menu item's options can change later
-- without corrupting a customer's already-placed order or in-progress cart.
ALTER TABLE "Cart" ADD COLUMN "UnitPrice" NUMERIC(10, 2) NULL;
ALTER TABLE "Cart" ADD COLUMN "SelectedOptions" JSONB NULL;

ALTER TABLE "OrderItems" ADD COLUMN "SelectedOptions" JSONB NULL;
