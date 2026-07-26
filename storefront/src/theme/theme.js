import { createTheme } from "@mui/material/styles";

// A warm terracotta rather than a generic SaaS indigo - this is only the
// fallback for a tenant who hasn't picked their own color yet (Settings >
// Branding); buildTenantTheme below always overrides it once they do.
const DEFAULT_PRIMARY_COLOR = "#D33C33";

const baseThemeOptions = {

    palette: {

        mode: "light",

        primary: {
            main: DEFAULT_PRIMARY_COLOR
        },

        secondary: {
            main: "#0F766E"
        },

        background: {
            default: "#FCFAF6",
            paper: "#FFFFFF"
        },

        text: {
            primary: "#1F2937",
            secondary: "#6B7280"
        },

        success: {
            main: "#22C55E"
        },

        warning: {
            main: "#F59E0B"
        },

        error: {
            main: "#EF4444"
        },

        divider: "#E5E7EB"
    },

    spacing: 8,

    shape: {
        borderRadius: 14
    },

    typography: {

        fontFamily: [
            "Plus Jakarta Sans",
            "Inter",
            "sans-serif"
        ].join(","),

        h4: {
            fontWeight: 700,
            fontSize: "1.875rem",
            "@media (max-width:600px)": { fontSize: "1.25rem" }
        },

        h5: {
            fontWeight: 700,
            fontSize: "1.5rem"
        },

        h6: {
            fontWeight: 600,
            fontSize: "1.25rem"
        },

        button: {
            textTransform: "none",
            fontWeight: 600
        }

    },

    components: {

        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: "#FCFAF6" }
            }
        },

        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 14,
                    backgroundImage: "none",
                    boxShadow: "0 8px 30px rgba(0,0,0,.05)"
                }
            }
        },

        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 18,
                    boxShadow: "0 8px 30px rgba(0,0,0,.05)"
                }
            }
        },

        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { borderRadius: 10, padding: "10px 22px" }
            }
        },

        MuiOutlinedInput: {
            styleOverrides: {
                root: { borderRadius: 10 }
            }
        }

    }

};

const theme = createTheme(baseThemeOptions);

// Each tenant can pick their own theme color (Settings > Branding in
// tenant-admin) - everything else about the look stays the same, just the
// primary color swaps out.
export const buildTenantTheme = (primaryColor) => createTheme({
    ...baseThemeOptions,
    palette: {
        ...baseThemeOptions.palette,
        primary: { main: primaryColor || DEFAULT_PRIMARY_COLOR }
    }
});

export default theme;
