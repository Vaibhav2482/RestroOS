import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import toast from "react-hot-toast";

// The hash is the only copy the DB keeps - this dialog is the one and only
// place the plaintext value is ever shown, so closing without copying means
// generating a fresh one from scratch rather than being able to look it up.
function TemporaryPasswordDialog({ open, onClose, email, password }) {

    const handleCopy = async () => {

        try {
            await navigator.clipboard.writeText(password);
            toast.success("Password copied to clipboard.");
        } catch {
            toast.error("Couldn't copy automatically - select and copy the password manually.");
        }

    };

    return (

        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">

            <DialogTitle>Temporary Password</DialogTitle>

            <DialogContent>

                <Alert severity="warning" sx={{ mb: 2 }}>
                    Shown only once - copy it now and relay it to the owner. There's no way to retrieve it again after closing this dialog.
                </Alert>

                <Typography variant="body2" color="text.secondary">
                    {email}
                </Typography>

                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5, p: 1.5, border: "1px solid #E5E7EB", borderRadius: 1 }}>

                    <Typography fontFamily="monospace" fontWeight={700} sx={{ flexGrow: 1, wordBreak: "break-all" }}>
                        {password}
                    </Typography>

                    <IconButton size="small" onClick={handleCopy} aria-label="Copy password">
                        <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>

                </Stack>

            </DialogContent>

            <DialogActions>
                <Button variant="contained" onClick={onClose}>Done</Button>
            </DialogActions>

        </Dialog>

    );

}

export default TemporaryPasswordDialog;
