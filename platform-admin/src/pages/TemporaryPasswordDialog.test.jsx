import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import TemporaryPasswordDialog from "./TemporaryPasswordDialog";

describe("TemporaryPasswordDialog", () => {

    it("shows the email and password, and copies the password on click", async () => {

        const user = userEvent.setup();

        render(
            <TemporaryPasswordDialog
                open
                onClose={() => {}}
                email="owner@example.com"
                password="abc123XYZ"
            />
        );

        // jsdom lazily instantiates a real navigator.clipboard the first
        // time anything touches it during render, which clobbers a stub
        // set up beforehand - defining it after render, right before the
        // interaction that needs it, is what actually sticks.
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText: writeTextMock },
            configurable: true,
            writable: true
        });

        expect(screen.getByText("owner@example.com")).toBeInTheDocument();
        expect(screen.getByText("abc123XYZ")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /copy password/i }));

        expect(writeTextMock).toHaveBeenCalledWith("abc123XYZ");

    });

    it("renders nothing interactive when closed", () => {

        render(
            <TemporaryPasswordDialog
                open={false}
                onClose={() => {}}
                email="owner@example.com"
                password="abc123XYZ"
            />
        );

        expect(screen.queryByText("abc123XYZ")).not.toBeInTheDocument();

    });

});
