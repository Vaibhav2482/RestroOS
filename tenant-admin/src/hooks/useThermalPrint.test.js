import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../lib/qzTray");
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const qzTray = await import("../lib/qzTray");
const toast = (await import("react-hot-toast")).default;
const { useThermalPrint } = await import("./useThermalPrint");

beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
});

describe("useThermalPrint - falls back to browser print when thermal printing isn't set up or fails", () => {

    it("goes straight to window.print() without building a ticket when no printer is configured", async () => {

        qzTray.getSavedPrinter.mockReturnValue("");
        const buildTicket = vi.fn(() => "TICKET");

        const { result } = renderHook(() => useThermalPrint());

        await act(async () => {
            await result.current.print(buildTicket);
        });

        expect(window.print).toHaveBeenCalledTimes(1);
        expect(buildTicket).not.toHaveBeenCalled();
        expect(qzTray.printRaw).not.toHaveBeenCalled();

    });

    it("sends the built ticket to the configured printer and does NOT also fall back to window.print on success", async () => {

        qzTray.getSavedPrinter.mockReturnValue("Kitchen-80mm");
        qzTray.printRaw.mockResolvedValue();
        const buildTicket = vi.fn(() => "TICKET-BYTES");

        const { result } = renderHook(() => useThermalPrint());

        await act(async () => {
            await result.current.print(buildTicket);
        });

        expect(qzTray.printRaw).toHaveBeenCalledWith("Kitchen-80mm", "TICKET-BYTES");
        expect(window.print).not.toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalled();

    });

    it("falls back to window.print() and shows an error toast when the thermal print attempt fails", async () => {

        qzTray.getSavedPrinter.mockReturnValue("Kitchen-80mm");
        qzTray.printRaw.mockRejectedValue(new Error("QZ Tray is not running"));

        const { result } = renderHook(() => useThermalPrint());

        await act(async () => {
            await result.current.print(() => "TICKET");
        });

        expect(window.print).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("QZ Tray is not running"));

    });

    it("reads the printer for the requested role, not always 'kot'", async () => {

        qzTray.getSavedPrinter.mockImplementation((role) => (role === "bill" ? "Counter-58mm" : ""));
        qzTray.printRaw.mockResolvedValue();

        const { result } = renderHook(() => useThermalPrint("bill"));

        await act(async () => {
            await result.current.print(() => "BILL-TICKET");
        });

        expect(qzTray.getSavedPrinter).toHaveBeenCalledWith("bill");
        expect(qzTray.printRaw).toHaveBeenCalledWith("Counter-58mm", "BILL-TICKET");

    });

    it("defaults to the kot role when none is given", async () => {

        qzTray.getSavedPrinter.mockReturnValue("");

        const { result } = renderHook(() => useThermalPrint());

        await act(async () => {
            await result.current.print(() => "TICKET");
        });

        expect(qzTray.getSavedPrinter).toHaveBeenCalledWith("kot");

    });

    it("exposes printing:true only while an actual thermal print attempt is in flight", async () => {

        qzTray.getSavedPrinter.mockReturnValue("Kitchen-80mm");
        let resolvePrint;
        qzTray.printRaw.mockReturnValue(new Promise((resolve) => { resolvePrint = resolve; }));

        const { result } = renderHook(() => useThermalPrint());

        expect(result.current.printing).toBe(false);

        let printPromise;
        act(() => {
            printPromise = result.current.print(() => "TICKET");
        });

        expect(result.current.printing).toBe(true);

        await act(async () => {
            resolvePrint();
            await printPromise;
        });

        expect(result.current.printing).toBe(false);

    });

});
