import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import React, { useEffect, useState } from "react"
import { useUser } from "../../context/UserContext"
import { db } from "../../firebaseConfig"

import { ArrowBack, ArrowForward, LastPage } from "@mui/icons-material"
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"

import { useGameStateContext } from "../../context/GameStateContext"
import GameGrid from "./GameGrid"
import { Connect4Rules, LongBoiRules } from "../../constants/Rules"

const GameActive: React.FC = () => {
  const { userID } = useUser()
  const {
    gameState,
    playerInfos,
    turns,
    hasSubmittedMove,
    currentTurn,
    currentTurnIndex,
    gameID,
    handleLatestTurn,
    handleNextTurn,
    handlePrevTurn,
    timeRemaining,
    selectedSquare,
    latestTurn,
  } = useGameStateContext()
  const [RulesComponent, setRulesComponent] = useState<React.FC>(
    () => Connect4Rules,
  )
  const [clicked, setClicked] = useState(false)

  // Submit a move
  const handleMoveSubmit = async () => {
    if (!currentTurn) return
    setClicked(true)

    if (selectedSquare !== null && gameState && userID && gameID) {
      const moveRef = collection(db, `games/${gameID}/privateMoves`)
      const moveNumber = currentTurn.turnNumber

      await addDoc(moveRef, {
        gameID,
        moveNumber,
        playerID: userID,
        move: selectedSquare,
        timestamp: serverTimestamp(),
      })
    }
  }

  useEffect(() => {
    if (gameState?.gameType === "connect4") {
      setRulesComponent(() => Connect4Rules)
    } else {
      setRulesComponent(() => LongBoiRules)
    }
  }, [gameState?.gameType])

  useEffect(() => {
    setClicked(false)
  }, [latestTurn])

  if (!gameState) return

  const playerInCurrentGame = gameState.playerIDs.includes(userID)

  if (!gameState.started || !currentTurn) return
  return (
    <Stack spacing={2} pt={2}>
      {/* Alert if player joined late */}
      {!playerInCurrentGame && (
        <Alert severity="warning">
          This game started before you joined. Watch until the next game starts.
        </Alert>
      )}
      {latestTurn?.turnNumber == 1 && (
        <Box>
          <RulesComponent />
        </Box>
      )}
      {!gameState.nextGame && (
        <Button
          disabled={
            clicked ||
            hasSubmittedMove ||
            !!currentTurn?.hasMoved[userID] ||
            !playerInCurrentGame ||
            selectedSquare === null ||
            currentTurn?.board[selectedSquare] !== "" ||
            turns.length !== currentTurn?.turnNumber
          }
          variant="contained"
          onClick={handleMoveSubmit}
          fullWidth
        >
          Submit Move ({Math.max(0, timeRemaining).toFixed(1)}s left)
        </Button>
      )}
      {latestTurn?.turnNumber == 1 && selectedSquare === null && (
        <Typography>Tap a square to get started!</Typography>
      )}

      {/* Game Grid */}
      {<GameGrid />}
      {/* Navigation controls */}
      <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <IconButton onClick={handlePrevTurn} disabled={currentTurnIndex <= 0}>
          <ArrowBack />
        </IconButton>
        <Typography variant="body2" sx={{ marginX: 2 }}>
          Viewing Turn {currentTurn ? currentTurn.turnNumber : "Loading..."} of{" "}
          {turns.length}
        </Typography>
        <IconButton
          onClick={handleNextTurn}
          disabled={currentTurnIndex >= turns.length - 1}
        >
          <ArrowForward />
        </IconButton>
        <IconButton
          onClick={handleLatestTurn}
          disabled={currentTurnIndex >= turns.length - 1}
        >
          <LastPage />
        </IconButton>
      </Box>

      {/* Players Table */}
      <TableContainer sx={{ my: 2, width: "100%" }}>
        <Table size="small" sx={{ borderCollapse: "collapse" }}>
          <TableHead>
            <TableRow>
              <TableCell>Players</TableCell>
              <TableCell align="right">Time Taken</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {playerInfos.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.nickname} {player.emoji}
                </TableCell>
                <TableCell align="right">
                  {currentTurn?.hasMoved[player.id]?.moveTime
                    ? `${Math.round(
                        currentTurn.hasMoved[player.id].moveTime.seconds -
                          currentTurn.startTime.seconds,
                      )}s`
                    : "Not yet"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Waiting Overlay */}
      {currentTurn &&
        currentTurn.turnNumber === turns.length &&
        currentTurn.hasMoved[userID] && (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              bgcolor: "rgba(255, 255, 255, 0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <Typography sx={{ mx: 2, textAlign: "center" }} variant="h4">
              Waiting for
              <br />
              {playerInfos
                .filter(
                  (player) => !currentTurn.hasMoved[player.id], // Check if player hasn't moved
                )
                .map((player, index) => (
                  <React.Fragment key={player.id}>
                    {player.nickname}
                    {index < playerInfos.length - 1 && <br />}
                  </React.Fragment>
                ))}
            </Typography>
          </Box>
        )}
    </Stack>
  )
}

export default GameActive
