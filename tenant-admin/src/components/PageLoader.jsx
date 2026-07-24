import { Box, CircularProgress } from "@mui/material";

function PageLoader() {

    return (

        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
            <CircularProgress size={32} />
        </Box>

    );

}

export default PageLoader;
