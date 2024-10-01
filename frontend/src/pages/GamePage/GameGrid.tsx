import React, { useLayoutEffect, useRef, useState } from "react"
import { Box } from "@mui/material"
import { Clash, PlayerInfo } from "@shared/types/Game"
import { useGameStateContext } from "../../context/GameStateContext"
import { useUser } from "../../context/UserContext"
import ClashDialog from "./ClashDialog"

const BORDER_WIDTH = 6 // Adjust as needed (in pixels)
const BORDER_COLOR = "white"
const CORNER_BORDER_COLOR = "white" // Adjust if different colors are needed
const TAIL_EXTRA_BORDER_COLOR = "white" // Color for the extra tail border

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
          isTail: boolean
          transitionStyles: React.CSSProperties
          count: number
          direction: "vertical" | "horizontal" | "corner"
        }
      } = {}

      // Function to get previous and next movement deltas
      const getSegmentStyles = (
        playerInfo: PlayerInfo | undefined,
        prevPos: number | null,
        currPos: number,
        nextPos: number | null,
      ): {
        styles: React.CSSProperties
        direction: "vertical" | "horizontal" | "corner"
      } => {
        const getDelta = (from: number, to: number) => {
          const x1 = from % gridWidth
          const y1 = Math.floor(from / gridWidth)
          const x2 = to % gridWidth
          const y2 = Math.floor(to / gridWidth)
          return { dx: x2 - x1, dy: y2 - y1 }
        }

        const prevDelta = prevPos
          ? getDelta(prevPos, currPos)
          : { dx: 0, dy: 0 }
        const nextDelta = nextPos
          ? getDelta(currPos, nextPos)
          : { dx: 0, dy: 0 }

        let direction: "vertical" | "horizontal" | "corner" = "horizontal"

        // Determine movement direction
        if (prevDelta.dy !== 0 || nextDelta.dy !== 0) {
          direction = "vertical"
        }
        if (prevDelta.dx !== 0 || nextDelta.dx !== 0) {
          direction = "horizontal"
        }

        // If both dx and dy are non-zero, it's a corner
        if (
          (prevDelta.dx !== 0 || nextDelta.dx !== 0) &&
          (prevDelta.dy !== 0 || nextDelta.dy !== 0)
        ) {
          direction = "corner"
        }

        const styles: React.CSSProperties = {
          boxSizing: "border-box",
          borderTop: "0",
          borderBottom: "0",
          borderLeft: "0",
          borderRight: "0",
          backgroundColor: playerInfo?.colour || "white",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }

        if (direction === "vertical") {
          // Apply left and right borders for vertical movement
          styles.borderLeft = `${BORDER_WIDTH}px solid ${BORDER_COLOR}`
          styles.borderRight = `${BORDER_WIDTH}px solid ${BORDER_COLOR}`
        } else if (direction === "horizontal") {
          // Apply top and bottom borders for horizontal movement
          styles.borderTop = `${BORDER_WIDTH}px solid ${BORDER_COLOR}`
          styles.borderBottom = `${BORDER_WIDTH}px solid ${BORDER_COLOR}`
        } else if (direction === "corner") {
          // Apply two borders for corner transitions
          // Determine which two borders based on movement

          // Determine based on deltas
          if (
            (prevDelta.dx === 1 && nextDelta.dy === 1) || // Moving right then down
            (nextDelta.dx === -1 && prevDelta.dy === -1) // left then down
          ) {
            styles.borderRight = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
            styles.borderTop = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
          }

          if (
            prevDelta.dy === 1 &&
            nextDelta.dx === 1 // Moving down then right
          ) {
            styles.borderLeft = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
            styles.borderBottom = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
          }

          if (
            prevDelta.dx === -1 &&
            nextDelta.dy === 1 // Moving left then down
          ) {
            styles.borderLeft = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
            styles.borderTop = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
          }

          if (
            prevDelta.dy === 1 &&
            nextDelta.dx === -1 // Moving down then left
          ) {
            styles.borderRight = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
            styles.borderBottom = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
          }

          if (
            prevDelta.dx === 1 &&
            nextDelta.dy === -1 // Moving right then up
          ) {
            styles.borderRight = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
            styles.borderBottom = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
          }

          if (
            prevDelta.dy === -1 &&
            nextDelta.dx === 1 // Moving up then right
          ) {
            styles.borderLeft = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
            styles.borderTop = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
          }
          if (
            prevDelta.dx === -1 &&
            nextDelta.dy === -1 // Moving left then up
          ) {
            styles.borderLeft = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
            styles.borderBottom = `${BORDER_WIDTH}px solid ${CORNER_BORDER_COLOR}`
          }
        }

        return { styles, direction }
      }

      // Collect snake segments
      Object.keys(playerPieces).forEach((playerID) => {
        const positions = playerPieces[playerID]
        const playerInfo = playerInfos.find((p) => p.id === playerID)

        positions.forEach((position, index) => {
          const isHead = index === 0
          const isTail = index === positions.length - 1
          const prevPos = positions[index - 1] || null
          const nextPos = positions[index + 1] || null
          const { styles, direction } = getSegmentStyles(
            playerInfo,
            prevPos,
            position,
            nextPos,
          )

          if (!cellSnakeSegments[position]) {
            cellSnakeSegments[position] = {
              playerID: playerID,
              isHead,
              isTail,
              transitionStyles: {
                ...styles,
                backgroundColor: playerInfo?.colour || "white",
              },
              count: 1,
              direction,
            }
          } else {
            // Increment count if this is the tail and stacked
            if (!cellSnakeSegments[position].isTail) {
              cellSnakeSegments[position].count += 1
            }
          }

          cellBackgroundMap[position] = playerInfo?.colour || "white"
        })
      })

      Object.keys(cellSnakeSegments).forEach((positionStr) => {
        const position = parseInt(positionStr)
        const segmentInfo = cellSnakeSegments[position]
        const playerInfo = playerInfos.find(
          (p) => p.id === segmentInfo.playerID,
        )

        let content: JSX.Element | null

        // Head logic with emoji and length display
        if (segmentInfo.isHead) {
          const snakeLength = playerPieces[segmentInfo.playerID].length
          content = (
            <Box
              key={`head-${position}`}
              sx={{ position: "relative", width: "100%", height: "100%" }}
            >
              <span style={{ fontSize }}>{playerInfo?.emoji || "⭕"}</span>
              {snakeLength > 1 && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    fontSize: fontSize * 0.5,
                    color: "black",
                  }}
                >
                  {snakeLength}
                </span>
              )}
            </Box>
          )
        } else {
          // Body segment with borders indicating direction
          content = (
            <Box
              key={`body-${position}`}
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                ...segmentInfo.transitionStyles,
              }}
            />
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
    console.log(index)

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
          boxSizing: "border-box",
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
                paddingBottom: "100%", // Maintain square aspect ratio
                position: "relative",
                border: "1px solid black",
                cursor: disabled ? "default" : "pointer",
                backgroundColor: backgroundColor,
                transition: "background-color 0.3s",
                boxSizing: "border-box",
              }}
            >
              {/* Allowed Move Indicator */}
              {isAllowedMove && (
                <Box
                  sx={{
                    position: "absolute",
                    top: BORDER_WIDTH,
                    left: BORDER_WIDTH,
                    right: BORDER_WIDTH,
                    bottom: BORDER_WIDTH,
                    border: `2px ${isSelected ? "solid" : "dotted"} green`,
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}

              {/* Latest Move Indicator */}
              {isLatestMove && (
                <Box
                  sx={{
                    position: "absolute",
                    top: BORDER_WIDTH,
                    left: BORDER_WIDTH,
                    right: BORDER_WIDTH,
                    bottom: BORDER_WIDTH,
                    border: `2px solid yellow`,
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                />
              )}

              {/* Cell Content */}
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

      {/* Clash Dialog */}
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
