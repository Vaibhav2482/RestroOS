import { describe, it, expect, vi } from "vitest";

import { resolveMenuItemOptions } from "./menuOptionResolver.js";

const REQUIRED_GROUP = { GroupId: 1, GroupName: "Butter", IsRequired: true, MinSelect: 1, MaxSelect: 5 };

const makeQueryable = (groups, options) => ({
    query: vi.fn()
        .mockResolvedValueOnce({ rows: groups })
        .mockResolvedValueOnce({ rows: options })
});

describe("resolveMenuItemOptions - a Required group with no available options", () => {

    // A group can end up with zero available options two ways: it was
    // created and marked Required before anyone added an actual option to
    // it, or every option under it was since deactivated. Either way, a
    // customer has nothing to select - enforcing the requirement anyway
    // makes the *entire item* permanently unorderable (see
    // ItemCustomizationDialog's canSubmit, which mirrors this exact check)
    // instead of just this one customization not applying.
    it("does not block ordering when the required group has zero options at all", async () => {

        const queryable = makeQueryable([REQUIRED_GROUP], []);

        await expect(resolveMenuItemOptions(queryable, 10, [])).resolves.toEqual({
            priceDelta: 0,
            selectedOptions: []
        });

    });

    it("still enforces the requirement once the group actually has an available option", async () => {

        const queryable = makeQueryable(
            [REQUIRED_GROUP],
            [{ OptionId: 101, GroupId: 1, OptionName: "Extra Butter", PriceDelta: 10 }]
        );

        await expect(resolveMenuItemOptions(queryable, 10, [])).rejects.toThrow(
            '"Butter" requires at least 1 selection(s).'
        );

    });

    it("resolves correctly once a real selection is made", async () => {

        const queryable = makeQueryable(
            [REQUIRED_GROUP],
            [{ OptionId: 101, GroupId: 1, OptionName: "Extra Butter", PriceDelta: 10 }]
        );

        const result = await resolveMenuItemOptions(queryable, 10, [101]);

        expect(result.priceDelta).toBe(10);
        expect(result.selectedOptions).toEqual([
            { OptionId: 101, GroupName: "Butter", OptionName: "Extra Butter", PriceDelta: 10 }
        ]);

    });

    it("still enforces MaxSelect regardless of how many options are available", async () => {

        const group = { ...REQUIRED_GROUP, MaxSelect: 1 };
        const queryable = makeQueryable(
            [group],
            [
                { OptionId: 101, GroupId: 1, OptionName: "Salted", PriceDelta: 0 },
                { OptionId: 102, GroupId: 1, OptionName: "Unsalted", PriceDelta: 0 }
            ]
        );

        await expect(resolveMenuItemOptions(queryable, 10, [101, 102])).rejects.toThrow(
            '"Butter" allows at most 1 selection(s).'
        );

    });

});
