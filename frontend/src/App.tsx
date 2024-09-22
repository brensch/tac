import React, { useEffect, useState } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import {
  createTheme,
  ThemeProvider,
  CssBaseline,
  Container,
  Box,
  TextField,
  Button,
} from "@mui/material"
import HomePage from "./pages/HomePage"
import JoinPage from "./pages/JoinPage"
import GamePage from "./pages/GamePage"
import { UserProvider } from "./context/UserContext" // Import the UserProvider
import { getOrCreateUserWithNickname } from "./utils/user"
import Cookies from "js-cookie" // Import js-cookie to check for userID

const theme = createTheme({
  palette: {
    mode: "light",
  },
})

const App: React.FC = () => {
  const [nickname, setNickname] = useState<string>("")
  const [isUserCreated, setIsUserCreated] = useState<boolean>(false)

  // Check if the user ID is already in cookies
  useEffect(() => {
    const storedUserID = Cookies.get("userID")
    if (storedUserID) {
      setIsUserCreated(true) // User already exists
    }
  }, []) // Run this once when the app loads

  const handleNicknameSubmit = async () => {
    await getOrCreateUserWithNickname(nickname)
    setIsUserCreated(true)
  }

  // If the user hasn't been created, show the nickname prompt
  if (!isUserCreated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container
          maxWidth="md"
          sx={{
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            width="100%"
            display="flex"
            flexDirection="column"
            alignItems="center"
          >
            <TextField
              label="Nickname"
              variant="outlined"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleNicknameSubmit}
              sx={{ mt: 2 }}
            >
              Submit Nickname
            </Button>
          </Box>
        </Container>
      </ThemeProvider>
    )
  }

  // If user is created, render the main app with UserProvider
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <UserProvider>
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
      </UserProvider>
    </ThemeProvider>
  )
}

export default App
