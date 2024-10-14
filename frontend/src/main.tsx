import React from "react"
import ReactDOM from "react-dom/client"
import { ThemeProvider, createTheme } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import App from "./App"
import "@fontsource/roboto-mono"

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#000000",
    },
    success: {
      main: "#f0f0f0",
    },
  },
  typography: {
    fontFamily: '"Roboto Mono", monospace',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `,
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: "2px solid #000",
          boxShadow: "none",
          transition: "box-shadow 0.3s ease",
          "&:hover": {
            border: "2px solid #000",
          },
          "&.Mui-focused": {
            border: "2px solid #000",
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            border: "none",
          },
        },
        input: {
          padding: "12px 14px",
          fontSize: "1rem",
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          "&.Mui-focused .MuiSelect-icon": {
            display: "block",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: "#000",
          "&.Mui-focused": {
            color: "#000",
          },
          transform: "translate(14px, -9px) scale(0.75)",
          "&.MuiFormLabel-filled, &.Mui-focused": {
            transform: "translate(14px, -9px) scale(0.75)",
          },
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          "& .MuiInputLabel-root": {
            backgroundColor: "#fff",
            padding: "0 4px",
          },
          "& .MuiOutlinedInput-root": {
            "& fieldset": {
              top: 0,
              "& legend": {
                display: "none",
              },
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          paddingRight: "32px !important", // Ensure space for the icon
        },
        icon: {
          right: 14,
          color: "#000",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: "2px solid #000",
          // boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          marginTop: "0px", // Small gap between select and menu
        },
        // list: {
        //   padding: 0,
        // },
      },
      defaultProps: {
        TransitionProps: {
          style: {
            transformOrigin: "top",
          },
        },
        anchorOrigin: {
          vertical: "bottom",
          horizontal: "left",
        },
        transformOrigin: {
          vertical: "top",
          horizontal: "left",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          padding: "12px 14px",
          "&:hover": {
            backgroundColor: "#f0f0f0",
          },
          "&.Mui-selected": {
            backgroundColor: "#f0f0f0",
            "&:hover": {
              backgroundColor: "#81d681",
            },
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        root: {
          "& .MuiPaper-root": {
            transform: "translateY(0) !important",
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff",
          boxShadow: "none",
          borderBottom: "2px solid #000",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: "2px solid #000",
          textTransform: "none",
          boxShadow: "none",
          transition: "all 0.1s ease-in-out",
          "&:hover": {
            backgroundColor: "#f0f0f0",
          },
          "&:active": {
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
            transform: "translate(2px, 2px)",
          },
          "&:active:hover": {
            transform: "translate(2px, 2px)",
          },
        },
        contained: {
          color: "#000",
          "&:hover": {
            backgroundColor: "#81d681",
          },
          "&.Mui-disabled": {
            backgroundColor: "#d3d3d3",
            border: "2px solid #a9a9a9",
            color: "#808080",
          },
        },
        outlined: {
          "&:hover": {
            backgroundColor: "#f0f0f0",
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          transition: "box-shadow 0.3s ease",
          "&:hover, &:focus-within": {
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          border: "2px solid #000",
          borderRadius: 0,
        },
        head: {
          backgroundColor: "#e0e0e0",
          fontWeight: "bold",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td, &:last-child th": {
            borderBottom: "2px solid #000",
          },
        },
      },
    },
  },
})

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
