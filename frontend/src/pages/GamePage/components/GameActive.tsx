import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import React, { useLayoutEffect, useRef, useState } from "react"
import { useUser } from "../../../context/UserContext"
import { db } from "../../../firebaseConfig"

import { ArrowBack, ArrowForward, LastPage } from "@mui/icons-material"
import {
  Alert,
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"

import { useGameStateContext } from "../../../context/GameStateContext"
import GameGrid from "../components/GameGrid"
import ClashDialog from "./ClashDialog"

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
  } = useGameStateContext()

  const [selectedSquare, setSelectedSquare] = useState<number | null>(null)
  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)

  // New ref and state for dynamic font sizing
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  // Handle dynamic container width
  useLayoutEffect(() => {
    const updateContainerWidth = () => {
      if (gridRef.current) {
        setContainerWidth(gridRef.current.offsetWidth)
      }
    }

    updateContainerWidth() // Initial measurement

    window.addEventListener("resize", updateContainerWidth)
    return () => {
      window.removeEventListener("resize", updateContainerWidth)
    }
  }, [gameState?.boardWidth, currentTurn])

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    if (!currentTurn) return
    const clash = currentTurn.clashes[index.toString()]
    if (clash) {
      handleClashClick(clash)
      return
    }

    if (gameState?.started && !hasSubmittedMove) {
      const cellValue = currentTurn.board[index]

      if (cellValue === "" || cellValue === null) {
        setSelectedSquare(index)
      }
    }
  }

  // Handle clash click
  const handleClashClick = (clash: { players: string[]; reason: string }) => {
    // const players = clash.players.map(
    //   (id) =>
    //     playerInfos.find((p) => p.id === id) || {
    //       id,
    //       nickname: "Unknown",
    //       emoji: "",
    //     },
    // )
    // setClashPlayersList(players)
    // setClashReason(clash.reason)
    // setOpenClashDialog(true)
  }

  // Submit a move
  const handleMoveSubmit = async () => {
    if (!currentTurn) return

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

  if (!gameState) return

  const { winner } = gameState

  const playerInCurrentGame = gameState.playerIDs.includes(userID)
  const winnerInfo = playerInfos.find((p) => p.id === winner)
  const winnerEmoji = winnerInfo?.emoji || ""

  if (!gameState.started || !currentTurn) return
  return (
    <Box>
      <>
        {/* Alert if player joined late */}
        {!playerInCurrentGame && (
          <Alert sx={{ mt: 2 }} severity="warning">
            This game started before you joined. Watch until the next game
            starts.
          </Alert>
        )}
        <>
          <Button
            disabled={
              hasSubmittedMove ||
              !!currentTurn?.hasMoved[userID] ||
              !playerInCurrentGame ||
              !(
                selectedSquare !== null &&
                currentTurn?.board[selectedSquare] === "" &&
                turns.length === currentTurn?.turnNumber
              )
            }
            color="primary"
            onClick={handleMoveSubmit}
            sx={{ my: 2 }}
            fullWidth
          >
            Submit Move ({Math.max(0, timeRemaining).toFixed(1)}s left)
          </Button>
        </>
        ){/* Game Grid */}
        <GameGrid
          currentTurn={currentTurn}
          playerInfos={playerInfos}
          gameState={gameState}
          selectedSquare={selectedSquare}
          onSquareClick={handleSquareClick}
          containerWidth={containerWidth}
          disabled={hasSubmittedMove}
        />
        {/* Navigation controls */}
        <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
          <IconButton onClick={handlePrevTurn} disabled={currentTurnIndex <= 0}>
            <ArrowBack />
          </IconButton>
          <Typography variant="body2" sx={{ marginX: 2 }}>
            Viewing Turn {currentTurn ? currentTurn.turnNumber : "Loading..."}{" "}
            of {turns.length}
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
      </>

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
    </Box>
  )
}

export default GameActive
