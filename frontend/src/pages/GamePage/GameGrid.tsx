// src/components/GameGrid.tsx

import { Box } from "@mui/material"
import { PlayerInfo, Square } from "@shared/types/Game"
import React, { useLayoutEffect, useRef, useState } from "react"
import { useGameStateContext } from "../../context/GameStateContext"
import { useUser } from "../../context/UserContext"
import ClashDialog from "./ClashDialog"

// Define the Clash interface based on your existing code
interface Clash {
  players: string[]
  reason: string
}

const GameGrid: React.FC = () => {
  const {
    gameState,
    playerInfos,
    hasSubmittedMove,
    currentTurn,
    selectedSquare,
    setSelectedSquare,
  } = useGameStateContext()

  const { board, clashes } = currentTurn!
  const winners = gameState?.winners || []
  const gridSize = gameState?.boardWidth || 8 // Default to 8 if undefined
  const winningSquaresSet = new Set(
    (winners?.length && winners?.length > 0 && winners[0].winningSquares) || [],
  )
  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<PlayerInfo[]>([])

  // Handle responsive sizing
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  // Calculate cell size and font size
  const cellSize = containerWidth ? containerWidth / gridSize : 0
  const fontSize = cellSize ? Math.min(cellSize * 0.6, 48) : 16 // Set a max font size
  const user = useUser()

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

  const handleClashClick = (clash: Clash) => {
    const players = clash.players.map(
      (id) =>
        playerInfos.find((p) => p.id === id) || {
          id,
          nickname: "Unknown",
          emoji: "",
        },
    )
    setClashPlayersList(players)
    setClashReason(clash.reason)
    setOpenClashDialog(true)
  }

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    if (!currentTurn) return
    const clash = currentTurn.clashes[index.toString()]
    if (clash) {
      handleClashClick(clash)
      return
    }

    if (gameState?.started && !hasSubmittedMove) {
      const cell: Square = currentTurn.board[index]

      // Check if the current user is allowed to move into this square
      if (cell.allowedPlayers.includes(user.userID)) {
        setSelectedSquare(index)
      }
    }
  }

  const disabled = hasSubmittedMove

  return (
    <Box
      ref={gridRef}
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        border: "2px solid black",
        opacity: disabled ? 0.5 : 1, // Adjust opacity if disabled
        pointerEvents: disabled ? "none" : "auto", // Disable interactions if disabled
      }}
    >
      {board.map((cell: Square, index: number) => {
        const isSelected = selectedSquare === index
        const isBlocked = false
        const clash = clashes[index.toString()]
        const clashPlayers = clash ? clash.players : []
        const isWinningSquare = winningSquaresSet.has(index)

        // Determine if the current user can move into this square
        const canUserMoveHere = cell.allowedPlayers.includes(user.userID)

        return (
          <Box
            key={index}
            onClick={() => {
              if (disabled) return
              if (clash) {
                handleClashClick(clash)
              } else {
                handleSquareClick(index)
              }
            }}
            sx={{
              width: "100%",
              paddingBottom: "100%", // Maintain aspect ratio
              position: "relative",
              border: "1px solid black",
              cursor: disabled
                ? "default"
                : gameState?.started &&
                  !currentTurn?.hasMoved[user.userID] && // Adjust condition as needed
                  (canUserMoveHere ||
                    (!canUserMoveHere && cell.playerID === null && !isBlocked))
                ? "pointer"
                : "default",
              backgroundColor: isWinningSquare
                ? "green"
                : isSelected
                ? "#cfe8fc"
                : canUserMoveHere
                ? "lightgreen" // Highlight squares where user can move
                : isBlocked
                ? "#ddd"
                : "white",
              transition: "background-color 0.3s",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: `${fontSize}px`, // Dynamic font size
                textAlign: "center",
                padding: 1,
                userSelect: "none",
              }}
            >
              {isBlocked
                ? "❌"
                : cell.playerID
                ? playerInfos.find((p) => p.id === cell.playerID)?.emoji || "❓"
                : clashPlayers.length > 0
                ? clashPlayers
                    .map(
                      (player) =>
                        playerInfos.find((p) => p.id === player)?.emoji || "❓",
                    )
                    .join(", ")
                : ""}
            </Box>
          </Box>
        )
      })}
      {/* Clash Dialog */}
      <ClashDialog
        open={openClashDialog}
        onClose={() => setOpenClashDialog(false)}
        clashReason={clashReason}
        clashPlayersList={clashPlayersList}
      />
    </Box>
  )
}

export default GameGrid
