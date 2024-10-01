// src/pages/GamePage/components/GameSetup.tsx

import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore"
import React, { useEffect, useState, useRef } from "react"
import { useParams } from "react-router-dom"
import { useUser } from "../../context/UserContext"
import { db } from "../../firebaseConfig"

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { useGameStateContext } from "../../context/GameStateContext"
import { GameType } from "@shared/types/Game"
import { getRulesComponent } from "./RulesDialog"

const GameSetup: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()
  const { userID } = useUser()
  const { gameState, playerInfos } = useGameStateContext()

  const [boardWidth, setBoardWidth] = useState<string>("8")
  const [boardHeight, setBoardHeight] = useState<string>("8")
  const [gameType, setGameType] = useState<GameType>("snek")
  const [secondsPerTurn, setSecondsPerTurn] = useState<string>("10")
  const [RulesComponent, setRulesComponent] = useState<React.FC | null>(null)

  // Update local state when gameState changes
  useEffect(() => {
    if (gameState) {
      setBoardWidth(`${gameState.boardWidth}`)
      setBoardHeight(`${gameState.boardHeight}`)
      if (gameState.gameType) setGameType(gameState.gameType)
      setSecondsPerTurn(`${gameState.maxTurnTime}`)
    }
  }, [gameState])

  // Start game
  const handleReady = async () => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        playersReady: arrayUnion(userID), // Add the current userID to playersReady array
      })
    }
  }

  // Start game
  const handleStart = async () => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        startRequested: true, // Add the current userID to playersReady array
      })
    }
  }

  // Kick a player by removing their playerID from the playerIDs field
  const handleKick = async (playerID: string) => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)

      await updateDoc(gameDocRef, {
        playerIDs: arrayRemove(playerID), // Remove the specified playerID from playerIDs array
      })
    }
  }

  // Handle board width change
  const handleBoardWidthChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value
    setBoardWidth(value)
  }

  // Handle board width change
  const handleBoardHeightChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value
    setBoardHeight(value)
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
      }
    }
  }

  // Update Firestore when the input loses focus
  const handleBoardHeightBlur = async () => {
    if (gameID && !gameState?.started) {
      const newBoardHeight = parseInt(boardHeight, 10)
      const gameDocRef = doc(db, "games", gameID)

      if (
        !isNaN(newBoardHeight) &&
        newBoardHeight >= 5 &&
        newBoardHeight <= 20
      ) {
        await updateDoc(gameDocRef, {
          boardHeight: newBoardHeight,
        })
      } else {
        // Handle invalid input: reset to default
        setBoardHeight("8")
        await updateDoc(gameDocRef, {
          boardHeight: 8,
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

  useEffect(() => {
    setRulesComponent(() => getRulesComponent(gameState?.gameType))
  }, [gameState?.gameType])

  if (!gameState || gameState.started) return null

  const { started, playersReady } = gameState

  return (
    <Stack spacing={2} pt={2}>
      <Typography variant="h5">New Game</Typography>
      <Box sx={{ display: "flex", gap: 2 }}>
        <TextField
          label="Board Width"
          type="number"
          value={boardWidth}
          onChange={handleBoardWidthChange}
          onBlur={handleBoardWidthBlur}
          disabled={started}
          fullWidth
        />
        <TextField
          label="Board Height"
          type="number"
          value={boardHeight}
          onChange={handleBoardHeightChange}
          onBlur={handleBoardHeightBlur}
          disabled={started}
          fullWidth
        />
        {gameState.boardWidth < 5 && (
          <Typography color="error">Board needs to be bigger than 4</Typography>
        )}

        <TextField
          label="Turn time (s)"
          type="number"
          value={secondsPerTurn}
          onChange={handleSecondsPerTurnChange}
          onBlur={handleSecondsPerTurnBlur}
          disabled={started}
          fullWidth
        />
        {parseInt(secondsPerTurn) <= 0 && (
          <Typography color="error">
            Seconds per Turn must be greater than 0
          </Typography>
        )}
      </Box>
      {/* Game Type Dropdown */}
      <FormControl fullWidth variant="outlined">
        <InputLabel id="game-type-label">Game Type</InputLabel>
        <Select
          labelId="game-type-label"
          value={gameType}
          onChange={handleGameTypeChange}
          disabled={started}
          label="Game Type" // Make sure this matches the InputLabel text
        >
          <MenuItem value="snek">Snek</MenuItem>
          <MenuItem value="connect4">Connect 4</MenuItem>
          <MenuItem value="tactictoes">Tactic Toes</MenuItem>
          <MenuItem value="longboi">Long Boi</MenuItem>
        </Select>
      </FormControl>

      {/* Game rules */}
      {RulesComponent && <RulesComponent />}

      {/* Players Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell>
              <TableCell align="right">Ready</TableCell>
              <TableCell align="right">Kick</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {playerInfos.map((player) => (
              <TableRow key={player.id}>
                <TableCell sx={{ backgroundColor: player.colour }}>
                  {player.nickname} {player.emoji}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ backgroundColor: player.colour }}
                >
                  {playersReady.includes(player.id) ? "Yeah" : "Nah"}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ backgroundColor: player.colour }}
                >
                  <Button
                    onClick={() => handleKick(player.id)}
                    sx={{ height: 20 }}
                  >
                    Kick?
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Ready Section */}

      {!gameState.playerIDs.every((player) =>
        gameState.playersReady.includes(player),
      ) ? (
        <Button
          variant="contained"
          disabled={
            started ||
            gameState.boardWidth < 5 ||
            gameState.boardWidth > 20 ||
            parseInt(secondsPerTurn) <= 0 ||
            gameState.playersReady.includes(userID)
          }
          onClick={handleReady}
          fullWidth
        >
          <Typography variant="body2">
            {gameState.playersReady.includes(userID)
              ? `Waiting for others`
              : "Ready?"}
          </Typography>
        </Button>
      ) : (
        <Button
          disabled={gameState.startRequested}
          variant="contained"
          onClick={handleStart}
          fullWidth
        >
          <Typography variant="body2">Start game</Typography>
        </Button>
      )}
    </Stack>
  )
}

export default GameSetup
