import { useState } from "react";
import toast from "react-hot-toast";

import * as qzTray from "../lib/qzTray";

// Shared by every KOT/Bill PrintDialog. If a KOT printer is configured
// (Printers page in the sidebar), sends the ticket straight to it via QZ
// Tray; otherwise - or if that attempt fails for any reason (QZ Tray not
// running, printer offline, ...) - falls back to the browser print path
// PrintDialog already had, so a till that's never set up thermal printing
// keeps working exactly as it always did.
export function useThermalPrint() {

    const [printing, setPrinting] = useState(false);

    // buildTicket is a thunk, not a value - it's only called (only builds
    // the ESC/POS string) when there's actually a configured printer to
    // send it to, not on every render.
    const print = async (buildTicket) => {

        const printerName = qzTray.getSavedPrinter();

        if (!printerName) {
            window.print();
            return;
        }

        setPrinting(true);

        try {

            await qzTray.printRaw(printerName, buildTicket());
            toast.success(`Sent to ${printerName}.`);

        } catch (error) {

            toast.error(`Could not reach ${printerName} (${error.message}) - printed via browser instead.`);
            window.print();

        } finally {

            setPrinting(false);

        }

    };

    return { printing, print };

}
