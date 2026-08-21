import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import MenuItemDialog from "./MenuItemDialog";

const CATEGORIES = [{ CategoryId: 1, CategoryName: "Beverages" }];

// MUI's Select doesn't wire up an accessible name the way a plain labelled
// input does, so a name-based role query for it doesn't resolve reliably
// under jsdom - there's only ever the one Category combobox in this dialog,
// so selecting by role alone is unambiguous.
const fillRequiredFields = async (user) => {
    await user.type(screen.getByLabelText(/item name/i), "Ginger Chai");
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Beverages" }));
    await user.type(screen.getByLabelText(/^price/i), "30");
};

describe("MenuItemDialog - GST rate", () => {

    it("defaults a new item's rate to 5% and includes it when saving", async () => {

        const user = userEvent.setup();
        const onSave = vi.fn();

        render(<MenuItemDialog open onClose={vi.fn()} onSave={onSave} categories={CATEGORIES} editingItem={null} saving={false} />);

        expect(screen.getByLabelText(/gst rate/i)).toHaveValue(5);

        await fillRequiredFields(user);
        await user.click(screen.getByRole("button", { name: /add item/i }));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ taxRatePercent: 5 }));

    });

    it("pre-fills an existing item's own rate when editing, not the default", async () => {

        render(
            <MenuItemDialog
                open
                onClose={vi.fn()}
                onSave={vi.fn()}
                categories={CATEGORIES}
                editingItem={{ MenuItemId: 1, CategoryId: 1, ItemName: "Butter Chicken", Price: 320, TaxRatePercent: 18 }}
                saving={false}
            />
        );

        expect(screen.getByLabelText(/gst rate/i)).toHaveValue(18);

    });

    it("rejects a rate outside 0-100 and does not call onSave", async () => {

        const user = userEvent.setup();
        const onSave = vi.fn();

        render(<MenuItemDialog open onClose={vi.fn()} onSave={onSave} categories={CATEGORIES} editingItem={null} saving={false} />);

        await fillRequiredFields(user);

        const rateField = screen.getByLabelText(/gst rate/i);
        await user.clear(rateField);
        await user.type(rateField, "150");

        await user.click(screen.getByRole("button", { name: /add item/i }));

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText(/tax rate must be between 0 and 100/i)).toBeInTheDocument();

    });

});
