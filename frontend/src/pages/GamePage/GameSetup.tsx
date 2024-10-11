// src/pages/GamePage/components/GameSetup.tsx

import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore"
import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useUser } from "../../context/UserContext"
import { db } from "../../firebaseConfig"

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
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
import { GamePlayer, GameType } from "@shared/types/Game"
import { getRulesComponent } from "./RulesDialog"

const GameSetup: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()
  const { userID } = useUser()
  const { gameState, players, bots, gameType, setGameType } =
    useGameStateContext()

  const [boardWidth, setBoardWidth] = useState<string>("8")
  const [boardHeight, setBoardHeight] = useState<string>("8")
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

  const handleAddBot = async (botID: string) => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      const bot: GamePlayer = {
        id: botID,
        type: "bot",
      }
      await updateDoc(gameDocRef, {
        gamePlayers: arrayUnion(bot), // Add the current userID to playersReady array
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
  const handleKick = async (playerID: string, type: "bot" | "human") => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      const player: GamePlayer = {
        id: playerID,
        type: type,
      }
      await updateDoc(gameDocRef, {
        gamePlayers: arrayRemove(player), // Remove the specified playerID from playerIDs array
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
      <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
        <InputLabel shrink sx={{ backgroundColor: "white", px: 1 }}>
          Rules
        </InputLabel>
        <Box
          sx={{
            border: "1px solid black",
            padding: 2,
            borderRadius: "0px",
            minHeight: "56px", // Similar height to a TextField
            display: "flex",
            alignItems: "start",
            flexDirection: "column",
            fontFamily: "monospace", // Ensure consistent text formatting
            whiteSpace: "pre-wrap", // Maintain whitespace and line breaks
          }}
        >
          {RulesComponent && <RulesComponent />}
        </Box>
      </FormControl>
      {/* Bots List */}
      {bots.length > 0 && (
        <Paper
          sx={{
            border: "1px solid #000", // Black border
            borderRadius: 0, // Square edges
            boxShadow: "none", // Remove shadow
            padding: "16px", // Consistent padding
          }}
        >
          <Typography variant="body2" sx={{ mb: 2 }}>
            Available Bots
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {bots.map((bot) => (
              <Button
                key={bot.name}
                variant="contained"
                sx={{
                  backgroundColor: bot.colour,
                  color: "#fff",
                }}
                onClick={() => handleAddBot(bot.id)}
              >
                {bot.emoji} {bot.name}
              </Button>
            ))}
          </Box>
        </Paper>
      )}
      {/* Ready Section */}
      {!gameState.gamePlayers
        .filter((gamePlayer) => gamePlayer.type === "human")
        .map((human) => human.id)
        .every((player) => gameState.playersReady.includes(player)) ? (
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
            {gameState.gamePlayers.map((gamePlayer) => {
              const player = players.find(
                (player) => player.id === gamePlayer.id,
              )
              if (!player) return null
              return (
                <TableRow key={player.id}>
                  <TableCell sx={{ backgroundColor: player.colour }}>
                    {player.name} {player.emoji}
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
                      onClick={() => handleKick(player.id, gamePlayer.type)}
                      sx={{ height: 20 }}
                    >
                      Kick?
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

export default GameSetup
