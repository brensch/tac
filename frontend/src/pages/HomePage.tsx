import React, { useState } from "react"
import { Button, Stack, TextField, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { addDoc, collection } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { initializeGame } from "@shared/types/Game"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [sessionName, setSessionName] = useState("")

  const handleNewGame = async () => {
    try {
      // Initialize the game with the user's ID
      const newGame = initializeGame(sessionName)

      // Define the Firestore document reference with the gameID as the document ID
      const gameCollRef = collection(db, "games")

      // Add the game to Firestore using the specified document ID
      const gameDocRef = await addDoc(gameCollRef, newGame)

      // Navigate to the new game page using the generated document ID
      navigate(`/game/${gameDocRef.id}`)
    } catch (e) {
      console.error("Error creating game: ", e)
    }
  }

  return (
    <Stack spacing={2} alignItems="center">
      <Typography pt={2} variant="body1" align="center" gutterBottom>
        Get four emojis in a row and you win.
      </Typography>
      <Typography variant="body1" align="center" gutterBottom>
        Pick the same square as your opponent and no one gets it.
      </Typography>
      <TextField
        fullWidth
        value={sessionName}
        placeholder="Session Name"
        onChange={(e) => setSessionName(e.target.value)}
      />
      <Button fullWidth onClick={handleNewGame} disabled={sessionName === ""}>
        Start session
      </Button>
      <Button fullWidth onClick={() => navigate("/join")}>
        Join session
      </Button>
    </Stack>
  )
}

export default HomePage
