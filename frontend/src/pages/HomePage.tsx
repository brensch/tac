import React from "react"
import { Button, Stack, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { collection, doc, setDoc } from "firebase/firestore" // Use setDoc instead of addDoc to specify the document ID
import { db } from "../firebaseConfig"
import { GameState, initializeGame } from "../../../shared/types/Game"
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
      // Initialize the game with a specific user ID
      const newGame = initializeGame(userID)
      console.log(newGame)

      // Define the Firestore document reference with the gameID as the document ID
      const gameDocRef = doc(db, "games", newGame.gameID)

      // Add the game to Firestore using the specified document ID
      const gameState: GameState = {
        boardWidth: newGame.boardWidth,
        board: newGame.board,
        playerIDs: newGame.playerIDs,
        currentRound: newGame.currentRound,
        gameID: newGame.gameID, // Use the generated gameID from initializeGame
        started: newGame.started,
        hasMoved: newGame.hasMoved,
      }
      await setDoc(gameDocRef, gameState)

      // Navigate to the new game page using the generated document ID
      navigate(`/game/${newGame.gameID}`)
    } catch (e) {
      console.error("Error creating game: ", e)
    }
  }

  return (
    <Stack spacing={4} alignItems="center">
      <Typography variant="h3" align="center" gutterBottom>
        Hi
      </Typography>
      <Button sx={buttonStyle} fullWidth onClick={handleNewGame}>
        New
      </Button>
      <Button sx={buttonStyle} fullWidth onClick={() => navigate("/join")}>
        Join
      </Button>
    </Stack>
  )
}

export default HomePage
