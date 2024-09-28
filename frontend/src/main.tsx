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
      main: "#000000", // Set primary color to black
    },
    success: {
      main: "#90ee90", // Light green background color
    },
  },
  typography: {
    fontFamily: '"Roboto Mono", monospace', // Set brutalist font
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Square edges
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#000", // Solid black outline
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#000",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#000",
          },
        },
        input: {
          padding: "10px", // Optional: adjust padding
          fontSize: "1rem", // Optional: adjust font size
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
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff",
          boxShadow: "none",
          borderBottom: "1px solid #000",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Square edges
          border: "1px solid #000", // Black border
          textTransform: "none", // Prevent capitalization
          boxShadow: "none", // Remove drop shadow for all buttons
          "&:hover": {
            boxShadow: "none", // Ensure no drop shadow on hover
          },
        },
        contained: {
          backgroundColor: "#90ee90", // Light green for contained buttons
          border: "1px solid #000", // Black border
          color: "#000", // Black font color for contained buttons
          "&:hover": {
            backgroundColor: "#81d681", // Slightly darker green on hover
            boxShadow: "none", // No drop shadow on hover
          },
        },
        outlined: {
          backgroundColor: "#fff", // White background for outlined buttons
          border: "1px solid #000", // Black border
          "&:hover": {
            backgroundColor: "#f0f0f0", // Slightly gray on hover
            boxShadow: "none", // No drop shadow on hover
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Remove rounded corners
          boxShadow: "none", // Remove drop shadow
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          border: "1px solid #000", // Solid black border
          borderRadius: 0, // Square edges
        },
        head: {
          backgroundColor: "#e0e0e0", // Slightly different color for header
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td, &:last-child th": {
            borderBottom: "1px solid #000", // Ensure bottom border is present
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
