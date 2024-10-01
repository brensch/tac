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
import { doc, updateDoc } from "firebase/firestore"
import { db } from "./firebaseConfig"

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
  const { nickname, emoji, colour, userID } = useUser()
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false)
  const [updatedNickname, setUpdatedNickname] = useState<string>(nickname)
  const [updatedColour, setUpdatedColour] = useState<string>(colour)
  const [updatedEmoji, setUpdatedEmoji] = useState<string>(emoji)
  const navigate = useNavigate()

  // Open the profile modal
  const handleProfileOpen = () => {
    setIsProfileOpen(true)
  }

  // Save the nickname and colour when closing the profile
  const handleProfileClose = async () => {
    const userDocRef = doc(db, "users", userID)
    await updateDoc(userDocRef, {
      nickname: updatedNickname,
      colour: updatedColour,
      emoji: updatedEmoji,
    })
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
              minWidth: "auto",
              padding: 0,
              px: 1,
              mr: 2,
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
        onClose={handleProfileClose} // Trigger save on close
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
          <ProfilePage
            setUpdatedNickname={setUpdatedNickname}
            setUpdatedColour={setUpdatedColour}
            setUpdatedEmoji={setUpdatedEmoji}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default App
