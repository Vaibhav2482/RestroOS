import { useEffect, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import QRCode from "qrcode";
import toast from "react-hot-toast";

import { getStoredAuth } from "../utils/adminAuth";
import { buildTableOrderUrl } from "../utils/storefrontLink";

// A customer scanning this lands straight on the storefront's menu for
// this table (see storefront's StorefrontContext, which reads the "table"
// query param this URL carries) - no app, no login wall, matching
// PetPooja's Scan & Order pattern this was built to close the gap with.
function TableQrDialog({ open, table, onClose }) {

    const { admin } = getStoredAuth() || {};
    const [qrDataUrl, setQrDataUrl] = useState(null);

    const url = table ? buildTableOrderUrl(admin?.tenantSlug, table.TableName) : null;

    useEffect(() => {

        if (!open || !url) {
            setQrDataUrl(null);
            return;
        }

        let cancelled = false;

        QRCode.toDataURL(url, { width: 320, margin: 1 })
            .then((dataUrl) => {
                if (!cancelled) {
                    setQrDataUrl(dataUrl);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error("Failed to generate this table's QR code.");
                }
            });

        return () => { cancelled = true; };

    }, [open, url]);

    const handleCopyLink = async () => {

        try {

            await navigator.clipboard.writeText(url);
            toast.success("Link copied.");

        } catch {

            toast.error("Couldn't copy the link - your browser may be blocking clipboard access.");

        }

    };

    // A separate, minimal print window rather than printing this dialog in
    // place - a MUI Dialog renders through a portal with its own backdrop/
    // overlay layered over the rest of the app, which print stylesheets
    // fight to hide reliably. A blank window with just the QR and a label
    // sidesteps that entirely.
    const handlePrint = () => {

        if (!qrDataUrl) {
            return;
        }

        const printWindow = window.open("", "_blank", "width=420,height=560");

        if (!printWindow) {
            toast.error("Your browser blocked the print window - allow pop-ups for this site and try again.");
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Table ${table.TableName} - QR Code</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 40px 20px; }
                        img { width: 280px; height: 280px; }
                        h1 { font-size: 22px; margin: 24px 0 4px; }
                        p { color: #555; font-size: 13px; word-break: break-all; }
                    </style>
                </head>
                <body>
                    <img src="${qrDataUrl}" alt="Table ${table.TableName} QR code" />
                    <h1>Table ${table.TableName}</h1>
                    <p>Scan to view the menu and order</p>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        printWindow.print();

    };

    if (!table) {
        return null;
    }

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">

            <DialogTitle>
                QR Code &mdash; Table {table.TableName}
            </DialogTitle>

            <DialogContent>

                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>

                    {qrDataUrl ? (
                        <Box component="img" src={qrDataUrl} alt={`Table ${table.TableName} QR code`} sx={{ width: 220, height: 220 }} />
                    ) : (
                        <Box sx={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CircularProgress size={28} />
                        </Box>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all", textAlign: "center" }}>
                        {url}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                        Print this and place it on Table {table.TableName} - scanning it opens the
                        menu with this table already selected, no app or login required.
                    </Typography>

                </Box>

            </DialogContent>

            <DialogActions>

                <Button onClick={onClose}>Close</Button>

                <Button startIcon={<ContentCopyRoundedIcon />} onClick={handleCopyLink}>
                    Copy Link
                </Button>

                <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={handlePrint} disabled={!qrDataUrl}>
                    Print
                </Button>

            </DialogActions>

        </Dialog>

    );

}

export default TableQrDialog;
