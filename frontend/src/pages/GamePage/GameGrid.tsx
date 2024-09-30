// src/components/GameGrid.tsx

import React, { useLayoutEffect, useRef, useState } from "react"
import { Box } from "@mui/material"
import { Clash, PlayerInfo } from "@shared/types/Game"
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

  const user = useUser()
  const winners = gameState?.winners || []
  const gridWidth = gameState?.boardWidth || 8
  const gridHeight = gameState?.boardHeight || 8
  const totalCells = gridWidth * gridHeight
  const winningSquaresSet = new Set(
    winners.flatMap((winner) => winner.winningSquares),
  )

  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<PlayerInfo[]>([])

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
  }, [gridWidth, currentTurn])

  // Generate maps for cell content, background, allowed moves, and clashes
  const cellContentMap: { [index: number]: JSX.Element } = {}
  const cellBackgroundMap: { [index: number]: string } = {}
  const cellAllowedMoveMap: { [index: number]: boolean } = {}
  const clashesAtPosition: { [index: number]: Clash } = {}
  const latestMovePositionsSet: Set<number> = new Set()

  if (currentTurn && gameState) {
    const { gameType, moves, playerPieces, allowedMoves, clashes } = currentTurn

    // Map clashes to positions
    if (clashes) {
      clashes.forEach((clash) => {
        clashesAtPosition[clash.index] = clash
      })
    }

    // Map allowed moves for the user
    const userAllowedMoves = allowedMoves[user.userID] || []
    userAllowedMoves.forEach((position) => {
      cellAllowedMoveMap[position] = true
    })

    // Extract the latest move positions
    if (moves) {
      Object.values(moves).forEach((position) => {
        latestMovePositionsSet.add(position)
      })
    }

    if (gameType === "snek") {
      // Snek-specific rendering
      const { food, hazards, walls } = currentTurn

      const cellSnakeSegments: {
        [position: number]: {
          playerID: string
          isHead: boolean
          arrowEmoji: string
          count: number
        }
      } = {}

      const getArrowEmoji = (
        prevPos: number,
        currPos: number,
        nextPos: number | null,
      ): string => {
        const getDelta = (from: number, to: number) => {
          const x1 = from % gridWidth
          const y1 = Math.floor(from / gridWidth)
          const x2 = to % gridWidth
          const y2 = Math.floor(to / gridWidth)
          return { dx: x2 - x1, dy: y2 - y1 }
        }

        const { dx: dx1, dy: dy1 } = getDelta(prevPos, currPos)
        let dx2 = 0
        let dy2 = 0
        if (nextPos !== null) {
          const delta = getDelta(currPos, nextPos)
          dx2 = delta.dx
          dy2 = delta.dy
        }

        const dx = dx1 + dx2
        const dy = dy1 + dy2

        const directionKey = `${dx},${dy}`
        const arrowMap: { [key: string]: string } = {
          "0,-2": "⬆️",
          "0,2": "⬇️",
          "-2,0": "⬅️",
          "2,0": "➡️",
          "1,-1": "↗️",
          "1,1": "↘️",
          "-1,-1": "↖️",
          "-1,1": "↙️",
          "0,0": "",
        }

        return arrowMap[directionKey] || ""
      }

      // Collect snake segments
      Object.keys(playerPieces).forEach((playerID) => {
        const positions = playerPieces[playerID]
        const playerInfo = playerInfos.find((p) => p.id === playerID)

        positions.forEach((position, index) => {
          if (!cellSnakeSegments[position]) {
            cellSnakeSegments[position] = {
              playerID: playerID,
              isHead: index === 0,
              arrowEmoji: "",
              count: 1,
            }
          } else {
            cellSnakeSegments[position].count += 1
          }

          cellBackgroundMap[position] = playerInfo?.colour || "white"

          if (index > 0) {
            const prevPos = positions[index - 1]
            const currPos = positions[index]
            const nextPos = positions[index + 1] || null

            const emoji = getArrowEmoji(prevPos, currPos, nextPos)
            if (emoji) {
              cellSnakeSegments[position].arrowEmoji = emoji
            }
          }
        })
      })

      Object.keys(cellSnakeSegments).forEach((positionStr) => {
        const position = parseInt(positionStr)
        const segmentInfo = cellSnakeSegments[position]
        const playerInfo = playerInfos.find(
          (p) => p.id === segmentInfo.playerID,
        )

        let content: JSX.Element | null

        if (segmentInfo.isHead) {
          content = (
            <span key={`head-${position}`} style={{ fontSize }}>
              {playerInfo?.emoji || "⭕"}
            </span>
          )
        } else if (segmentInfo.arrowEmoji) {
          content = (
            <span key={`body-${position}`} style={{ fontSize }}>
              {segmentInfo.arrowEmoji}
            </span>
          )
        } else {
          content = (
            <span key={`body-${position}`} style={{ fontSize }}>
              🍑
            </span>
          )
        }

        if (segmentInfo.count > 1) {
          const count = segmentInfo.count
          content = (
            <Box key={`body-${position}`} sx={{ position: "relative" }}>
              {content}
              <span
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  fontSize: fontSize * 0.5,
                  color: "black",
                }}
              >
                {count}
              </span>
            </Box>
          )
        }

        cellContentMap[position] = content
      })

      // Place food
      food?.forEach((position) => {
        cellContentMap[position] = (
          <span key={`food-${position}`} style={{ fontSize }}>
            🍎
          </span>
        )
      })

      // Place walls
      walls?.forEach((position) => {
        cellContentMap[position] = (
          <span key={`wall-${position}`} style={{ fontSize }}>
            🧱
          </span>
        )
        cellBackgroundMap[position] = "#8B4513" // Brown color for walls
      })

      // Place hazards
      hazards?.forEach((position) => {
        cellContentMap[position] = (
          <span key={`hazard-${position}`} style={{ fontSize }}>
            ☠️
          </span>
        )
      })

      // Place clashes
      clashes?.forEach((clash) => {
        const position = clash.index
        cellContentMap[position] = (
          <span key={`clash-${position}`} style={{ fontSize }}>
            💀
          </span>
        )
        cellBackgroundMap[position] = "#d3d3d3" // light gray
      })
    } else {
      // Other game modes

      // Place player pieces
      Object.keys(playerPieces).forEach((playerID) => {
        const positions = playerPieces[playerID]
        const playerInfo = playerInfos.find((p) => p.id === playerID)

        positions.forEach((position) => {
          cellContentMap[position] = (
            <span key={`piece-${position}`} style={{ fontSize }}>
              {playerInfo?.emoji || "⭕"}
            </span>
          )

          cellBackgroundMap[position] = playerInfo?.colour || "white"
        })
      })

      // Place clashes
      clashes?.forEach((clash) => {
        const position = clash.index
        cellContentMap[position] = (
          <span key={`clash-${position}`} style={{ fontSize }}>
            💥
          </span>
        )
        cellBackgroundMap[position] = "#d3d3d3" // light gray
      })
    }
  }

  const handleSquareClick = (index: number) => {
    if (!currentTurn || !gameState) return

    if (gameState.started && !hasSubmittedMove) {
      const allowedMoves = currentTurn.allowedMoves[user.userID] || []
      if (allowedMoves.includes(index)) {
        setSelectedSquare(index)
      }
    }

    const clash = clashesAtPosition[index]
    if (clash) {
      const playersInvolved = clash.playerIDs
        .map((id) => playerInfos.find((p) => p.id === id))
        .filter((p): p is PlayerInfo => !!p)

      setClashReason(clash.reason)
      setClashPlayersList(playersInvolved)
      setOpenClashDialog(true)
    }
  }

  const disabled = hasSubmittedMove

  return (
    <>
      <Box
        ref={gridRef}
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
          border: "2px solid black",
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        {Array.from({ length: totalCells }).map((_, index) => {
          const isSelected = selectedSquare === index
          const isWinningSquare = winningSquaresSet.has(index)
          const isLatestMove = latestMovePositionsSet.has(index)

          const cellContent = cellContentMap[index] || null

          let backgroundColor = cellBackgroundMap[index] || "white"
          if (isWinningSquare) {
            backgroundColor = "green"
          }

          const isAllowedMove = cellAllowedMoveMap[index] || false

          return (
            <Box
              key={index}
              onClick={() => {
                if (disabled) return
                handleSquareClick(index)
              }}
              sx={{
                width: "100%",
                paddingBottom: "100%",
                position: "relative",
                border: "1px solid black",
                cursor: disabled ? "default" : "pointer",
                backgroundColor: backgroundColor,
                transition: "background-color 0.3s",
                boxSizing: "border-box",
              }}
            >
              {isAllowedMove && (
                <Box
                  sx={{
                    position: "absolute",
                    top: "1px",
                    left: "1px",
                    right: "1px",
                    bottom: "1px",
                    border: `2px ${isSelected ? "solid" : "dotted"} green`,
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}
              {isLatestMove && (
                <Box
                  sx={{
                    position: "absolute",
                    top: "1px",
                    left: "1px",
                    right: "1px",
                    bottom: "1px",
                    border: `2px solid yellow`,
                    pointerEvents: "none",
                    zIndex: 3,
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
                  fontSize: `${fontSize}px`,
                  textAlign: "center",
                  padding: 1,
                  userSelect: "none",
                  zIndex: 1,
                }}
              >
                {cellContent}
              </Box>
            </Box>
          )
        })}
      </Box>
      <ClashDialog
        open={openClashDialog}
        onClose={() => setOpenClashDialog(false)}
        clashReason={clashReason}
        clashPlayersList={clashPlayersList}
      />
    </>
  )
}

export default GameGrid
