import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";

// Shared wrapper for any printable receipt (Bill, KOT, ...) - the
// DialogContent's print-dialog-content class is what print.css keys off to
// hide everything else on the page and show just this dialog when the
// browser print fallback (window.print()) fires, so every new receipt type
// gets working print output for free just by rendering inside this instead
// of a bare Dialog.
//
// onPrint is an optional override (e.g. a thermal-printer send via QZ Tray)
// - when provided it's called instead of window.print(), and this dialog
// stays open with its own loading/disabled state so the caller can report
// success/failure without the printable content disappearing mid-print.
function PrintDialog({ open, onClose, children, printLabel = "Print", onPrint, printing = false }) {

    return (

        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>

            <DialogContent className="print-dialog-content" sx={{ pt: 3 }}>
                {children}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button
                    variant="contained"
                    startIcon={<PrintOutlinedIcon />}
                    disabled={printing}
                    onClick={() => (onPrint ? onPrint() : window.print())}
                >
                    {printing ? "Printing..." : printLabel}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default PrintDialog;
