import React, { useEffect, useState } from "react"
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link as RouterLink,
} from "react-router-dom"
import {
  Container,
  Box,
  TextField,
  Button,
  AppBar,
  Toolbar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close" // Import CloseIcon
import HomePage from "./pages/HomePage"
import JoinPage from "./pages/JoinPage"
import GamePage from "./pages/GamePage"
import ProfilePage from "./pages/ProfilePage"
import { UserProvider, useUser } from "./context/UserContext"
import { getOrCreateUserWithNickname } from "./utils/user"
import Cookies from "js-cookie"
import { emojiList } from "@shared/types/Emojis"

const App: React.FC = () => {
  const [nickname, setNickname] = useState<string>("")
  const [isUserCreated, setIsUserCreated] = useState<boolean>(false)
  const [selectedEmoji, setSelectedEmoji] = useState<string>("")
  const [message, setMessage] = useState<string>("")

  // Check if the user ID is already in cookies
  useEffect(() => {
    const storedUserID = Cookies.get("userID")
    if (storedUserID) {
      setIsUserCreated(true) // User already exists
    }
  }, []) // Run this once when the app loads

  const handleNicknameSubmit = async () => {
    if (!nickname.trim() || !selectedEmoji) {
      setMessage("Please enter a nickname and select an emoji.")
      return
    }
    await getOrCreateUserWithNickname(nickname, selectedEmoji)
    setIsUserCreated(true)
  }

  // If the user hasn't been created, show the nickname and emoji prompt
  if (!isUserCreated) {
    return (
      <Container sx={{ mt: 1 }}>
        <Box
          width="100%"
          display="flex"
          flexDirection="column"
          alignItems="center"
        >
          <Typography variant="h4" sx={{ my: 4 }}>
            Hi. Glad you're here.
          </Typography>
          <TextField
            label="Nickname"
            variant="outlined"
            value={nickname}
            sx={{ mb: 2 }}
            onChange={(e) => setNickname(e.target.value)}
            fullWidth
          />

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2, // Add some spacing between buttons
              justifyContent: "center",
              my: 2,
            }}
          >
            {emojiList.map((emoji) => (
              <Button
                key={emoji}
                variant={selectedEmoji === emoji ? "contained" : "outlined"}
                onClick={() => setSelectedEmoji(emoji)}
                sx={{ fontSize: "2rem", width: "50px", height: "50px" }}
              >
                {emoji}
              </Button>
            ))}
          </Box>
          {message && (
            <Typography color="error" sx={{ mt: 2 }}>
              {message}
            </Typography>
          )}
          <Button onClick={handleNicknameSubmit} sx={{ mt: 2 }}>
            Let's go
          </Button>
        </Box>
      </Container>
    )
  }

  // If user is created, render the main app with UserProvider
  return (
    <UserProvider>
      <Router>
        <AppContent />
      </Router>
    </UserProvider>
  )
}

const AppContent: React.FC = () => {
  const { nickname, emoji } = useUser() // Access nickname from UserContext
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false) // State to manage modal

  // Handlers to open and close the modal
  const handleProfileOpen = () => {
    setIsProfileOpen(true)
  }

  const handleProfileClose = () => {
    setIsProfileOpen(false)
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            color="primary"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, textDecoration: "none" }}
          >
            tactic toes
          </Typography>
          <Button color="primary" onClick={handleProfileOpen}>
            {nickname} {emoji}
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm">
        <Box width="100%">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/game/:gameID" element={<GamePage />} />
            {/* Remove the profile route */}
            {/* <Route path="/profile" element={<ProfilePage />} /> */}
          </Routes>
        </Box>
      </Container>

      {/* Profile Modal */}
      <Dialog
        open={isProfileOpen}
        onClose={handleProfileClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Update Profile
          <IconButton
            aria-label="close"
            onClick={handleProfileClose}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <ProfilePage />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default App
