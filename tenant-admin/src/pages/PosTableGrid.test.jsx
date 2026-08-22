import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import PosTableGrid from "./PosTableGrid";

// This file's first job is simply to import the component. Three regressions
// reached production on the POS screens during development, and one of them
// was a syntax error that every existing test passed through - because no
// test imported these files at all. An import alone catches that class.

const TABLES = [
    { TableId: 1, TableName: "A1", Capacity: 4 },
    { TableId: 2, TableName: "A2", Capacity: null },
    { TableId: 3, TableName: "T10", Capacity: 10 }
];

const renderGrid = (overrides = {}) => {

    const props = {
        tables: TABLES,
        activeOrdersByTable: new Map(),
        onTableClick: vi.fn(),
        onQuickAdvance: vi.fn(),
        onAddOrder: vi.fn(),
        onSettleBill: vi.fn(),
        pendingAdvanceOrderIds: new Set(),
        ...overrides
    };

    return { props, ...render(<PosTableGrid {...props} />) };

};

describe("PosTableGrid", () => {

    it("renders every table and marks the empty ones available", () => {

        renderGrid();

        expect(screen.getByText("A1")).toBeInTheDocument();
        expect(screen.getByText("A2")).toBeInTheDocument();
        expect(screen.getByText("T10")).toBeInTheDocument();
        expect(screen.getAllByText("Available")).toHaveLength(3);

    });

    it("shows seat count only where the table has a capacity", () => {

        const { container } = renderGrid();

        expect(screen.getByText("Seats 4")).toBeInTheDocument();
        expect(screen.getByText("Seats 10")).toBeInTheDocument();

        // Asserted against the whole rendered text rather than queryByText,
        // which only inspects individual text nodes and is easy to write in a
        // form that silently never matches. NOT YET MUTATION-TESTED: an
        // attempt to break the capacity guard and watch this fail did not
        // apply cleanly, so treat this assertion as unproven until someone
        // confirms it fails when the guard is removed.
        expect(container.textContent).not.toMatch(/Seats\s*(null|undefined|NaN)/);

    });

    it("selects a table by name, not by position", () => {

        const { props } = renderGrid();

        // Clicking the tile carrying "T10" must pass T10 - a grid reorder or
        // a breakpoint change must never silently seat someone at A1.
        return userEvent.click(screen.getByText("T10")).then(() => {
            expect(props.onTableClick).toHaveBeenCalledTimes(1);
            expect(props.onTableClick.mock.calls[0][0]).toMatchObject({ TableName: "T10" });
        });

    });

    it("summarises a running table with its order total instead of Available", () => {

        renderGrid({
            activeOrdersByTable: new Map([
                ["A1", [{ OrderId: 281, OrderStatus: "Preparing", TotalAmount: 487.2 }]]
            ])
        });

        expect(screen.getByText(/487/)).toBeInTheDocument();
        // A1 is occupied, so only the other two tables read as available.
        expect(screen.getAllByText("Available")).toHaveLength(2);

    });

    it("does not offer a quick-advance shortcut when a table holds more than one order", () => {

        renderGrid({
            activeOrdersByTable: new Map([
                ["A1", [
                    { OrderId: 281, OrderStatus: "Preparing", TotalAmount: 100 },
                    { OrderId: 282, OrderStatus: "Accepted", TotalAmount: 200 }
                ]]
            ])
        });

        // Advancing would be ambiguous - which of the two orders? The card
        // must route through the chooser instead of guessing.
        expect(screen.queryByRole("button", { name: /^ready$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^preparing$/i })).not.toBeInTheDocument();
        expect(screen.getByText(/300/)).toBeInTheDocument();

    });

    it("offers Settle Bill only on an occupied table, and reaches it independent of Start Another Order", () => {

        const { props } = renderGrid({
            activeOrdersByTable: new Map([
                ["A1", [{ OrderId: 281, OrderStatus: "Preparing", TotalAmount: 100 }]]
            ])
        });

        return userEvent.click(screen.getByRole("button", { name: /settle bill for this table/i })).then(() => {
            expect(props.onSettleBill).toHaveBeenCalledTimes(1);
            expect(props.onSettleBill.mock.calls[0][0]).toMatchObject({ TableName: "A1" });
            expect(props.onAddOrder).not.toHaveBeenCalled();
        });

    });

    it("does not offer Settle Bill on an available table", () => {

        renderGrid();

        expect(screen.queryByRole("button", { name: /settle bill for this table/i })).not.toBeInTheDocument();

    });

    it("renders an empty state rather than a bare grid when there are no tables", () => {

        renderGrid({ tables: [] });

        expect(screen.getByText("No tables yet")).toBeInTheDocument();

    });

});
