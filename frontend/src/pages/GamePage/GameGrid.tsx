// src/components/GameGrid.tsx

import React, { useLayoutEffect, useRef, useState } from "react"
import { Box } from "@mui/material"
import { PlayerInfo, Turn } from "@shared/types/Game"
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

  const winners = gameState?.winners || []
  const gridWidth = gameState?.boardWidth || 8 // Default to 8 if undefined
  const gridHeight = gameState?.boardHeight || 8 // Default to 8 if undefined
  const totalCells = gridWidth * gridHeight
  const winningSquaresSet = new Set(
    (winners?.length && winners[0].winningSquares) || [],
  )
  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<PlayerInfo[]>([])
  const user = useUser()

  // Handle responsive sizing
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  // Calculate cell size and font size
  const cellSize = containerWidth ? containerWidth / gridWidth : 0
  const fontSize = cellSize ? Math.min(cellSize * 0.6, 48) : 16 // Set a max font size

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

  // Generate a map of positions to cell content
  const cellContentMap: { [index: number]: JSX.Element[] } = {}

  if (currentTurn) {
    const { snakes, food, hazards, playerIDs, grid, claimedPositions } =
      currentTurn

    // Place snakes (players' occupied positions)
    Object.keys(snakes).forEach((playerID) => {
      const positions = snakes[playerID]
      const playerInfo = playerInfos.find((p) => p.id === playerID)

      positions.forEach((position, index) => {
        if (!cellContentMap[position]) {
          cellContentMap[position] = []
        }

        const isHead = index === 0
        const content = (
          <span key={`${playerID}-${index}`} style={{ fontSize }}>
            {playerInfo?.emoji || "⭕"}
          </span>
        )
        cellContentMap[position].push(content)
      })
    })

    // Place food
    food?.forEach((position) => {
      if (!cellContentMap[position]) {
        cellContentMap[position] = []
      }
      cellContentMap[position].push(
        <span key={`food-${position}`} style={{ fontSize }}>
          🍎
        </span>,
      )
    })

    // Place hazards
    hazards?.forEach((position) => {
      if (!cellContentMap[position]) {
        cellContentMap[position] = []
      }
      cellContentMap[position].push(
        <span key={`hazard-${position}`} style={{ fontSize }}>
          ☠️
        </span>,
      )
    })

    // For Connect4 and TacticToes, use grid or claimedPositions
    if (grid) {
      Object.keys(grid).forEach((positionStr) => {
        const position = parseInt(positionStr)
        const playerID = grid[position]
        if (playerID) {
          if (!cellContentMap[position]) {
            cellContentMap[position] = []
          }
          const playerInfo = playerInfos.find((p) => p.id === playerID)
          cellContentMap[position].push(
            <span key={`grid-${position}`} style={{ fontSize }}>
              {playerInfo?.emoji || "⭕"}
            </span>,
          )
        }
      })
    } else if (claimedPositions) {
      Object.keys(claimedPositions).forEach((positionStr) => {
        const position = parseInt(positionStr)
        const playerID = claimedPositions[position]
        if (playerID) {
          if (!cellContentMap[position]) {
            cellContentMap[position] = []
          }
          const playerInfo = playerInfos.find((p) => p.id === playerID)
          cellContentMap[position].push(
            <span key={`claimed-${position}`} style={{ fontSize }}>
              {playerInfo?.emoji || "⭕"}
            </span>,
          )
        }
      })
    }
  }

  const handleSquareClick = (index: number) => {
    if (!currentTurn) return

    if (gameState?.started && !hasSubmittedMove) {
      // Determine if the current user can move into this square
      const allowedMoves = currentTurn.allowedMoves[user.userID] || []
      if (allowedMoves.includes(index)) {
        setSelectedSquare(index)
      }
    }
  }

  const disabled = hasSubmittedMove

  console.log(currentTurn)

  return (
    <Box
      ref={gridRef}
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
        width: "100%",
        maxWidth: 600,
        margin: "0 auto",
        border: "2px solid black",
        opacity: disabled ? 0.5 : 1, // Adjust opacity if disabled
        pointerEvents: disabled ? "none" : "auto", // Disable interactions if disabled
      }}
    >
      {Array.from({ length: totalCells }).map((_, index) => {
        const isSelected = selectedSquare === index
        const isWinningSquare = winningSquaresSet.has(index)

        const cellContents = cellContentMap[index] || []

        // Determine background color
        let backgroundColor = "white"
        if (isWinningSquare) {
          backgroundColor = "green"
        }

        // Determine if the square is an allowed move for the user
        const userAllowedMoves = currentTurn?.allowedMoves[user.userID] || []
        const isAllowedMove = userAllowedMoves.includes(index)

        // Highlight allowed moves
        let borderColor = "black"
        if (isAllowedMove) {
          borderColor = "blue"
        }

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
              border: `1px solid ${borderColor}`,
              cursor: disabled ? "default" : "pointer",
              backgroundColor: backgroundColor,
              transition: "background-color 0.3s",
            }}
          >
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
              {cellContents}
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
