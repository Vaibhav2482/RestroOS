import qz from "qz-tray";

// Thin wrapper around the qz-tray client - QZ Tray is a small program the
// user installs on the till's own computer (https://qz.io), which this
// connects to over a local WebSocket to reach whatever thermal printer is
// physically attached. No signing/certificate setup is configured here
// (deliberately, for a first cut): QZ Tray still works perfectly with an
// unsigned connection, it just shows the operator a one-time "allow this
// site?" prompt per browser session instead of silently trusting it -
// acceptable for a single till in a kitchen, not something worth the extra
// complexity of standing up a signing certificate for yet.

const KOT_PRINTER_KEY = "restroos_kot_printer";

export const isConnected = () => {

    try {

        return qz.websocket.isActive();

    } catch {

        return false;

    }

};

let connecting = null;

// Concurrent callers (e.g. the settings page and a print action firing at
// the same moment) share one in-flight connection attempt rather than each
// calling qz.websocket.connect() and having the second one reject with
// "connection attempt has not returned yet".
export const connect = async () => {

    if (isConnected()) {
        return;
    }

    if (!connecting) {
        connecting = qz.websocket.connect().finally(() => { connecting = null; });
    }

    await connecting;

};

export const disconnect = async () => {

    if (isConnected()) {
        await qz.websocket.disconnect();
    }

};

export const listPrinters = async () => {

    await connect();

    const printers = await qz.printers.find();

    return Array.isArray(printers) ? printers : [printers];

};

export const getSavedPrinter = () => {

    try {

        return localStorage.getItem(KOT_PRINTER_KEY) || "";

    } catch {

        // Private browsing / storage blocked - printing still works this
        // session, the selection just won't be remembered.
        return "";

    }

};

export const saveSelectedPrinter = (printerName) => {

    try {

        localStorage.setItem(KOT_PRINTER_KEY, printerName);

    } catch {
        // See getSavedPrinter - non-fatal.
    }

};

// Sends a raw ESC/POS command string straight to the printer, bypassing the
// OS print driver entirely (type: 'raw', format defaults to 'command') -
// this is what lets the ticket control its own cut/bold/alignment instead
// of relying on however the driver chooses to rasterize an HTML page.
export const printRaw = async (printerName, escposText) => {

    if (!printerName) {
        throw new Error("No KOT printer is configured. Set one under Printers in the sidebar.");
    }

    await connect();

    const config = qz.configs.create(printerName);

    await qz.print(config, [escposText]);

};
