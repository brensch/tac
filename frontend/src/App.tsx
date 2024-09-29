import React, { useState } from "react"
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link as RouterLink,
  useNavigate,
} from "react-router-dom"
import {
  Container,
  Box,
  Button,
  AppBar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import HomePage from "./pages/HomePage"
import GamePage from "./pages/GamePage/index"
import ProfilePage from "./pages/ProfilePage"
import { UserProvider, useUser } from "./context/UserContext"
import Sessionpage from "./pages/SessionPage"

const App: React.FC = () => {
  return (
    <UserProvider>
      <Router>
        <AppContent />
      </Router>
    </UserProvider>
  )
}

const AppContent: React.FC = () => {
  const { nickname, emoji, colour } = useUser()
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false)
  const navigate = useNavigate()

  const handleProfileOpen = () => {
    setIsProfileOpen(true)
  }

  const handleProfileClose = () => {
    setIsProfileOpen(false)
  }

  return (
    <>
      <AppBar position="static">
        <Container maxWidth="sm" sx={{ p: 1, display: "flex" }}>
          <Typography
            variant="h6"
            color="primary"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, textDecoration: "none" }}
          >
            🦶 tactic toes
          </Typography>
          <Button
            color="primary"
            sx={{
              height: 30,
              minWidth: "auto", // Set minWidth to auto to adjust to the content size
              padding: 0, // Remove padding to make the button fit the emoji size
              px: 1,
              mr: 2, // Margin right to give space between buttons
            }}
            onClick={() => navigate("/")}
          >
            🏠
          </Button>
          <Button
            color="primary"
            sx={{ height: 30, backgroundColor: colour }}
            onClick={handleProfileOpen}
          >
            {nickname} {emoji}
          </Button>
        </Container>
      </AppBar>
      <Container maxWidth="sm" sx={{ p: 1 }}>
        <Box width="100%">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:gameID" element={<GamePage />} />
            <Route path="/session/:sessionName" element={<Sessionpage />} />
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
        <DialogContent sx={{ overflowX: "hidden" }}>
          <ProfilePage />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default App
