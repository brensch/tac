import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import { ThemeProvider } from "@emotion/react"
import { createTheme, CssBaseline } from "@mui/material"

const theme = createTheme({
  palette: {
    mode: "light",
  },
  components: {
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
          "&:hover": {
            backgroundColor: "#f0f0f0",
          },
          textTransform: "none", // Prevent capitalization
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
