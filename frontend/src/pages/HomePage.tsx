import React from "react"
import { Button, Stack, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { doc, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { initializeGame } from "@shared/types/Game"
import { useUser } from "../context/UserContext"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { userID } = useUser()

  const handleNewGame = async () => {
    if (!userID) {
      return
    }
    try {
      // Initialize the game with the user's ID
      const newGame = initializeGame(userID)

      // Define the Firestore document reference with the gameID as the document ID
      const gameDocRef = doc(db, "games", newGame.gameID)

      // Add the game to Firestore using the specified document ID
      await setDoc(gameDocRef, newGame)

      // Navigate to the new game page using the generated document ID
      navigate(`/game/${newGame.gameID}`)
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
      <Button fullWidth onClick={handleNewGame}>
        New Game
      </Button>
      <Button fullWidth onClick={() => navigate("/join")}>
        Join Game
      </Button>
    </Stack>
  )
}

export default HomePage
