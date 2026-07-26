-- Attaches to the existing branch-scoped MenuItems, not a new tenant-level
-- shared item definition (see FRS gap-analysis A2) - a deliberate scope
-- decision to avoid restructuring a table every existing screen reads.
-- Known limitation: the same dish at two branches needs its recipe entered
-- twice today, same limitation the existing menu data already has.
CREATE TABLE "MenuItemRecipes" (
    "RecipeItemId" INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    "MenuItemId" INT NOT NULL,
    "IngredientId" INT NOT NULL,
    "Quantity" NUMERIC(12, 3) NOT NULL,
    "Unit" VARCHAR(10) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP NULL,
    PRIMARY KEY ("RecipeItemId"),
    CONSTRAINT "UQ_Recipe_MenuItem_Ingredient" UNIQUE ("MenuItemId", "IngredientId")
);

ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_MenuItems" FOREIGN KEY ("MenuItemId") REFERENCES "MenuItems"("MenuItemId") ON DELETE CASCADE;
ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_Ingredients" FOREIGN KEY ("IngredientId") REFERENCES "Ingredients"("IngredientId");
ALTER TABLE "MenuItemRecipes" ADD CONSTRAINT "FK_Recipe_Units" FOREIGN KEY ("Unit") REFERENCES "Units"("UnitCode");
