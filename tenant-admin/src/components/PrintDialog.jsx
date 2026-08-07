import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";

// Shared wrapper for any printable receipt (Bill, KOT, ...) - the
// DialogContent's print-dialog-content class is what print.css keys off to
// hide everything else on the page and show just this dialog when "Print"
// (window.print()) fires, so every new receipt type gets working print
// output for free just by rendering inside this instead of a bare Dialog.
function PrintDialog({ open, onClose, children, printLabel = "Print" }) {

    return (

        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>

            <DialogContent className="print-dialog-content" sx={{ pt: 3 }}>
                {children}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
                    {printLabel}
                </Button>
            </DialogActions>

        </Dialog>

    );

}

export default PrintDialog;
