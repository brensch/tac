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
  TextField,
  Typography,
} from "@mui/material"
import { GamePlayer, GameType } from "@shared/types/Game"
import { useGameStateContext } from "../../context/GameStateContext"
import { getRulesComponent } from "./RulesDialog"

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

  const [boardWidth, setBoardWidth] = useState<string>("8")
  const [boardHeight, setBoardHeight] = useState<string>("8")
  const [secondsPerTurn, setSecondsPerTurn] = useState<string>("10")
  const [RulesComponent, setRulesComponent] = useState<React.FC | null>(null)

  const gameDocRef = doc(db, "sessions", sessionName, "setups", gameID)
  // Inject the shake animation styles once the component mounts
  React.useEffect(() => {
    addStyles()
  }, [])

  // Update local state when gameSetup changes
  useEffect(() => {
    if (gameSetup) {
      setBoardWidth(`${gameSetup.boardWidth}`)
      setBoardHeight(`${gameSetup.boardHeight}`)
      if (gameSetup.gameType) setGameType(gameSetup.gameType)
      setSecondsPerTurn(`${gameSetup.maxTurnTime}`)
    }
  }, [gameSetup])

  // Start game
  const handleReady = async () => {
    await updateDoc(gameDocRef, {
      playersReady: arrayUnion(userID), // Add the current userID to playersReady array
    })
  }

  const handleAddBot = async (botID: string) => {
    const bot: GamePlayer = {
      id: botID,
      type: "bot",
    }

    console.log(bot)
    await updateDoc(gameDocRef, {
      gamePlayers: arrayUnion(bot), // Add the current userID to playersReady array
    })
  }

  // Start game
  const handleStart = async () => {
    await updateDoc(gameDocRef, {
      startRequested: true, // Add the current userID to playersReady array
    })
  }

  // Kick a player by removing their playerID from the playerIDs field
  const handleKick = async (playerID: string, type: "bot" | "human") => {
    const player: GamePlayer = {
      id: playerID,
      type: type,
    }
    await updateDoc(gameDocRef, {
      gamePlayers: arrayRemove(player), // Remove the specified playerID from playerIDs array
    })
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
    if (!gameSetup?.started) {
      const newBoardWidth = parseInt(boardWidth, 10)

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
    if (!gameSetup?.started) {
      const newBoardHeight = parseInt(boardHeight, 10)

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
    if (!gameSetup?.started) {
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
    if (!gameSetup?.started) {
      const newMaxTurnTime = parseInt(secondsPerTurn, 10)

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
    setRulesComponent(() => getRulesComponent(gameSetup?.gameType))
  }, [gameSetup?.gameType])

  if (gameState || !gameSetup) return null

  const { started, playersReady } = gameSetup

  console.log(bots)
  console.log(gameSetup.playersReady)

  return (
    <Stack spacing={2} pt={2}>
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
        {gameSetup.boardWidth < 5 && (
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
        <FormControl fullWidth variant="outlined" sx={{ mt: 2 }}>
          <InputLabel shrink sx={{ backgroundColor: "white", px: 1 }}>
            Available Bots
          </InputLabel>
          <Box
            sx={{
              border: "1px solid black",
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
          sx={{ backgroundColor: colour }}
          fullWidth
        >
          <Typography variant="body2">
            {gameSetup.playersReady.includes(userID)
              ? `Waiting for others`
              : "Ready?"}
          </Typography>
        </Button>
      ) : (
        <Button
          disabled={gameSetup.startRequested}
          onClick={handleStart}
          sx={{ backgroundColor: colour }}
          className="shake"
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
