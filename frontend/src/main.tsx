import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { ThemeProvider } from "@emotion/react"
import { createTheme, CssBaseline } from "@mui/material"
import "@fontsource/roboto-mono" // Import the brutalist font

// Remove the MuiPaper style overrides from the theme
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#000000", // Set primary color to black
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
          backgroundColor: "#fff",
          border: "1px solid #000",
          color: "#000",
          borderRadius: 0, // Square edges
          "&:hover": {
            backgroundColor: "#f0f0f0",
          },
          textTransform: "none", // Prevent capitalization
        },
      },
    },
    // Override MuiTableContainer styles
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Remove rounded corners
          boxShadow: "none", // Remove drop shadow
          border: "1px solid #000", // Add solid black border
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          border: "1px solid #000", // Solid black border
          borderRadius: 0, // Square edges
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td, &:last-child th": {
            borderBottom: 0, // Optional: remove bottom border from last row
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
