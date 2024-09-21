// src/App.tsx
import React from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import {
  createTheme,
  ThemeProvider,
  CssBaseline,
  Container,
  Box,
} from "@mui/material"
import HomePage from "./pages/HomePage"
import JoinPage from "./pages/JoinPage"
import GamePage from "./pages/GamePage"

const theme = createTheme({
  palette: {
    mode: "light",
  },
})

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Container
          maxWidth="md"
          sx={{
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box width="100%">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/join" element={<JoinPage />} />
              <Route path="/game/:gameID" element={<GamePage />} />
            </Routes>
          </Box>
        </Container>
      </Router>
    </ThemeProvider>
  )
}

export default App
