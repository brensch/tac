// src/components/GameGrid.tsx

import { Box } from "@mui/material"
import { PlayerInfo, Square } from "@shared/types/Game"
import React, { useLayoutEffect, useRef, useState } from "react"
import { useGameStateContext } from "../../context/GameStateContext"
import { useUser } from "../../context/UserContext"
import ClashDialog from "./ClashDialog"

const GameGrid: React.FC = () => {
  const {
    gameState,
    playerInfos,
    hasSubmittedMove,
    currentTurn,
    selectedSquare,
    setSelectedSquare,
  } = useGameStateContext()

  const { board } = currentTurn!
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

  const handleClashClick = (clash: { players: string[]; reason: string }) => {
    const players = clash.players.map(
      (id) =>
        playerInfos.find((p) => p.id === id) || {
          id,
          nickname: "Unknown",
          emoji: "",
          colour: "#000000",
        },
    )
    setClashPlayersList(players)
    setClashReason(clash.reason)
    setOpenClashDialog(true)
  }

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    if (!currentTurn) return
    const cell: Square = currentTurn.board[index]

    if (cell.clash) {
      handleClashClick(cell.clash)
      return
    }

    if (gameState?.started && !hasSubmittedMove) {
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
        const isWinningSquare = winningSquaresSet.has(index)

        // Determine if the current user can move into this square
        const canUserMoveHere = cell.allowedPlayers.includes(user.userID)

        // Get player info if the cell is occupied
        const playerInfo = cell.playerID
          ? playerInfos.find((p) => p.id === cell.playerID)
          : null

        // Determine background color
        let backgroundColor = "white"
        if (cell.wall) {
          backgroundColor = "#8B4513" // Brown color for walls
        } else if (isWinningSquare) {
          backgroundColor = "green"
        } else if (cell.playerID && playerInfo) {
          backgroundColor = playerInfo.colour
        }

        // Determine the content to display in the cell
        let cellContent = ""
        if (cell.wall) {
          cellContent = "🧱"
        } else if (cell.clash) {
          cellContent = "💥" // Explosion emoji for clashes
        } else if (cell.playerID) {
          // Display player's emoji for both head and body
          cellContent = playerInfo?.emoji || "🐍"
        } else if (cell.food) {
          cellContent = "🍎" // Food emoji
        }

        // Determine border style
        const borderStyle = "1px solid black"

        // If the square is selectable by the user, add green border inside edges
        const selectableBorder = canUserMoveHere
          ? "2px solid green"
          : borderStyle

        return (
          <Box
            key={index}
            onClick={() => {
              if (disabled) return
              handleSquareClick(index)
            }}
            sx={{
              width: "100%",
              paddingBottom: "100%", // Maintain aspect ratio
              position: "relative",
              border: borderStyle,
              cursor: disabled
                ? "default"
                : gameState?.started &&
                  !currentTurn?.hasMoved[user.userID] &&
                  (canUserMoveHere ||
                    (!canUserMoveHere && cell.playerID === null))
                ? "pointer"
                : "default",
              backgroundColor: backgroundColor,
              transition: "background-color 0.3s",
            }}
          >
            {/* Inner box for green border */}
            {canUserMoveHere && (
              <Box
                sx={{
                  position: "absolute",
                  top: "5%",
                  left: "5%",
                  right: "5%",
                  bottom: "5%",
                  border: selectableBorder,
                  pointerEvents: "none", // So the inner box doesn't capture clicks
                }}
              />
            )}
            {/* Highlight selected square with solid green border */}
            {isSelected && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: "3px solid green",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
            )}
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
                zIndex: 1, // Ensure content is above the inner border
              }}
            >
              {cellContent}
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
