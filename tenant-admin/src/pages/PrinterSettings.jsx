import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
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

function buildTestTicket() {
    return init() + alignCenter() + bold(true) + doubleSize(true) + "RestroOS\n" + doubleSize(false) + bold(false)
        + "Test print successful\n" + new Date().toLocaleString("en-IN") + "\n" + cutPaper();
}

// Per-till settings, deliberately not stored in the tenant's own database -
// which physical printer is attached is a fact about this one computer's
// hardware, not about the tenant. Kept in localStorage instead (same
// reasoning as the sidebar's collapse preference), so a second till at the
// same branch keeps its own separate printer selection.
function PrinterSettings() {

    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [printers, setPrinters] = useState([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [selectedPrinter, setSelectedPrinter] = useState(() => qzTray.getSavedPrinter());
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        setConnected(qzTray.isConnected());
    }, []);

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

    const handleSelectPrinter = (event) => {

        const printerName = event.target.value;

        setSelectedPrinter(printerName);
        qzTray.saveSelectedPrinter(printerName);

    };

    const handleTestPrint = async () => {

        if (!selectedPrinter) {
            toast.error("Choose a printer first.");
            return;
        }

        setTesting(true);

        try {

            await qzTray.printRaw(selectedPrinter, buildTestTicket());
            toast.success(`Test ticket sent to ${selectedPrinter}.`);

        } catch (error) {

            toast.error(`Test print failed (${error.message})`);

        } finally {

            setTesting(false);

        }

    };

    return (

        <Box>

            <Typography variant="h4" sx={{ mb: 1 }}>Printers</Typography>

            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
                Connects this computer's till to a physical thermal receipt printer, so Print KOT and
                Print Bill send straight to it instead of opening a browser print dialog. This is a
                setting for this computer only - each till at a branch picks its own printer.
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

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>

                            <FormControl fullWidth size="small">

                                <InputLabel id="kot-printer-label">KOT Printer</InputLabel>

                                <Select
                                    labelId="kot-printer-label"
                                    label="KOT Printer"
                                    value={selectedPrinter}
                                    onChange={handleSelectPrinter}
                                    displayEmpty
                                >

                                    <MenuItem value="">
                                        <em>Not set - falls back to browser print</em>
                                    </MenuItem>

                                    {printers.map((printer) => (
                                        <MenuItem key={printer} value={printer}>{printer}</MenuItem>
                                    ))}

                                </Select>

                            </FormControl>

                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={loadingPrinters ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
                                disabled={loadingPrinters}
                                onClick={handleRefreshPrinters}
                                sx={{ flexShrink: 0, height: 40 }}
                            >
                                Refresh
                            </Button>

                        </Box>

                        {printers.length === 0 && !loadingPrinters && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                No printers found. Make sure the thermal printer is powered on and connected to this computer, then Refresh.
                            </Alert>
                        )}

                        <Button
                            variant="contained"
                            startIcon={<PrintOutlinedIcon />}
                            disabled={!selectedPrinter || testing}
                            onClick={handleTestPrint}
                        >
                            {testing ? "Printing..." : "Test Print"}
                        </Button>

                    </>

                )}

            </Card>

        </Box>

    );

}

export default PrinterSettings;
