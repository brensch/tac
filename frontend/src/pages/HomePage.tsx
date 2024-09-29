import React, { useState } from "react"
import { Button, Stack, TextField, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { addDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { initializeGame } from "@shared/types/Game"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [sessionName, setSessionName] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      <Typography pt={2} variant="body1" align="left" gutterBottom>
        Welcome to Toe central.
      </Typography>

      <TextField
        fullWidth
        value={sessionName}
        label="Session name"
        onChange={(e) => {
          // Convert to lowercase and remove non-letter characters
          const lowercaseValue = e.target.value
            .toLowerCase()
            .replace(/[^a-z]/g, "")
          setSessionName(lowercaseValue)
          setErrorMessage(null) // Clear error message on input change
        }}
      />
      {errorMessage && (
        <Typography color="error" variant="body2">
          {errorMessage}
        </Typography>
      )}
      <Button fullWidth onClick={handleNewGame} disabled={sessionName === ""}>
        Start session
      </Button>
      <Button fullWidth onClick={handleJoin} disabled={sessionName === ""}>
        Join session
      </Button>
    </Stack>
  )
}

export default HomePage
