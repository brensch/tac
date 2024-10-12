// src/components/GameActive.tsx

import { Timestamp } from "firebase/firestore"
import React, { useState } from "react"
import { useUser } from "../../context/UserContext"

import { ArrowBack, ArrowForward, LastPage } from "@mui/icons-material"
import {
  Alert,
  Box,
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
import UserRulesAccept from "./UserRuleAccept"

const GameActive: React.FC = () => {
  const { userID } = useUser()
  const {
    gameState,
    players,
    turns,
    currentTurn,
    currentTurnIndex,
    handleLatestTurn,
    handleNextTurn,
    handlePrevTurn,
    timeRemaining,
    selectedSquare,
    latestTurn,
  } = useGameStateContext()

  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(true) // Show rules dialog initially
  const [isRulesAccepted, setIsRulesAccepted] = useState(false) // Track if rules have been accepted

  const handleRulesAccepted = () => {
    setIsRulesAccepted(true)
    setIsRulesDialogOpen(false)
  }

  if (!gameState) return null

  const playerInCurrentGame = gameState.gamePlayers.find(
    (player) => player.id === userID,
  )

  if (!gameState.started || !currentTurn) return null

  return (
    <Stack spacing={2} pt={2}>
      {/* Rules Dialog - Only shown on the first turn */}
      {latestTurn?.turnNumber === 1 &&
        !isRulesAccepted &&
        timeRemaining > 0 && (
          <UserRulesAccept
            open={isRulesDialogOpen}
            onClose={handleRulesAccepted} // Close dialog after "I understand" is checked
            rules={gameState?.gameType}
            timeRemaining={timeRemaining}
          />
        )}

      {/* Alert if player joined late */}
      {!playerInCurrentGame && (
        <Alert severity="warning">
          This game started before you joined. Watch until the next game starts.
        </Alert>
      )}

      <Typography>
        Turn {latestTurn?.turnNumber}. {Math.max(0, timeRemaining).toFixed(0)}{" "}
        seconds left.
      </Typography>

      {/* {!gameState.nextGame && (
        <Button
          disabled={
            clicked ||
            hasSubmittedMove ||
            !!currentTurn?.hasMoved[userID] ||
            !playerInCurrentGame ||
            selectedSquare === null ||
            turns.length !== currentTurn?.turnNumber ||
            (latestTurn?.allowedMoves[userID] &&
              !latestTurn?.allowedMoves[userID].includes(selectedSquare))
          }
          variant="contained"
          onClick={handleMoveSubmit}
          fullWidth
        >
          Submit Move ({Math.max(0, timeRemaining).toFixed(0)}s, round{" "}
          {latestTurn?.turnNumber})
        </Button>
      )} */}
      {latestTurn?.turnNumber == 1 && selectedSquare === null && (
        <Typography>Tap a square to submit your move.</Typography>
      )}

      {/* Game Grid */}
      {<GameGrid />}

      {/* Navigation controls */}
      <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <IconButton onClick={handlePrevTurn} disabled={currentTurnIndex <= 0}>
          <ArrowBack />
        </IconButton>
        <Typography variant="body2" sx={{ marginX: 2 }}>
          {currentTurn ? currentTurn.turnNumber : "Loading..."} of{" "}
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
              <TableCell align="right">Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {players.map((player) => {
              const moveTime = currentTurn?.hasMoved[player.id]?.moveTime

              return (
                <TableRow
                  key={player.id}
                  sx={{ backgroundColor: player.colour }}
                >
                  <TableCell>
                    {player.name} {player.emoji}
                  </TableCell>
                  <TableCell align="right">
                    {moveTime instanceof Timestamp
                      ? `${Math.round(
                          (moveTime.seconds || 0) -
                            (currentTurn.startTime instanceof Timestamp
                              ? currentTurn.startTime.seconds
                              : 0),
                        )}s`
                      : "Haven't moved"}
                  </TableCell>
                  <TableCell align="right">
                    {currentTurn.scores[player.id]}
                  </TableCell>
                </TableRow>
              )
            })}
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
              {players
                .filter(
                  (player) => !currentTurn.hasMoved[player.id], // Check if player hasn't moved
                )
                .map((player, index) => (
                  <React.Fragment key={player.id}>
                    {player.name}
                    {index < players.length - 1 && <br />}
                  </React.Fragment>
                ))}
            </Typography>
          </Box>
        )}
    </Stack>
  )
}

export default GameActive
