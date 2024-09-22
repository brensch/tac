import React from "react"
import { Button, Stack, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { doc, setDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { initializeGame } from "@shared/types/Game"
import { useUser } from "../context/UserContext"

const buttonStyle = {
  backgroundColor: "#000",
  color: "#fff",
  padding: "16px 32px",
  fontWeight: "bold",
  textShadow: "2px 2px #f00",
  boxShadow: "8px 8px #f00",
}

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
    <Stack spacing={4} alignItems="center">
      <Typography variant="h3" align="center" gutterBottom>
        Welcome
      </Typography>
      <Button sx={buttonStyle} fullWidth onClick={handleNewGame}>
        New Game
      </Button>
      <Button sx={buttonStyle} fullWidth onClick={() => navigate("/join")}>
        Join Game
      </Button>
    </Stack>
  )
}

export default HomePage
