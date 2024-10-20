// src/pages/GamePage/components/GameSetup.tsx

import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore"
import React, { useEffect, useState } from "react"
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
  Typography,
} from "@mui/material"
import { GamePlayer, GameType } from "@shared/types/Game"
import { useGameStateContext } from "../../context/GameStateContext"
import { getRulesComponent } from "./RulesDialog"

// Define the board size mapping
const BOARD_SIZE_MAPPING = {
  small: { width: 11, height: 11 },
  medium: { width: 13, height: 13 },
  large: { width: 17, height: 17 },
}

type BoardSize = keyof typeof BOARD_SIZE_MAPPING

const GameSetup: React.FC = () => {
  const { userID, colour } = useUser()
  const {
    gameSetup,
    players,
    bots,
    gameType,
    setGameType,
    sessionName,
    gameID,
    gameState,
  } = useGameStateContext()

  const [secondsPerTurn, setSecondsPerTurn] = useState<string>("10")
  const [RulesComponent, setRulesComponent] = useState<React.FC | null>(null)
  const [boardSize, setBoardSize] = useState<BoardSize>("medium")

  const gameDocRef = doc(db, "sessions", sessionName, "setups", gameID)

  // Inject the shake animation styles once the component mounts
  React.useEffect(() => {
    addStyles()
  }, [])

  // Update local state when gameSetup changes
  useEffect(() => {
    if (gameSetup) {
      const currentSize = Object.entries(BOARD_SIZE_MAPPING).find(
        ([_, dimensions]) =>
          dimensions.width === gameSetup.boardWidth &&
          dimensions.height === gameSetup.boardHeight,
      )
      if (currentSize) {
        setBoardSize(currentSize[0] as BoardSize)
      }
      if (gameSetup.gameType) setGameType(gameSetup.gameType)
      setSecondsPerTurn(`${gameSetup.maxTurnTime}`)
    }
  }, [gameSetup])

  // Start game
  const handleReady = async () => {
    await updateDoc(gameDocRef, {
      playersReady: arrayUnion(userID),
    })
  }

  const handleAddBot = async (botID: string) => {
    const bot: GamePlayer = {
      id: botID,
      type: "bot",
    }

    await updateDoc(gameDocRef, {
      gamePlayers: arrayUnion(bot),
    })
  }

  // Start game
  const handleStart = async () => {
    await updateDoc(gameDocRef, {
      startRequested: true,
    })
  }

  // Kick a player by removing their playerID from the playerIDs field
  const handleKick = async (playerID: string, type: "bot" | "human") => {
    const player: GamePlayer = {
      id: playerID,
      type: type,
    }
    await updateDoc(gameDocRef, {
      gamePlayers: arrayRemove(player),
    })
  }

  // Handler for selecting game type
  const handleGameTypeChange = async (event: SelectChangeEvent<GameType>) => {
    const selectedGameType = event.target.value as GameType
    setGameType(selectedGameType)

    // Update Firestore when game type is selected
    if (!gameSetup?.started) {
      await updateDoc(gameDocRef, { gameType: selectedGameType })
    }
  }

  // Handler for selecting board size
  const handleBoardSizeChange = async (event: SelectChangeEvent<BoardSize>) => {
    const selectedBoardSize = event.target.value as BoardSize
    setBoardSize(selectedBoardSize)

    const { width, height } = BOARD_SIZE_MAPPING[selectedBoardSize]

    // Update Firestore when board size is selected
    if (!gameSetup?.started) {
      await updateDoc(gameDocRef, {
        boardWidth: width,
        boardHeight: height,
      })
    }
  }

  useEffect(() => {
    setRulesComponent(() => getRulesComponent(gameSetup?.gameType))
  }, [gameSetup?.gameType])

  if (gameState || !gameSetup) return null

  const { started, playersReady } = gameSetup
  const notReadyPlayers = gameSetup.gamePlayers
    .filter((gamePlayer) => gamePlayer.type === "human")
    .filter((player) => !gameSetup.playersReady.includes(player.id))
    .map(
      (notReadyPlayer) =>
        players.find((player) => player.id === notReadyPlayer.id)?.name,
    )

  return (
    <Stack spacing={2} pt={2}>
      {/* Ready Section */}
      {!gameSetup.gamePlayers
        .filter((gamePlayer) => gamePlayer.type === "human")
        .map((human) => human.id)
        .every((player) => gameSetup.playersReady.includes(player)) ? (
        <Button
          disabled={
            started ||
            gameSetup.boardWidth < 5 ||
            gameSetup.boardWidth > 20 ||
            parseInt(secondsPerTurn) <= 0 ||
            gameSetup.playersReady.includes(userID)
          }
          onClick={handleReady}
          sx={{ backgroundColor: colour, height: "70px", fontSize: "32px" }}
          fullWidth
        >
          {gameSetup.playersReady.includes(userID) ? `Waiting` : "Ready?"}
        </Button>
      ) : (
        <Button
          disabled={gameSetup.startRequested}
          onClick={handleStart}
          sx={{ backgroundColor: colour, height: "70px", fontSize: "32px" }}
          className="shake"
          fullWidth
        >
          Start game
        </Button>
      )}
      {gameSetup.playersReady.includes(userID) &&
        notReadyPlayers.length > 0 && (
          <Typography color="error">
            Not ready: {notReadyPlayers.join(", ")}
          </Typography>
        )}
      <Box sx={{ display: "flex", gap: 2 }}>
        {/* Game Type Dropdown */}
        <FormControl variant="outlined" sx={{ flex: 1 }}>
          <InputLabel id="game-type-label">Game Type</InputLabel>
          <Select
            labelId="game-type-label"
            value={gameType}
            onChange={handleGameTypeChange}
            disabled={started}
            label="Game Type"
          >
            <MenuItem value="snek">Snek</MenuItem>
            <MenuItem value="connect4">Connect 4</MenuItem>
            <MenuItem value="tactictoes">Tactic Toes</MenuItem>
            <MenuItem value="longboi">Long Boi</MenuItem>
            <MenuItem value="reversi">Othello</MenuItem>
            <MenuItem value="colourclash">Colour Clash</MenuItem>
          </Select>
        </FormControl>

        {/* Game Size */}
        <FormControl variant="outlined" sx={{ flex: 1 }}>
          <InputLabel id="board-size-label">Size</InputLabel>
          <Select
            labelId="board-size-label"
            value={boardSize}
            onChange={handleBoardSizeChange}
            disabled={started}
            label="Board Size"
          >
            <MenuItem value="small">Small</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="large">Large</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Game rules */}
      <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
        <InputLabel shrink sx={{ backgroundColor: "white", px: 1 }}>
          Rules
        </InputLabel>
        <Box
          sx={{
            border: "2px solid black",
            padding: 2,
            borderRadius: "0px",
            minHeight: "56px",
            display: "flex",
            alignItems: "start",
            flexDirection: "column",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {RulesComponent && <RulesComponent />}
        </Box>
      </FormControl>
      {/* Bots List */}
      {bots.length > 0 && (
        <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
          <InputLabel shrink sx={{ backgroundColor: "white", px: 1 }}>
            Available Bots
          </InputLabel>
          <Box
            sx={{
              border: "2px solid black",
              padding: 2,
              borderRadius: "0px",
              minHeight: "56px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {bots.map((bot) => (
                <Button
                  key={bot.name}
                  sx={{
                    backgroundColor: bot.colour,
                  }}
                  onClick={() => handleAddBot(bot.id)}
                >
                  {bot.emoji} {bot.name}
                </Button>
              ))}
            </Box>
          </Box>
        </FormControl>
      )}

      {/* Players Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell>
              <TableCell align="right">Ready</TableCell>
              <TableCell align="right">Remove?</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gameSetup.gamePlayers.map((gamePlayer) => {
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
                    onClick={() => handleKick(player.id, gamePlayer.type)}
                  >
                    ❌
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

// Function to insert keyframe and class rules separately
const addStyles = () => {
  const styleSheet = document.styleSheets[0]

  // Insert the keyframes animation
  styleSheet.insertRule(
    `
    @keyframes shake {
      0% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      50% { transform: translateX(5px); }
      75% { transform: translateX(-5px); }
      100% { transform: translateX(0); }
    }
  `,
    styleSheet.cssRules.length,
  )

  // Insert the shake class rule with infinite iterations
  styleSheet.insertRule(
    `
    .shake {
      animation: shake 0.5s ease infinite;
    }
  `,
    styleSheet.cssRules.length,
  )
}
