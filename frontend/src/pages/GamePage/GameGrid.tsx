import React, { useLayoutEffect, useRef, useState } from "react"
import { Box } from "@mui/material"
import { Clash, GamePlayer, Player } from "@shared/types/Game"
import { useGameStateContext } from "../../context/GameStateContext"
import { useUser } from "../../context/UserContext"
import ClashDialog from "./ClashDialog"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../../firebaseConfig"

const BORDER_WIDTH = 4 // Adjust as needed (in pixels)
const BORDER_COLOR = "white"
const CORNER_BORDER_COLOR = "white" // Adjust if different colors are needed

const GameGrid: React.FC = () => {
  const {
    gameState,
    gameSetup,
    players,
    hasSubmittedMove,
    currentTurn,
    selectedSquare,
    setSelectedSquare,
    gameID,
  } = useGameStateContext()

  const user = useUser()
  const winners = gameState?.winners || []
  const gridWidth = gameState?.setup.boardWidth || 8
  const gridHeight = gameState?.setup.boardHeight || 8
  const totalCells = gridWidth * gridHeight
  const winningSquaresSet = new Set(
    winners.flatMap((winner) => winner.winningSquares),
  )

  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<GamePlayer[]>([])

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

  // Submit a move
  // const handleMoveSubmit = async () => {

  // }

  // Enhanced cellSnakeSegments to track multiple players per cell
  const cellSnakeSegments: {
    [position: number]: {
      [playerID: string]: {
        hasHead: boolean
        hasTail: boolean
        count: number
        transitionStyles: React.CSSProperties
      }
    }
  } = {}

  if (currentTurn && gameState) {
    const { moves, playerPieces, allowedMoves, clashes } = currentTurn

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

    if (gameState.setup.gameType === "snek") {
      // Snek-specific rendering
      const { food, hazards, walls } = currentTurn

      // Function to get previous and next movement deltas
      const getSegmentStyles = (
        playerInfo: Player | undefined,
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
        const playerInfo = players.find((p) => p.id === playerID)

        positions.forEach((position, index) => {
          const isHead = index === 0
          const isTail = index === positions.length - 1
          const prevPos = positions[index - 1] || null
          const nextPos = positions[index + 1] || null
          const { styles } = getSegmentStyles(
            playerInfo,
            prevPos,
            position,
            nextPos,
          )

          if (!cellSnakeSegments[position]) {
            // Initialize the cell entry
            cellSnakeSegments[position] = {
              [playerID]: {
                hasHead: isHead,
                hasTail: isTail,
                count: 1,
                transitionStyles: {
                  ...styles,
                  backgroundColor: playerInfo?.colour || "white",
                },
              },
            }
          } else {
            // Initialize or update the player entry within the cell
            if (!cellSnakeSegments[position][playerID]) {
              cellSnakeSegments[position][playerID] = {
                hasHead: isHead,
                hasTail: isTail,
                count: 1,
                transitionStyles: {
                  ...styles,
                  backgroundColor: playerInfo?.colour || "white",
                },
              }
            } else {
              // Update existing player entry
              cellSnakeSegments[position][playerID].count += 1
              cellSnakeSegments[position][playerID].hasHead =
                cellSnakeSegments[position][playerID].hasHead || isHead
              cellSnakeSegments[position][playerID].hasTail =
                cellSnakeSegments[position][playerID].hasTail || isTail
              // Optionally, handle transitionStyles if multiple styles are needed
            }
          }

          // Set the background color (last one will prevail if multiple)
          cellBackgroundMap[position] = playerInfo?.colour || "white"
        })
      })

      // Render the segments
      Object.keys(cellSnakeSegments).forEach((positionStr) => {
        const position = parseInt(positionStr)
        const playersInCell = cellSnakeSegments[position]
        const playerIDs = Object.keys(playersInCell)

        // For each player in the cell, render their segment
        playerIDs.forEach((playerID) => {
          const segmentInfo = playersInCell[playerID]
          const { hasHead, hasTail, count, transitionStyles } = segmentInfo

          let content: JSX.Element | null = null

          // Determine if the head is also the tail for this player
          const isHeadAndTail = hasHead && hasTail && count === 1

          if (hasHead) {
            // Find the player who has the head in this cell
            if (
              !playerPieces[playerID] ||
              playerPieces[playerID][0] !== position
            ) {
              // This player does not have the head in this cell
              return
            }
            const playerInfo = players.find((p) => p.id === playerID)
            if (!playerInfo) {
              return // Null check
            }

            content = (
              <Box
                key={`head-${playerID}-${position}`}
                sx={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {/* Centered Emoji */}
                <span style={{ fontSize, lineHeight: 1 }}>
                  {playerInfo.emoji || "⭕"}
                </span>

                {/* Snake Length Indicator */}
                {playerPieces[playerID]?.length > 1 && (
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 2,
                      right: 2,
                      fontSize: fontSize * 0.5,
                      color: "black",
                    }}
                  >
                    {playerPieces[playerID].length}
                  </Box>
                )}

                {/* Count Indicator */}
                {count > 1 && hasTail && !isHeadAndTail && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 2,
                      left: 2,
                      fontSize: fontSize * 0.5,
                      color: "black",
                    }}
                  >
                    {count}
                  </Box>
                )}
              </Box>
            )
          }

          // If the cell has a tail and multiple pieces for this player, and it's not also the head
          if (hasTail && count > 1 && !hasHead) {
            content = (
              <Box
                key={`tail-${playerID}-${position}`}
                sx={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {/* Tail Representation */}
                <Box
                // sx={{
                //   ...transitionStyles,
                // }}
                />

                {/* Count Indicator */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    fontSize: fontSize * 0.5,
                    color: "black",
                  }}
                >
                  {count}
                </Box>
              </Box>
            )
          }

          // If neither head nor tail conditions are met, render the body normally
          if (!hasHead && !hasTail) {
            content = (
              <Box
                key={`body-${playerID}-${position}`}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  ...transitionStyles,
                }}
              />
            )
          }

          if (!content) return

          // Assign the content to the cellContentMap
          // If multiple players are in the same cell, stack their contents
          if (cellContentMap[position]) {
            // If content already exists, wrap both in a parent Box
            cellContentMap[position] = (
              <Box
                key={`multi-${position}`}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {cellContentMap[position]}
                {content}
              </Box>
            )
          } else {
            cellContentMap[position] = content
          }
        })
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
    }

    // Handle other game types (unchanged)
    else {
      // Other game modes

      // Place player pieces
      Object.keys(playerPieces).forEach((playerID) => {
        const positions = playerPieces[playerID]
        const playerInfo = players.find((p) => p.id === playerID)

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

  const handleSquareClick = async (index: number) => {
    if (!currentTurn || !gameState) return
    console.log(index)

    if (gameSetup?.started && !hasSubmittedMove) {
      const allowedMoves = currentTurn.allowedMoves[user.userID] || []
      if (allowedMoves.includes(index)) {
        setSelectedSquare(index)
      }
    }

    const clash = clashesAtPosition[index]
    if (clash && gameSetup) {
      const playersInvolved: GamePlayer[] = gameSetup?.gamePlayers.filter(
        (player) => clash.playerIDs.includes(player.id),
      )

      setClashReason(clash.reason)
      setClashPlayersList(playersInvolved)
      setOpenClashDialog(true)
    }

    if (!currentTurn || !currentTurn.allowedMoves[user.userID].includes(index))
      return

    if (gameState && user.userID && gameID) {
      const moveRef = collection(db, `games/${gameID}/privateMoves`)
      const moveNumber = gameState.turns.length - 1

      await addDoc(moveRef, {
        gameID,
        moveNumber,
        playerID: user.userID,
        move: index,
        timestamp: serverTimestamp(),
      })
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
        players={players}
      />
    </>
  )
}

export default GameGrid
