import { describe, it, expect, vi, beforeEach } from "vitest";

import * as MenuService from "./MenuService.js";
import * as MenuRepository from "../repositories/MenuRepository.js";
import * as BranchRepository from "../repositories/BranchRepository.js";
import * as CategoryRepository from "../repositories/CategoryRepository.js";
import * as AuditService from "./AuditService.js";

vi.mock("../repositories/MenuRepository.js");
vi.mock("../repositories/BranchRepository.js");
vi.mock("../repositories/CategoryRepository.js");
vi.mock("./AuditService.js");

const TENANT_ID = 9;
const ADMIN_ID = 1;

const validItem = () => ({
    branchId: 5,
    categoryId: 3,
    itemName: "Ginger Chai",
    description: "",
    price: 30
});

beforeEach(() => {

    vi.clearAllMocks();

    BranchRepository.getBranchById.mockResolvedValue({ BranchId: 5, TenantId: TENANT_ID });
    CategoryRepository.getCategoryById.mockResolvedValue({ CategoryId: 3, TenantId: TENANT_ID });
    MenuRepository.checkMenuItemExists.mockResolvedValue([]);
    MenuRepository.createMenuItem.mockResolvedValue({ MenuItemId: 100 });
    AuditService.record.mockResolvedValue();

});

// GST was one hardcoded rate for every order before this field existed - the
// point of these tests is that a new/updated item always ends up with a
// real, in-range rate, never silently missing or untaxed.
describe("MenuService.createMenuItem - tax rate", () => {

    it("defaults to 5% (the flat rate every item was already taxed at) when none is given", async () => {

        await MenuService.createMenuItem(validItem(), TENANT_ID, ADMIN_ID);

        expect(MenuRepository.createMenuItem).toHaveBeenCalledWith(
            expect.objectContaining({ taxRatePercent: 5 })
        );

    });

    it("accepts an explicit rate, e.g. 18% for a different tax slab", async () => {

        await MenuService.createMenuItem({ ...validItem(), taxRatePercent: 18 }, TENANT_ID, ADMIN_ID);

        expect(MenuRepository.createMenuItem).toHaveBeenCalledWith(
            expect.objectContaining({ taxRatePercent: 18 })
        );

    });

    it("rejects a negative rate", async () => {

        const result = await MenuService.createMenuItem({ ...validItem(), taxRatePercent: -1 }, TENANT_ID, ADMIN_ID);

        expect(result.success).toBe(false);
        expect(MenuRepository.createMenuItem).not.toHaveBeenCalled();

    });

    it("rejects a rate over 100", async () => {

        const result = await MenuService.createMenuItem({ ...validItem(), taxRatePercent: 101 }, TENANT_ID, ADMIN_ID);

        expect(result.success).toBe(false);
        expect(MenuRepository.createMenuItem).not.toHaveBeenCalled();

    });

});

describe("MenuService.updateMenuItem - tax rate", () => {

    const existingItem = {
        MenuItemId: 100,
        BranchId: 5,
        ItemName: "Ginger Chai",
        Price: 30,
        TaxRatePercent: 5,
        IsAvailable: true,
        IsPopular: false,
        IsActive: true
    };

    beforeEach(() => {

        MenuRepository.getMenuItemById.mockResolvedValue([existingItem]);
        MenuRepository.getMenuItemByName.mockResolvedValue(null);

    });

    it("keeps the item's existing rate when none is supplied in the update", async () => {

        MenuRepository.updateMenuItem.mockResolvedValue({ ...existingItem, TaxRatePercent: 5 });

        await MenuService.updateMenuItem(100, { categoryId: 3, itemName: "Ginger Chai", price: 30 }, TENANT_ID, ADMIN_ID);

        expect(MenuRepository.updateMenuItem).toHaveBeenCalledWith(
            expect.objectContaining({ taxRatePercent: 5 }),
            TENANT_ID
        );

    });

    it("rejects an out-of-range rate on update, same as on create", async () => {

        const result = await MenuService.updateMenuItem(
            100, { categoryId: 3, itemName: "Ginger Chai", price: 30, taxRatePercent: 200 }, TENANT_ID, ADMIN_ID
        );

        expect(result.success).toBe(false);
        expect(MenuRepository.updateMenuItem).not.toHaveBeenCalled();

    });

    it("notes the rate change in the audit summary when it actually changes", async () => {

        MenuRepository.updateMenuItem.mockResolvedValue({ ...existingItem, TaxRatePercent: 18 });

        await MenuService.updateMenuItem(
            100, { categoryId: 3, itemName: "Ginger Chai", price: 30, taxRatePercent: 18 }, TENANT_ID, ADMIN_ID
        );

        expect(AuditService.record).toHaveBeenCalledWith(
            expect.objectContaining({ summary: expect.stringContaining("tax rate changed from 5% to 18%") })
        );

    });

});
