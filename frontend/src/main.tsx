import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { ThemeProvider } from "@emotion/react"
import { createTheme, CssBaseline } from "@mui/material"
import "@fontsource/roboto-mono" // Import the brutalist font

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#000000",
    },
    success: {
      main: "#90ee90",
    },
  },
  typography: {
    fontFamily: '"Roboto Mono", monospace',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*": {
          boxSizing: "border-box",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: "2px solid #000",
          boxShadow: "none", // Remove default box shadow
          transition: "box-shadow 0.3s ease", // Add transition for smooth effect
          "&:hover": {
            border: "2px solid #000",
          },
          "&.Mui-focused": {
            border: "2px solid #000",
            boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)", // Apply box shadow only when focused
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
            display: "block", // Show dropdown icon when focused
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
        icon: {
          display: "none", // Hide dropdown icon by default
        },
        select: {
          "&:focus": {
            backgroundColor: "transparent",
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          marginTop: 0, // Remove default margin
          borderRadius: 0,
          border: "2px solid #000",
          boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
          animation: "$slideIn 0.3s ease-out",
        },
      },
      defaultProps: {
        anchorOrigin: {
          vertical: "top",
          horizontal: "left",
        },
        transformOrigin: {
          vertical: "top",
          horizontal: "left",
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
    MuiList: {
      styleOverrides: {
        root: {
          padding: 0, // Remove default padding
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "#f0f0f0",
          },
          "&.Mui-selected": {
            backgroundColor: "#90ee90",
            "&:hover": {
              backgroundColor: "#81d681",
            },
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
          // border: "2px solid #000",
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
