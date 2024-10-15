import React, { useState, Suspense, ErrorInfo, ReactNode } from "react"
import {
  BrowserRouter as Router,
  Routes,
  Route,
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
  CircularProgress,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import HomePage from "./pages/HomePage"
import GamePage from "./pages/GamePage/index"
import ProfilePage from "./pages/ProfilePage"
import { UserProvider, useUser, UserContextType } from "./context/UserContext"
import Sessionpage from "./pages/SessionPage"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "./firebaseConfig"
import { EmojiCycler } from "./components/EmojiCycler"

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Caught an error:", error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <h1>Something went wrong. Please refresh the page.</h1>
    }

    return this.props.children
  }
}

// Wrap AppContent with error handling and user context check
const SafeAppContent: React.FC = () => {
  const userContext = useUser()

  if (!userContext) {
    return <EmojiCycler />
  }

  return <AppContent />
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <UserProvider>
        <Router>
          <Suspense fallback={<EmojiCycler />}>
            <SafeAppContent />
          </Suspense>
        </Router>
      </UserProvider>
    </ErrorBoundary>
  )
}

const AppContent: React.FC = () => {
  const { name, emoji, colour, userID } = useUser() as UserContextType
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false)
  const [updatedName, setUpdatedName] = useState<string>(name)
  const [updatedColour, setUpdatedColour] = useState<string>(colour)
  const [updatedEmoji, setUpdatedEmoji] = useState<string>(emoji)
  const navigate = useNavigate()

  // Open the profile modal
  const handleProfileOpen = (): void => {
    setIsProfileOpen(true)
  }

  // Save the name and colour when closing the profile
  const handleProfileClose = async (): Promise<void> => {
    const userDocRef = doc(db, "users", userID)
    await updateDoc(userDocRef, {
      name: updatedName,
      colour: updatedColour,
      emoji: updatedEmoji,
    })
    setIsProfileOpen(false)
  }

  return (
    <>
      <AppBar position="static">
        <Container maxWidth="sm" sx={{ p: 1, display: "flex" }}>
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
            🦶 tactic toes
          </Button>
          <Typography
            variant="h6"
            color="primary"
            sx={{ flexGrow: 1, textDecoration: "none" }}
          />

          <Button
            color="primary"
            sx={{ height: 30, backgroundColor: colour }}
            onClick={handleProfileOpen}
          >
            {name} {emoji}
          </Button>
        </Container>
      </AppBar>
      <Container maxWidth="sm" sx={{ p: 1 }}>
        <Box width="100%">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/session/:sessionName" element={<Sessionpage />} />
            <Route
              path="/session/:sessionName/:gameID"
              element={<GamePage />}
            />
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
          <ProfilePage
            setUpdatedName={setUpdatedName}
            setUpdatedColour={setUpdatedColour}
            setUpdatedEmoji={setUpdatedEmoji}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default App
