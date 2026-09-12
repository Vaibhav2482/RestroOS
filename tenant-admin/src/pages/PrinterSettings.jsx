import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Typography
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import toast from "react-hot-toast";

import * as qzTray from "../lib/qzTray";
import { init, alignCenter, bold, doubleSize, cutPaper } from "../utils/escpos";

function buildTestTicket(label) {
    return init() + alignCenter() + bold(true) + doubleSize(true) + "RestroOS\n" + doubleSize(false) + bold(false)
        + `${label} test print successful\n` + new Date().toLocaleString("en-IN") + "\n" + cutPaper();
}

// Per-role sub-section, not one shared control - a KOT ticket and a Bill
// receipt print to two different physical printers at most restaurants
// (the kitchen pass vs. the billing counter), so each needs its own
// independent selection rather than one setting silently used for both.
function PrinterRoleSection({ role, label, printers, selectedPrinter, onSelect, testing, onTest }) {

    // A saved printer from a previous session isn't necessarily in this
    // session's own `printers` list yet - that only ever gets populated by
    // an explicit Refresh, which nothing prompts automatically on load. Left
    // out of the options list, MUI's Select can't find a match for `value`
    // and silently renders blank - showing "no printer selected" for a
    // till that actually has one configured, until Refresh happens to be
    // clicked. Folding it in here is what keeps the selection visible
    // immediately, before any refresh at all.
    const options = selectedPrinter && !printers.includes(selectedPrinter)
        ? [selectedPrinter, ...printers]
        : printers;

    return (

        <Box>

            <Typography fontWeight={700} sx={{ mb: 1.5 }}>{label}</Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>

                <FormControl fullWidth size="small">

                    <InputLabel id={`${role}-printer-label`}>{label}</InputLabel>

                    <Select
                        labelId={`${role}-printer-label`}
                        label={label}
                        value={selectedPrinter}
                        onChange={onSelect}
                        displayEmpty
                    >

                        <MenuItem value="">
                            <em>Not set - falls back to browser print</em>
                        </MenuItem>

                        {options.map((printer) => (
                            <MenuItem key={printer} value={printer}>{printer}</MenuItem>
                        ))}

                    </Select>

                </FormControl>

                <Button
                    variant="contained"
                    size="small"
                    startIcon={<PrintOutlinedIcon />}
                    disabled={!selectedPrinter || testing}
                    onClick={onTest}
                    sx={{ flexShrink: 0, height: 40 }}
                >
                    {testing ? "Printing..." : "Test"}
                </Button>

            </Box>

        </Box>

    );

}

// Per-till settings, deliberately not stored in the tenant's own database -
// which physical printer is attached is a fact about this one computer's
// hardware, not about the tenant. Kept in localStorage instead (same
// reasoning as the sidebar's collapse preference), so a second till at the
// same branch keeps its own separate printer selections.
function PrinterSettings() {

    const [connected, setConnected] = useState(() => qzTray.isConnected());
    const [connecting, setConnecting] = useState(false);
    const [printers, setPrinters] = useState([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [kotPrinter, setKotPrinter] = useState(() => qzTray.getSavedPrinter("kot"));
    const [billPrinter, setBillPrinter] = useState(() => qzTray.getSavedPrinter("bill"));
    const [testingRole, setTestingRole] = useState(null);

    const handleConnect = async () => {

        setConnecting(true);

        try {

            await qzTray.connect();
            setConnected(true);
            toast.success("Connected to QZ Tray.");
            await handleRefreshPrinters();

        } catch (error) {

            toast.error(`Could not connect to QZ Tray - is it installed and running on this computer? (${error.message})`);

        } finally {

            setConnecting(false);

        }

    };

    const handleRefreshPrinters = async () => {

        setLoadingPrinters(true);

        try {

            const found = await qzTray.listPrinters();
            setPrinters(found);
            setConnected(true);

        } catch (error) {

            toast.error(`Could not list printers (${error.message})`);

        } finally {

            setLoadingPrinters(false);

        }

    };

    const handleSelectPrinter = (role, setter) => (event) => {

        const printerName = event.target.value;

        setter(printerName);
        qzTray.saveSelectedPrinter(printerName, role);

    };

    const handleTestPrint = async (role, printerName, label) => {

        if (!printerName) {
            toast.error("Choose a printer first.");
            return;
        }

        setTestingRole(role);

        try {

            await qzTray.printRaw(printerName, buildTestTicket(label));
            toast.success(`Test ticket sent to ${printerName}.`);

        } catch (error) {

            toast.error(`Test print failed (${error.message})`);

        } finally {

            setTestingRole(null);

        }

    };

    return (

        <Box>

            <Typography variant="h4" sx={{ mb: 1 }}>Printers</Typography>

            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
                Connects this computer's till to physical thermal receipt printers, so Print KOT and
                Print Bill send straight to them instead of opening a browser print dialog. KOT and
                Bill can point at two different printers - the common setup of a kitchen ticket
                printer separate from a counter printer. This is a setting for this computer only -
                each till at a branch picks its own printers.
            </Typography>

            <Card variant="outlined" sx={{ p: 3, maxWidth: 560 }}>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>

                    <Box>
                        <Typography fontWeight={700}>QZ Tray Connection</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Requires QZ Tray installed and running on this computer (
                            <Box component="a" href="https://qz.io/download/" target="_blank" rel="noreferrer" sx={{ color: "primary.main" }}>
                                download
                            </Box>
                            ).
                        </Typography>
                    </Box>

                    <Chip
                        label={connected ? "Connected" : "Not Connected"}
                        color={connected ? "success" : "default"}
                        size="small"
                    />

                </Box>

                {!connected && (

                    <Button
                        variant="contained"
                        disabled={connecting}
                        onClick={handleConnect}
                        sx={{ mb: 3 }}
                    >
                        {connecting ? "Connecting..." : "Connect to QZ Tray"}
                    </Button>

                )}

                {connected && (

                    <>

                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={loadingPrinters ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
                            disabled={loadingPrinters}
                            onClick={handleRefreshPrinters}
                            sx={{ mb: 2 }}
                        >
                            Refresh Printer List
                        </Button>

                        {printers.length === 0 && !loadingPrinters && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                No printers found. Make sure the thermal printer is powered on and connected to this computer, then Refresh.
                            </Alert>
                        )}

                        <PrinterRoleSection
                            role="kot"
                            label="KOT Printer"
                            printers={printers}
                            selectedPrinter={kotPrinter}
                            onSelect={handleSelectPrinter("kot", setKotPrinter)}
                            testing={testingRole === "kot"}
                            onTest={() => handleTestPrint("kot", kotPrinter, "KOT")}
                        />

                        <Divider sx={{ my: 2.5 }} />

                        <PrinterRoleSection
                            role="bill"
                            label="Bill Printer"
                            printers={printers}
                            selectedPrinter={billPrinter}
                            onSelect={handleSelectPrinter("bill", setBillPrinter)}
                            testing={testingRole === "bill"}
                            onTest={() => handleTestPrint("bill", billPrinter, "Bill")}
                        />

                    </>

                )}

            </Card>

        </Box>

    );

}

export default PrinterSettings;
