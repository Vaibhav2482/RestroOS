// Shared by Cart (addToCart) and Order creation (checkout + POS/admin direct
// create) - both need to turn a client-submitted list of OptionIds into a
// validated price delta and a display snapshot, and both must NEVER trust a
// client-sent price for this. Accepts a pool or an in-transaction client as
// `queryable` so callers running inside a transaction stay atomic.
export const resolveMenuItemOptions = async (queryable, menuItemId, selectedOptionIds = []) => {

    const groupsResult = await queryable.query(
        `SELECT "GroupId", "GroupName", "IsRequired", "MinSelect", "MaxSelect"
         FROM "MenuItemOptionGroups"
         WHERE "MenuItemId" = $1`,
        [menuItemId]
    );

    const optionsResult = await queryable.query(
        `SELECT O."OptionId", O."GroupId", O."OptionName", O."PriceDelta"
         FROM "MenuItemOptions" O
         INNER JOIN "MenuItemOptionGroups" G ON O."GroupId" = G."GroupId"
         WHERE G."MenuItemId" = $1 AND O."IsActive" = TRUE`,
        [menuItemId]
    );

    const selectedIdSet = new Set(selectedOptionIds.map(Number));
    const selectedOptions = optionsResult.rows.filter((option) => selectedIdSet.has(option.OptionId));

    if (selectedOptions.length !== selectedIdSet.size) {
        throw new Error("One or more selected options are invalid for this item.");
    }

    for (const group of groupsResult.rows) {

        const countInGroup = selectedOptions.filter((option) => option.GroupId === group.GroupId).length;

        if (group.IsRequired && countInGroup < group.MinSelect) {
            throw new Error(`"${group.GroupName}" requires at least ${group.MinSelect} selection(s).`);
        }

        if (countInGroup > group.MaxSelect) {
            throw new Error(`"${group.GroupName}" allows at most ${group.MaxSelect} selection(s).`);
        }

    }

    const priceDelta = selectedOptions.reduce((sum, option) => sum + Number(option.PriceDelta), 0);

    const snapshot = selectedOptions
        .map((option) => {

            const group = groupsResult.rows.find((g) => g.GroupId === option.GroupId);

            return {
                OptionId: option.OptionId,
                GroupName: group?.GroupName ?? null,
                OptionName: option.OptionName,
                PriceDelta: Number(option.PriceDelta)
            };

        })
        .sort((a, b) => a.OptionId - b.OptionId);

    return { priceDelta, selectedOptions: snapshot };

};

// Cart line merging needs to tell "same item, same customizations" apart
// from "same item, different customizations" - two different variant
// selections of the same MenuItemId are different cart lines, not one
// line with an incremented quantity.
export const selectionsMatch = (a = [], b = []) => {

    const idsA = a.map((option) => option.OptionId).sort((x, y) => x - y);
    const idsB = b.map((option) => option.OptionId).sort((x, y) => x - y);

    return idsA.length === idsB.length && idsA.every((id, index) => id === idsB[index]);

};
