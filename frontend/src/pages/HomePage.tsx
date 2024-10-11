import React, { useState } from "react"
import { Button, Stack, TextField, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "../firebaseConfig"
import { GameState } from "@shared/types/Game"
import { useUser } from "../context/UserContext"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [sessionName, setSessionName] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { colour } = useUser()

  const handleNewGame = async () => {
    try {
      // Check if a game with the same sessionName already exists
      const gameCollRef = collection(db, "games")
      const gameQuery = query(
        gameCollRef,
        where("sessionName", "==", sessionName),
      )
      const querySnapshot = await getDocs(gameQuery)

      if (!querySnapshot.empty) {
        // If a game with the same sessionName exists, show the error message
        setErrorMessage("Session already exists. Join instead?")
        return
      }

      // Initialize the game with the user's ID
      const newGame = initializeGame(sessionName)

      console.log(newGame)

      // Add the game to Firestore
      const gameDocRef = await addDoc(gameCollRef, newGame)

      // Navigate to the new game page using the generated document ID
      navigate(`/game/${gameDocRef.id}`)
    } catch (e) {
      console.error("Error creating game: ", e)
    }
  }

  const handleJoin = () => {
    if (sessionName.trim()) {
      navigate(`/session/${sessionName}`)
    }
  }

  return (
    <Stack spacing={2} alignItems="left">
      <Typography pt={2} variant="h4" align="left" gutterBottom>
        Games entirely unrelated to toes*
      </Typography>

      <TextField
        fullWidth
        value={sessionName}
        // label="Session Name"
        placeholder="Type your session name"
        onChange={(e) => {
          // Convert to lowercase and remove non-letter characters
          const lowercaseValue = e.target.value
            .toLowerCase()
            .replace(/[^a-z]/g, "")
          setSessionName(lowercaseValue)
          setErrorMessage(null) // Clear error message on input change
        }}
        sx={{
          pt: 10,
          "& .MuiOutlinedInput-root": {
            backgroundColor: colour, // Set background color to orange
            "& fieldset": {
              borderColor: "black", // Default border color
            },
            "&:hover fieldset": {
              borderColor: "black", // Border color when hovered
            },
            "&.Mui-focused fieldset": {
              borderColor: "black", // Border color when focused
            },
            "& input": {
              backgroundColor: colour, // Ensure the input area has the same background
            },
          },
        }}
      />
      {errorMessage && (
        <Typography color="error" variant="body2">
          {errorMessage}
        </Typography>
      )}

      {/* Stack for the buttons in a row, taking full width */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
        alignItems="center"
      >
        <Button
          sx={{ flexGrow: 1 }}
          onClick={handleNewGame}
          disabled={sessionName === ""}
        >
          Start session
        </Button>
        <Button
          sx={{ flexGrow: 1 }}
          onClick={handleJoin}
          disabled={sessionName === ""}
        >
          Join session
        </Button>
      </Stack>
      <Typography pt={5} variant="body2" align="left" gutterBottom>
        Create a new session name using a memorable word, or type in the word
        your friend is yelling at you to join them.
      </Typography>

      <Typography pt={2} variant="body2" align="left" gutterBottom>
        Ugly colour? Uninspired emoji? Edit it in the top right.
      </Typography>
      <Typography
        pt={2}
        variant="subtitle2"
        align="left"
        gutterBottom
      ></Typography>

      {/* Footer text fixed at the bottom */}
      <Typography
        pt={2}
        variant="body1"
        align="left"
        gutterBottom
        sx={{
          position: "fixed",
          bottom: 10,
          left: 10,
          width: "100%",
          textAlign: "left",
        }}
      >
        * Toes may be involved.
        <br /> A game by brendo
      </Typography>
    </Stack>
  )
}

export default HomePage

// Function to initialize a new game
const initializeGame = (
  sessionName: string,
  boardWidth: number = 8,
  boardHeight: number = 8,
): GameState => {
  return {
    sessionName: sessionName,
    gameType: "snek",
    sessionIndex: 0,
    playersReady: [],
    boardWidth: boardWidth,
    boardHeight: boardHeight,
    winners: [], // Initialize as empty array
    started: false,
    nextGame: "",
    maxTurnTime: 10, // Default time limit per turn in seconds
    startRequested: false,
    timeCreated: serverTimestamp(),
    gamePlayers: [],
  }
}
