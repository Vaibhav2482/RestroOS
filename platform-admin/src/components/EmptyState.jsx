import { Box, Typography } from "@mui/material";

// Shared "nothing here yet" treatment - an icon in a tinted circle (same
// visual language as the stat cards) plus a title and one line of
// description, with an optional action slot. Used wherever a table would
// otherwise fall back to a bare line of grey text.
function EmptyState({ icon, title, description, action }) {

    return (

        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, py: 6, px: 2, textAlign: "center" }}>

            <Box
                sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(79, 70, 229, 0.1)",
                    color: "#4F46E5",
                    mb: 0.5
                }}
            >
                {icon}
            </Box>

            <Typography fontWeight={600}>{title}</Typography>

            {description && (
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                    {description}
                </Typography>
            )}

            {action && <Box sx={{ mt: 1 }}>{action}</Box>}

        </Box>

    );

}

export default EmptyState;
