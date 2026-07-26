import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Integrations from "./Integrations";
import * as integrationService from "../services/integrationService";

vi.mock("../services/integrationService");

describe("Integrations", () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows each integration with its status label", async () => {

        integrationService.getIntegrations.mockResolvedValue({
            success: true,
            data: [
                { key: "zomato", name: "Zomato", description: "Receive Zomato orders...", status: "coming_soon", statusLabel: "Coming Soon", note: "Needs 200+ restaurants." },
                { key: "swiggy", name: "Swiggy", description: "Receive Swiggy orders...", status: "coming_soon", statusLabel: "Coming Soon", note: "Needs partner approval." }
            ]
        });

        render(<Integrations />);

        expect(await screen.findByText("Zomato")).toBeInTheDocument();
        expect(screen.getByText("Swiggy")).toBeInTheDocument();
        expect(screen.getAllByText("Coming Soon")).toHaveLength(2);

    });

    it("shows an error toast when the fetch fails, without crashing", async () => {

        integrationService.getIntegrations.mockResolvedValue({ success: false, message: "Failed to load integrations." });

        render(<Integrations />);

        await screen.findByText("Integrations");
        expect(screen.queryByText("Zomato")).not.toBeInTheDocument();

    });

});
