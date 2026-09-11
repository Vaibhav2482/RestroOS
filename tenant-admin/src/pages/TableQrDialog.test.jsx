import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import QRCode from "qrcode";

import TableQrDialog from "./TableQrDialog";

vi.mock("qrcode");
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const TABLE = { TableId: 1, TableName: "A3" };

const ADMIN_AUTH = { token: "t", admin: { AdminId: 1, BranchId: 5, tenantSlug: "alpha-diner-final" } };

beforeEach(() => {

    vi.clearAllMocks();
    localStorage.setItem("tenantAdmin", JSON.stringify(ADMIN_AUTH));

    QRCode.toDataURL.mockResolvedValue("data:image/png;base64,fakeqrdata");

    if (!navigator.clipboard) {

        Object.defineProperty(navigator, "clipboard", {
            value: { writeText: vi.fn() },
            configurable: true
        });

    }

});

describe("TableQrDialog", () => {

    it("renders nothing when no table is given", () => {

        const { container } = render(<TableQrDialog open={false} table={null} onClose={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();

    });

    it("generates a QR code for this table's storefront link and displays the URL", async () => {

        render(<TableQrDialog open table={TABLE} onClose={vi.fn()} />);

        await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalledWith(
            "http://localhost:5177/alpha-diner-final?table=A3",
            expect.objectContaining({ width: 320 })
        ));

        expect(await screen.findByAltText("Table A3 QR code")).toHaveAttribute("src", "data:image/png;base64,fakeqrdata");
        expect(screen.getByText("http://localhost:5177/alpha-diner-final?table=A3")).toBeInTheDocument();

    });

    it("copies the link to the clipboard", async () => {

        // Spied AFTER userEvent.setup() deliberately - userEvent v14 installs
        // its own clipboard support on setup, which clobbers a spy attached
        // any earlier (including one in beforeEach).
        const user = userEvent.setup();
        const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

        render(<TableQrDialog open table={TABLE} onClose={vi.fn()} />);

        await screen.findByAltText("Table A3 QR code");
        await user.click(screen.getByRole("button", { name: /copy link/i }));

        expect(writeTextSpy).toHaveBeenCalledWith("http://localhost:5177/alpha-diner-final?table=A3");

    });

    it("opens a print window with the QR image once generated", async () => {

        const fakePrintWindow = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
        const openSpy = vi.spyOn(window, "open").mockReturnValue(fakePrintWindow);

        const user = userEvent.setup();
        render(<TableQrDialog open table={TABLE} onClose={vi.fn()} />);

        await screen.findByAltText("Table A3 QR code");
        await user.click(screen.getByRole("button", { name: /print/i }));

        expect(openSpy).toHaveBeenCalled();
        expect(fakePrintWindow.document.write).toHaveBeenCalledWith(expect.stringContaining("fakeqrdata"));
        expect(fakePrintWindow.print).toHaveBeenCalled();

    });

    it("disables Print until the QR code has actually generated", () => {

        QRCode.toDataURL.mockReturnValue(new Promise(() => {})); // never resolves

        render(<TableQrDialog open table={TABLE} onClose={vi.fn()} />);

        expect(screen.getByRole("button", { name: /print/i })).toBeDisabled();

    });

});
