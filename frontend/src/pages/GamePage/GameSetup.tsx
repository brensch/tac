// src/pages/GamePage/components/GameSetup.tsx

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  updateDoc,
} from "firebase/firestore"
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
import { Connect4Rules } from "../../constants/Rules"

const GameSetup: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()
  const { userID } = useUser()
  const { gameState, playerInfos } = useGameStateContext()

  const [boardWidth, setBoardWidth] = useState<string>("8")
  const [boardHeight, setBoardHeight] = useState<string>("8")
  const [gameType, setGameType] = useState<GameType>("snek")
  const [secondsPerTurn, setSecondsPerTurn] = useState<string>("10")
  const [countdown, setCountdown] = useState<number>(60) // Countdown state in seconds
  const [RulesComponent, setRulesComponent] = useState<React.FC>(Connect4Rules)

  // **NEW**: Ref to store the interval ID
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)

  // Update local state when gameState changes
  useEffect(() => {
    if (gameState) {
      setBoardWidth(`${gameState.boardWidth}`)
      setBoardHeight(`${gameState.boardHeight}`)
      if (gameState.gameType) setGameType(gameState.gameType)
      setSecondsPerTurn(`${gameState.maxTurnTime}`)
    }
  }, [gameState])

  // Initialize countdown when firstPlayerReadyTime is set
  useEffect(() => {
    if (!gameState?.firstPlayerReadyTime || gameState.started) return

    const startDelay = 60 // seconds
    const firstReadyTime = gameState.firstPlayerReadyTime.toDate().getTime() // Convert Firestore Timestamp to JS Date
    let intervalTime = 1000 // Initial interval time

    const intervalFunction = async () => {
      const now = Date.now()
      const elapsedSeconds = (now - firstReadyTime) / 1000
      const remaining = startDelay - elapsedSeconds
      setCountdown(Math.max(remaining, 0))

      if (elapsedSeconds < 60) {
        return // If there's still time remaining, continue the interval
      }

      const expirationRequestsRef = collection(
        db,
        `games/${gameID}/readyExpirationRequests`,
      )

      await addDoc(expirationRequestsRef, {
        timestamp: new Date(),
      })

      console.log(`Ready expiration request created for gameID: ${gameID}`)

      // Slow down the interval after expiration to reduce resource usage
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current) // Clear the current interval
      }
      intervalTime = 3000 // Increase interval time
      intervalIdRef.current = setInterval(intervalFunction, intervalTime) // Set new interval with the updated time
    }

    // Clear any existing interval before setting a new one
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
    }

    intervalIdRef.current = setInterval(intervalFunction, intervalTime) // Set initial interval

    // Cleanup function: stop the timer when component unmounts or dependencies change
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [gameState?.firstPlayerReadyTime, gameState?.started, gameID])

  useEffect(() => {
    if (countdown === 0 && intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }
  }, [countdown])

  // Start game
  const handleStartGame = async () => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        playersReady: arrayUnion(userID), // Add the current userID to playersReady array
        firstPlayerReadyTime: gameState.firstPlayerReadyTime || new Date(), // Ensure firstPlayerReadyTime is set
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
        await updateDoc(gameDocRef, {
          boardWidth: 8,
        })
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
      <RulesComponent />

      {/* Players Table */}
      <TableContainer>
        <Table size="small">
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

      <Button
        variant="contained"
        disabled={
          started ||
          gameState.boardWidth < 5 ||
          gameState.boardWidth > 20 ||
          parseInt(secondsPerTurn) <= 0 ||
          gameState.playersReady.includes(userID)
        }
        onClick={handleStartGame}
        fullWidth
      >
        <Typography variant="body2">
          {gameState.playersReady.includes(userID)
            ? `Waiting for others`
            : "Ready?"}
          {!!gameState.firstPlayerReadyTime &&
            ` (starting in ${countdown.toFixed(0)}s)`}
        </Typography>
      </Button>
    </Stack>
  )
}

export default GameSetup
