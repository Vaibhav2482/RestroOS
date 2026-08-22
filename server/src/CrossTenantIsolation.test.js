import { describe, it, expect, vi, beforeEach } from "vitest";

// One dedicated regression test per tenant-scoped resource type, asserting
// the property this entire product depends on: Tenant A's admin can never
// read or write Tenant B's data by guessing/supplying a resource ID that
// happens to belong to another tenant. A production-readiness audit found
// this property held everywhere it checked by hand, but noted it was
// entirely unverified by any automated test - these tests close that gap.
//
// Each block mocks only the repository/service call that resolves the
// existing resource (never the tenant-check logic itself), calls the real
// controller/service function with an attacker's tenantId against a
// victim-tenant resource, and asserts both (a) the caller is rejected and
// (b) the underlying mutation was never reached. Field/function names below
// are taken directly from the real repositories/services under test.

const ATTACKER_TENANT_ID = 1;
const VICTIM_TENANT_ID = 2;

const buildRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

describe("Cross-tenant isolation - Orders", () => {

    let OrderController;
    let OrderService;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./services/OrderService.js");
        vi.doMock("./repositories/CustomerRepository.js");
        vi.doMock("./repositories/BranchRepository.js");

        OrderController = await import("./controllers/OrderController.js");
        OrderService = await import("./services/OrderService.js");

    });

    it("returns 404 (not 403 - never confirms the order even exists) when the order belongs to another tenant", async () => {

        OrderService.getOrderById.mockResolvedValue({
            success: true,
            data: { OrderId: 500, TenantId: VICTIM_TENANT_ID, BranchId: 99, CustomerId: 42 }
        });

        const req = { params: { id: 500 }, user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7 } };
        const res = buildRes();

        OrderController.getOrderById(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));

    });

    it("blocks a status update on another tenant's order before the mutation is ever attempted", async () => {

        OrderService.getOrderById.mockResolvedValue({
            success: true,
            data: { OrderId: 500, TenantId: VICTIM_TENANT_ID, BranchId: 99, CustomerId: 42 }
        });

        const req = {
            params: { id: 500 },
            body: { status: "Preparing" },
            user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7 }
        };
        const res = buildRes();

        OrderController.updateOrderStatus(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));
        expect(OrderService.updateOrderStatus).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Table visits", () => {

    let TableVisitController;
    let TableVisitService;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./services/TableVisitService.js");

        TableVisitController = await import("./controllers/TableVisitController.js");
        TableVisitService = await import("./services/TableVisitService.js");

    });

    it("returns 404 when the visit's branch belongs to another tenant", async () => {

        TableVisitService.getVisitDetails.mockResolvedValue({
            success: true,
            data: { VisitId: 5, TenantId: VICTIM_TENANT_ID, BranchId: 99, TableNumber: "A3" }
        });

        const req = { params: { visitId: 5 }, user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7 } };
        const res = buildRes();

        TableVisitController.getVisitDetails(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));

    });

    it("blocks settling another tenant's table visit before the mutation is ever attempted", async () => {

        TableVisitService.getVisitDetails.mockResolvedValue({
            success: true,
            data: { VisitId: 5, TenantId: VICTIM_TENANT_ID, BranchId: 99, TableNumber: "A3" }
        });

        const req = {
            params: { visitId: 5 },
            body: { paymentMethod: "Cash" },
            user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7 }
        };
        const res = buildRes();

        TableVisitController.settleVisit(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));
        expect(TableVisitService.settleVisit).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Menu items", () => {

    let MenuController;
    let MenuService;
    let BranchRepository;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./services/MenuService.js");
        vi.doMock("./repositories/BranchRepository.js");

        MenuController = await import("./controllers/MenuController.js");
        MenuService = await import("./services/MenuService.js");
        BranchRepository = await import("./repositories/BranchRepository.js");

    });

    it("blocks updating a menu item whose branch belongs to another tenant", async () => {

        MenuService.getMenuItemById.mockResolvedValue({
            success: true,
            data: { MenuItemId: 10, BranchId: 99, ItemName: "Victim's Special" }
        });
        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 99, TenantId: VICTIM_TENANT_ID });

        const req = {
            params: { id: 10 },
            body: { itemName: "Hijacked" },
            user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7, branchId: null }
        };
        const res = buildRes();

        MenuController.updateMenuItem(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(MenuService.updateMenuItem).not.toHaveBeenCalled();

    });

    it("blocks deleting a menu item whose branch belongs to another tenant", async () => {

        MenuService.getMenuItemById.mockResolvedValue({
            success: true,
            data: { MenuItemId: 10, BranchId: 99, ItemName: "Victim's Special" }
        });
        BranchRepository.getBranchById.mockResolvedValue({ BranchId: 99, TenantId: VICTIM_TENANT_ID });

        const req = { params: { id: 10 }, user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7, branchId: null } };
        const res = buildRes();

        MenuController.deleteMenuItem(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(MenuService.deleteMenuItem).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Admins", () => {

    let AdminController;
    let AdminService;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./services/AdminService.js");

        AdminController = await import("./controllers/AdminController.js");
        AdminService = await import("./services/AdminService.js");

    });

    it("returns 404 (not the staff record) when fetching an admin from another tenant", async () => {

        AdminService.getAdminById.mockResolvedValue({
            success: true,
            data: { AdminId: 60, TenantId: VICTIM_TENANT_ID, BranchId: null, FullName: "Victim Owner" }
        });

        const req = { params: { id: 60 }, user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7, branchId: null } };
        const res = buildRes();

        AdminController.getAdminById(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));

    });

    it("blocks updating an admin from another tenant before the mutation is ever attempted", async () => {

        AdminService.getAdminById.mockResolvedValue({
            success: true,
            data: { AdminId: 60, TenantId: VICTIM_TENANT_ID, BranchId: null, FullName: "Victim Owner" }
        });

        const req = {
            params: { id: 60 },
            body: { fullName: "Hijacked" },
            user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7, branchId: null }
        };
        const res = buildRes();

        AdminController.updateAdmin(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(404));
        expect(AdminService.updateAdmin).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Customer addresses", () => {

    let CustomerAddressController;
    let CustomerAddressService;
    let CustomerRepository;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./services/CustomerAddressService.js");
        vi.doMock("./repositories/CustomerRepository.js");

        CustomerAddressController = await import("./controllers/CustomerAddressController.js");
        CustomerAddressService = await import("./services/CustomerAddressService.js");
        CustomerRepository = await import("./repositories/CustomerRepository.js");

    });

    it("blocks updating an address belonging to a customer of another tenant", async () => {

        CustomerAddressService.getCustomerAddressById.mockResolvedValue({ AddressId: 70, CustomerId: 80 });
        CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: 80, TenantId: VICTIM_TENANT_ID });

        const req = {
            params: { id: 70 },
            body: { addressLine1: "Hijacked" },
            user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7 }
        };
        const res = buildRes();

        CustomerAddressController.updateCustomerAddress(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CustomerAddressService.updateCustomerAddress).not.toHaveBeenCalled();

    });

    it("blocks placing an order-adjacent action for a customer of another tenant via createCustomerAddress", async () => {

        CustomerRepository.getCustomerById.mockResolvedValue({ CustomerId: 80, TenantId: VICTIM_TENANT_ID });

        const req = { body: { customerId: 80, addressLine1: "Hijacked" }, user: { role: "admin", tenantId: ATTACKER_TENANT_ID, id: 7 } };
        const res = buildRes();

        CustomerAddressController.createCustomerAddress(req, res, vi.fn());

        await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));
        expect(CustomerAddressService.createCustomerAddress).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Categories (service layer)", () => {

    let CategoryService;
    let CategoryRepository;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./repositories/CategoryRepository.js");

        CategoryService = await import("./services/CategoryService.js");
        CategoryRepository = await import("./repositories/CategoryRepository.js");

    });

    it("refuses to update a category owned by another tenant", async () => {

        CategoryRepository.getCategoryById.mockResolvedValue({ CategoryId: 20, TenantId: VICTIM_TENANT_ID });

        const result = await CategoryService.updateCategory(20, { categoryName: "Hijacked", displayOrder: 1 }, ATTACKER_TENANT_ID);

        expect(result.success).toBe(false);
        expect(CategoryRepository.updateCategory).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Coupons (service layer)", () => {

    let CouponService;
    let CouponRepository;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./repositories/CouponRepository.js");

        CouponService = await import("./services/CouponService.js");
        CouponRepository = await import("./repositories/CouponRepository.js");

    });

    it("refuses to update a coupon owned by another tenant", async () => {

        CouponRepository.getById.mockResolvedValue({ CouponId: 30, TenantId: VICTIM_TENANT_ID });

        const result = await CouponService.updateCoupon(
            30,
            { discountType: "Flat", discountValue: 50 },
            ATTACKER_TENANT_ID,
            7
        );

        expect(result.success).toBe(false);
        expect(CouponRepository.update).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Ingredients (service layer)", () => {

    let IngredientService;
    let IngredientRepository;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./repositories/IngredientRepository.js");

        IngredientService = await import("./services/IngredientService.js");
        IngredientRepository = await import("./repositories/IngredientRepository.js");

    });

    it("refuses to update an ingredient owned by another tenant", async () => {

        IngredientRepository.getIngredientById.mockResolvedValue({ IngredientId: 40, TenantId: VICTIM_TENANT_ID, BaseUnit: "g" });

        const result = await IngredientService.updateIngredient(40, { name: "Hijacked", baseUnit: "g" }, ATTACKER_TENANT_ID);

        expect(result.success).toBe(false);
        expect(IngredientRepository.updateIngredient).not.toHaveBeenCalled();

    });

});

describe("Cross-tenant isolation - Tables (service layer)", () => {

    let TableService;
    let TableRepository;

    beforeEach(async () => {

        vi.resetModules();
        vi.doMock("./repositories/TableRepository.js");

        TableService = await import("./services/TableService.js");
        TableRepository = await import("./repositories/TableRepository.js");

    });

    it("refuses to fetch a table owned by another tenant", async () => {

        TableRepository.getTableById.mockResolvedValue({ TableId: 50, BranchId: 99, TenantId: VICTIM_TENANT_ID });

        const result = await TableService.getTableById(50, ATTACKER_TENANT_ID);

        expect(result.success).toBe(false);

    });

    it("refuses to update a table owned by another tenant", async () => {

        TableRepository.getTableById.mockResolvedValue({ TableId: 50, BranchId: 99, TenantId: VICTIM_TENANT_ID });

        const result = await TableService.updateTable(50, { tableName: "Hijacked" }, ATTACKER_TENANT_ID);

        expect(result.success).toBe(false);
        expect(TableRepository.updateTable).not.toHaveBeenCalled();

    });

});
