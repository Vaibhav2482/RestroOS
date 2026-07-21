import { Box, Typography } from "@mui/material";

// The root path has no tenant - there's no cross-restaurant directory/search
// yet, so a customer only ever lands here by mistake (every real link they
// get from a restaurant already includes its slug, e.g. /alpha-diner).
function Landing() {

    return (

        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 3, textAlign: "center" }}>

            <Typography variant="h4" fontWeight={800} sx={{ color: "#4F46E5", mb: 1 }}>
                RestroOS
            </Typography>

            <Typography color="text.secondary">
                Use the link your restaurant gave you to start ordering.
            </Typography>

        </Box>

    );

}

export default Landing;
