import { Box } from "@mui/material"
import { PlayerInfo } from "@shared/types/Game"
import React, { useLayoutEffect, useRef, useState } from "react"
import { useGameStateContext } from "../../../context/GameStateContext"
import { useUser } from "../../../context/UserContext"
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

  const { board, clashes, winningSquares } = currentTurn!
  const gridSize = gameState?.boardWidth || 8 // Default to 8 if undefined
  const winningSquaresSet = new Set(winningSquares || [])
  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<PlayerInfo[]>([])
  //   handle size
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
      const cellValue = currentTurn.board[index]

      if (cellValue === "" || cellValue === null) {
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
      {board.map((cell, index) => {
        const isSelected = selectedSquare === index
        const isCellEmpty = cell === ""
        const isBlocked = cell === "-1"
        const clash = clashes[index.toString()]
        const clashPlayers = clash ? clash.players : []
        const isWinningSquare = winningSquaresSet.has(index)

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
                  isCellEmpty &&
                  !isBlocked
                ? "pointer"
                : "default",
              backgroundColor: isWinningSquare
                ? "green"
                : isSelected
                ? "#cfe8fc"
                : isBlocked
                ? "#ddd"
                : "white",
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
              }}
            >
              {isBlocked
                ? "❌"
                : cell
                ? playerInfos.find((p) => p.id === cell)?.emoji || cell[0]
                : clashPlayers.length > 0
                ? clashPlayers
                    .map(
                      (playerID) =>
                        playerInfos.find((p) => p.id === playerID)?.emoji || "",
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
