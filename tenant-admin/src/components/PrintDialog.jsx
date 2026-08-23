import { Box, Button, Dialog, DialogActions, DialogContent, Drawer, IconButton, Typography } from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

// Shared wrapper for any printable receipt (Bill, KOT, ...) - the
// print-dialog-content class is what print.css keys off to hide everything
// else on the page and show just this content when the browser print
// fallback (window.print()) fires, so every new receipt type gets working
// print output for free just by rendering inside this instead of a bare
// Dialog/Drawer. print.css handles both variants below.
//
// onPrint is an optional override (e.g. a thermal-printer send via QZ Tray)
// - when provided it's called instead of window.print(), and this stays
// open with its own loading/disabled state so the caller can report
// success/failure without the printable content disappearing mid-print.
//
// variant="drawer" is for a ticket a captain prints mid-workflow (KOT) -
// sliding in from the right instead of covering the center of the screen
// means the menu grid behind it stays visible and reachable, unlike a
// modal that blocks the whole workspace for what's usually a two-second
// glance-and-print action. variant="dialog" (default) is unchanged from
// before, for the Bill receipts, where blocking the screen while settling
// up is the actual expected flow.
function PrintDialog({ open, onClose, children, printLabel = "Print", onPrint, printing = false, variant = "dialog", title }) {

    const printButton = (
        <Button
            variant="contained"
            startIcon={<PrintOutlinedIcon />}
            disabled={printing}
            onClick={() => (onPrint ? onPrint() : window.print())}
        >
            {printing ? "Printing..." : printLabel}
        </Button>
    );

    if (variant === "drawer") {

        return (

            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                slotProps={{ paper: { sx: { width: { xs: "100%", sm: 420 }, display: "flex", flexDirection: "column" } } }}
            >

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700}>{title || printLabel}</Typography>
                    <IconButton size="small" onClick={onClose}>
                        <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Box className="print-dialog-content" sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 3 }}>
                    {children}
                </Box>

                <Box className="print-dialog-actions" sx={{ display: "flex", justifyContent: "flex-end", gap: 1, p: 2, borderTop: "1px solid #E5E7EB", flexShrink: 0 }}>
                    <Button onClick={onClose}>Close</Button>
                    {printButton}
                </Box>

            </Drawer>

        );

    }

    return (

        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>

            <DialogContent className="print-dialog-content" sx={{ pt: 3 }}>
                {children}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                {printButton}
            </DialogActions>

        </Dialog>

    );

}

export default PrintDialog;
