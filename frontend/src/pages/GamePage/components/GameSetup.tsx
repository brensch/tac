import { arrayUnion, doc, updateDoc } from "firebase/firestore"
import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useUser } from "../../../context/UserContext"
import { db } from "../../../firebaseConfig"

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { useGameStateContext } from "../../../context/GameStateContext"
import { GameType } from "@shared/types/Game"

const GameSetup: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()
  const { userID } = useUser()
  const { gameState, playerInfos } = useGameStateContext()

  const [boardWidth, setBoardWidth] = useState<string>("8")
  const [gameType, setGameType] = useState<GameType>("connect4")
  const [secondsPerTurn, setSecondsPerTurn] = useState<string>("10")

  useEffect(() => {
    setBoardWidth(`${gameState?.boardWidth}`)
    if (gameState?.gameType) setGameType(gameState?.gameType)
    setSecondsPerTurn(`${gameState?.maxTurnTime}`)
  }, [gameState])

  // Start game
  const handleStartGame = async () => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        playersReady: arrayUnion(userID), // Add the current userID to playersReady array
      })
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tactic toes",
          text: "This game is completely unrelated to toes.",
          url: `/session/${gameState?.sessionName}`,
        })
        console.log("Content shared successfully")
      } catch (error) {
        console.error("Error sharing content:", error)
      }
    } else {
      console.log("Web Share API is not supported in your browser.")
    }
  }

  // Handle board width change
  const handleBoardWidthChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value
    setBoardWidth(value)
  }

  // Update Firestore when the input loses focus
  const handleBoardWidthBlur = async () => {
    if (gameID && !gameState?.started) {
      const newBoardWidth = parseInt(boardWidth, 10)
      const gameDocRef = doc(db, "games", gameID)

      if (!isNaN(newBoardWidth) && newBoardWidth >= 5 && newBoardWidth <= 20) {
        await updateDoc(gameDocRef, {
          boardWidth: newBoardWidth,
        })
      } else {
        // Handle invalid input: reset to default
        setBoardWidth("8")
        await updateDoc(gameDocRef, {
          boardWidth: 8,
        })
      }
    }
  }

  // Handler for selecting game type
  const handleGameTypeChange = async (event: SelectChangeEvent<GameType>) => {
    const selectedGameType = event.target.value as "connect4" | "longboi" // Type casting to the enum type
    setGameType(selectedGameType)

    // Update Firestore when game type is selected
    if (gameID && !gameState?.started) {
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, { gameType: selectedGameType })
    }
  }

  // Handle seconds per turn change
  const handleSecondsPerTurnChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setSecondsPerTurn(event.target.value)
  }

  const handleSecondsPerTurnBlur = async () => {
    if (gameID && !gameState?.started) {
      const newMaxTurnTime = parseInt(secondsPerTurn, 10)
      const gameDocRef = doc(db, "games", gameID)

      if (!isNaN(newMaxTurnTime) && newMaxTurnTime > 0) {
        await updateDoc(gameDocRef, {
          maxTurnTime: newMaxTurnTime,
        })
      } else {
        // Handle invalid input: reset to default
        setSecondsPerTurn("10")
        await updateDoc(gameDocRef, {
          maxTurnTime: 10,
        })
      }
    }
  }

  if (!gameState || gameState.started) return null

  const { started, playersReady } = gameState

  return (
    <Box>
      <Box sx={{ my: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          New Game
        </Typography>

        <TextField
          label="Board Size"
          type="number"
          value={boardWidth}
          onChange={handleBoardWidthChange}
          onBlur={handleBoardWidthBlur}
          disabled={started}
          fullWidth
        />
        {gameState.boardWidth < 5 && (
          <Typography color="error">Board needs to be bigger than 4</Typography>
        )}

        <TextField
          label="Seconds per Turn"
          type="number"
          value={secondsPerTurn}
          onChange={handleSecondsPerTurnChange}
          onBlur={handleSecondsPerTurnBlur}
          disabled={started}
          fullWidth
          sx={{ mt: 2 }}
        />
        {parseInt(secondsPerTurn) <= 0 && (
          <Typography color="error">
            Seconds per Turn must be greater than 0
          </Typography>
        )}

        {/* Game Type Dropdown */}
        <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
          <InputLabel id="game-type-label">Game Type</InputLabel>
          <Select
            labelId="game-type-label"
            value={gameType}
            onChange={handleGameTypeChange}
            disabled={started}
            label="Game Type" // Make sure this matches the InputLabel text
          >
            <MenuItem value="connect4">Connect 4</MenuItem>
            <MenuItem value="longboi">Long Boi</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Players Table */}
      <TableContainer sx={{ my: 2, width: "100%" }}>
        <Table size="small" sx={{ borderCollapse: "collapse" }}>
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell>
              <TableCell align="right">Ready</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {playerInfos.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.nickname} {player.emoji}
                </TableCell>
                <TableCell align="right">
                  {playersReady.includes(player.id) ? "Yeah" : "Nah"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Ready Section */}
      {!started && (
        <Box>
          <Typography sx={{ mb: 2 }}>Press ready when you're ready.</Typography>
          <Button fullWidth onClick={handleShare} sx={{ mb: 2 }}>
            Invite
          </Button>
          <Button
            variant={playersReady.includes(userID) ? "contained" : "outlined"}
            disabled={
              started ||
              gameState.boardWidth < 5 ||
              gameState.boardWidth > 20 ||
              parseInt(secondsPerTurn) <= 0
            }
            onClick={handleStartGame}
            sx={{ mb: 2 }}
            fullWidth
          >
            I'm ready
            {/* {elapsedTime !== 0 &&
              `(starting in ${Math.max(60 - elapsedTime, 0)})`} */}
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default GameSetup
