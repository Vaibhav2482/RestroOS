import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import PrinterSettings from "./PrinterSettings";
import * as qzTray from "../lib/qzTray";

vi.mock("../lib/qzTray");
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {

    vi.clearAllMocks();

    qzTray.isConnected.mockReturnValue(true);
    qzTray.getSavedPrinter.mockImplementation((role) => (role === "bill" ? "Counter-58mm" : "Kitchen-80mm"));
    qzTray.listPrinters.mockResolvedValue(["Kitchen-80mm", "Counter-58mm"]);
    qzTray.printRaw.mockResolvedValue();

});

// Regression coverage: before this, KOT and Bill shared one printer setting
// entirely - a till with a separate kitchen printer and counter printer
// could only ever configure one of them correctly.
describe("PrinterSettings - independent KOT and Bill printers", () => {

    // Regression test: found while writing this suite, not by inspection -
    // before this, a saved printer not yet in the (empty until Refresh)
    // discovered-printers list fell out of MUI's Select value matching and
    // rendered blank, making an already-configured till look unconfigured.
    it("shows the saved printer immediately, before Refresh has ever been clicked", () => {

        render(<PrinterSettings />);

        expect(screen.getByLabelText("KOT Printer")).toHaveTextContent("Kitchen-80mm");
        expect(screen.getByLabelText("Bill Printer")).toHaveTextContent("Counter-58mm");
        expect(qzTray.listPrinters).not.toHaveBeenCalled();

    });

    it("loads each role's own saved printer into its own selector", () => {

        render(<PrinterSettings />);

        expect(qzTray.getSavedPrinter).toHaveBeenCalledWith("kot");
        expect(qzTray.getSavedPrinter).toHaveBeenCalledWith("bill");

        expect(screen.getByLabelText("KOT Printer")).toHaveTextContent("Kitchen-80mm");
        expect(screen.getByLabelText("Bill Printer")).toHaveTextContent("Counter-58mm");

    });

    it("changing the KOT printer does not touch the Bill printer's saved value", async () => {

        const user = userEvent.setup();
        render(<PrinterSettings />);

        await user.click(screen.getByRole("button", { name: /refresh printer list/i }));
        await user.click(screen.getByLabelText("KOT Printer"));
        await user.click(await screen.findByRole("option", { name: "Counter-58mm" }));

        expect(qzTray.saveSelectedPrinter).toHaveBeenCalledWith("Counter-58mm", "kot");
        expect(qzTray.saveSelectedPrinter).not.toHaveBeenCalledWith(expect.anything(), "bill");

    });

    it("test-printing the Bill printer sends to the Bill printer, not the KOT one", async () => {

        const user = userEvent.setup();
        render(<PrinterSettings />);

        await user.click(screen.getAllByRole("button", { name: /test/i })[1]);

        expect(qzTray.printRaw).toHaveBeenCalledWith("Counter-58mm", expect.stringContaining("Bill test print successful"));

    });

    it("test-printing the KOT printer sends to the KOT printer", async () => {

        const user = userEvent.setup();
        render(<PrinterSettings />);

        await user.click(screen.getAllByRole("button", { name: /test/i })[0]);

        expect(qzTray.printRaw).toHaveBeenCalledWith("Kitchen-80mm", expect.stringContaining("KOT test print successful"));

    });

});
