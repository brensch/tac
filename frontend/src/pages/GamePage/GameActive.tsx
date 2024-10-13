// src/components/GameActive.tsx

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
    gameSetup,
    players,
    turns,
    selectedTurnIndex,
    handleLatestTurn,
    handleNextTurn,
    handlePrevTurn,
    timeRemaining,
    selectedSquare,
    latestMoveStatus,
  } = useGameStateContext()

  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(true) // Show rules dialog initially
  const [isRulesAccepted, setIsRulesAccepted] = useState(false) // Track if rules have been accepted

  const handleRulesAccepted = () => {
    setIsRulesAccepted(true)
    setIsRulesDialogOpen(false)
  }

  if (!gameState) return null

  const currentTurn = gameState.turns[gameState.turns.length - 1]
  console.log(currentTurn)
  const playerInCurrentGame = gameSetup?.gamePlayers.find(
    (player) => player.id === userID,
  )

  // if (!gameSetup?.started || !currentTurn) return null

  return (
    <Stack spacing={2} pt={2}>
      {/* Rules Dialog - Only shown on the first turn */}
      {gameState.turns.length === 1 &&
        !isRulesAccepted &&
        timeRemaining > 0 && (
          <UserRulesAccept
            open={isRulesDialogOpen}
            onClose={handleRulesAccepted} // Close dialog after "I understand" is checked
            rules={gameSetup?.gameType}
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
        Turn {gameState.turns.length}.{" "}
        {currentTurn.winners.length === 0
          ? `${Math.max(0, timeRemaining).toFixed(0)} seconds left.`
          : "Game over"}
      </Typography>

      {gameState.turns.length == 1 && selectedSquare === null && (
        <Typography>Tap a square to submit your move.</Typography>
      )}

      {/* Game Grid */}
      {<GameGrid />}

      {/* Navigation controls */}
      <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <IconButton onClick={handlePrevTurn} disabled={selectedTurnIndex <= 0}>
          <ArrowBack />
        </IconButton>
        <Typography variant="body2" sx={{ marginX: 2 }}>
          {currentTurn ? selectedTurnIndex + 1 : "Loading..."} of {turns.length}
        </Typography>
        <IconButton
          onClick={handleNextTurn}
          disabled={selectedTurnIndex >= turns.length - 1}
        >
          <ArrowForward />
        </IconButton>
        <IconButton
          onClick={handleLatestTurn}
          disabled={selectedTurnIndex >= turns.length - 1}
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
              <TableCell align="right">Moved</TableCell>
              <TableCell align="right">Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {players.map((player) => {
              // const moveTime = currentTurn?.hasMoved[player.id]?.moveTime

              return (
                <TableRow
                  key={player.id}
                  sx={{ backgroundColor: player.colour }}
                >
                  <TableCell>
                    {player.name} {player.emoji}
                  </TableCell>
                  <TableCell align="right">
                    {latestMoveStatus?.movedPlayerIDs.includes(player.id)
                      ? "yeah"
                      : "nah"}
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
      {latestMoveStatus &&
        latestMoveStatus.moveNumber === turns.length - 1 &&
        latestMoveStatus.movedPlayerIDs.includes(userID) && (
          <Box
            sx={{
              position: "fixed",
              top: -20,
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
              {gameSetup?.gamePlayers
                .filter(
                  (player) =>
                    !latestMoveStatus?.movedPlayerIDs?.includes(player.id), // Check if player hasn't moved
                )
                .map((gamePlayer, index) => {
                  const player = players.find(
                    (player) => gamePlayer.id === player.id,
                  )
                  return (
                    <React.Fragment key={player?.id}>
                      {player?.name}
                      {index < players.length - 1 && <br />}
                    </React.Fragment>
                  )
                })}
            </Typography>
          </Box>
        )}
    </Stack>
  )
}

export default GameActive
