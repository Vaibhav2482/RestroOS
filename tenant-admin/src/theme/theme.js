import { createTheme } from "@mui/material/styles";

const theme = createTheme({

    palette: {

        mode: "light",

        primary: {
            main: "#4F46E5"
        },

        secondary: {
            main: "#0F766E"
        },

        background: {
            default: "#F5F6FA",
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
                body: { backgroundColor: "#F5F6FA" },
                // Every date-range field in the app is a plain
                // TextField type="date" (report tabs, coupon validity) -
                // the browser's own calendar-picker glyph is the one
                // element on the page that isn't theme-drawn. Recoloring
                // it to the theme's text-secondary keeps it from reading
                // as a stray, unstyled native control against everything
                // else. Chrome/Edge-only (-webkit- pseudo-element); other
                // browsers just keep their own default, unchanged.
                'input[type="date"]::-webkit-calendar-picker-indicator': {
                    filter: "invert(46%) sepia(4%) saturate(464%) hue-rotate(182deg) brightness(93%) contrast(87%)",
                    cursor: "pointer"
                },
                // Google Places Autocomplete appends its suggestion dropdown
                // (.pac-container) straight to <body>, outside any React
                // tree - its own z-index sits well below MUI's Modal/Dialog
                // (1300), so inside the Branches "Add/Edit" dialog the
                // suggestions rendered but were entirely hidden behind the
                // dialog paper. Bumped above that so the dropdown is
                // actually visible and clickable there.
                ".pac-container": { zIndex: 1400 }
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

});

export default theme;
