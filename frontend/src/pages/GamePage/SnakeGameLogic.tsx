import React from "react"
import { Box } from "@mui/material"
import { GameLogicProps, GameLogicReturn } from "./GameGrid"

const BORDER_WIDTH = 3 // Width of the white border and corner size

// Define the props for the Cell component
interface CellProps {
  children?: React.ReactNode
  sx?: any
  [key: string]: any
}

const Cell: React.FC<CellProps> = ({ children, sx, ...props }) => (
  <Box
    sx={{
      position: "relative",
      width: "100%",
      height: "100%",
      padding: 0,
      margin: 0,
      boxSizing: "border-box",
      ...sx,
    }}
    {...props}
  >
    {children}
    {/* Top-left corner */}
    <Box
      sx={{
        position: "absolute",
        top: -BORDER_WIDTH,
        left: -BORDER_WIDTH,
        width: BORDER_WIDTH,
        height: BORDER_WIDTH,
        backgroundColor: "white",
        zIndex: 1,
      }}
    />
    {/* Top-right corner */}
    <Box
      sx={{
        position: "absolute",
        top: -BORDER_WIDTH,
        right: -BORDER_WIDTH,
        width: BORDER_WIDTH,
        height: BORDER_WIDTH,
        backgroundColor: "white",
        zIndex: 1,
      }}
    />
    {/* Bottom-left corner */}
    <Box
      sx={{
        position: "absolute",
        bottom: -BORDER_WIDTH,
        left: -BORDER_WIDTH,
        width: BORDER_WIDTH,
        height: BORDER_WIDTH,
        backgroundColor: "white",
        zIndex: 1,
      }}
    />
    {/* Bottom-right corner */}
    <Box
      sx={{
        position: "absolute",
        bottom: -BORDER_WIDTH,
        right: -BORDER_WIDTH,
        width: BORDER_WIDTH,
        height: BORDER_WIDTH,
        backgroundColor: "white",
        zIndex: 1,
      }}
    />
  </Box>
)

const GameLogic = ({
  selectedTurn,
  gameState,
  players,
  cellSize,
}: GameLogicProps): GameLogicReturn => {
  const cellContentMap: { [index: number]: JSX.Element } = {}
  const cellBackgroundMap: { [index: number]: string } = {}
  const cellAllowedMoveMap: { [index: number]: boolean } = {}
  const clashesAtPosition: { [index: number]: any } = {}

  if (!selectedTurn || !gameState)
    return {
      cellContentMap,
      cellBackgroundMap,
      cellAllowedMoveMap,
      clashesAtPosition,
    }

  const { playerPieces, allowedMoves, clashes, food, hazards, walls } =
    selectedTurn

  // Map clashes to positions
  if (clashes) {
    clashes.forEach((clash) => {
      clashesAtPosition[clash.index] = clash
    })
  }

  // Map allowed moves for all players
  Object.entries(allowedMoves).forEach(([playerID, moves]) => {
    moves.forEach((position) => {
      cellAllowedMoveMap[position] = true
    })
  })

  const cellSnakeSegments: {
    [position: number]: {
      [playerID: string]: {
        hasHead: boolean
        hasTail: boolean
        count: number
      }
    }
  } = {}

  // Helper function to determine snake segment borders
  const getSnakeBorders = (
    playerID: string,
    position: number,
    index: number,
    positions: number[],
  ) => {
    const gridWidth = gameState.setup.boardWidth
    const prevPos = index > 0 ? positions[index - 1] : null
    const nextPos = index < positions.length - 1 ? positions[index + 1] : null

    const borders = {
      borderTop: `${BORDER_WIDTH}px solid white`,
      borderRight: `${BORDER_WIDTH}px solid white`,
      borderBottom: `${BORDER_WIDTH}px solid white`,
      borderLeft: `${BORDER_WIDTH}px solid white`,
    }

    if (prevPos !== null) {
      if (prevPos === position - 1) borders.borderLeft = "none"
      if (prevPos === position + 1) borders.borderRight = "none"
      if (prevPos === position - gridWidth) borders.borderTop = "none"
      if (prevPos === position + gridWidth) borders.borderBottom = "none"
    }

    if (nextPos !== null) {
      if (nextPos === position - 1) borders.borderLeft = "none"
      if (nextPos === position + 1) borders.borderRight = "none"
      if (nextPos === position - gridWidth) borders.borderTop = "none"
      if (nextPos === position + gridWidth) borders.borderBottom = "none"
    }

    return borders
  }

  // Collect snake segments
  Object.entries(playerPieces).forEach(([playerID, positions]) => {
    const playerInfo = players.find((p) => p.id === playerID)

    positions.forEach((position, index) => {
      const isHead = index === 0
      const isTail = index === positions.length - 1

      if (!cellSnakeSegments[position]) {
        cellSnakeSegments[position] = {}
      }

      cellSnakeSegments[position][playerID] = {
        hasHead: isHead,
        hasTail: isTail,
        count: (cellSnakeSegments[position][playerID]?.count || 0) + 1,
      }

      cellBackgroundMap[position] = playerInfo?.colour || "white"
    })
  })

  // Render snake segments
  Object.entries(cellSnakeSegments).forEach(([positionStr, playersInCell]) => {
    const position = parseInt(positionStr)

    Object.entries(playersInCell).forEach(([playerID, segmentInfo]) => {
      const { hasHead, hasTail, count } = segmentInfo
      const playerInfo = players.find((p) => p.id === playerID)
      const positions = playerPieces[playerID]

      const borders = getSnakeBorders(
        playerID,
        position,
        positions.indexOf(position),
        positions,
      )

      let content: JSX.Element | null = null

      const commonBoxStyle = {
        ...borders,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: playerInfo?.colour || "white",
        padding: 0,
        margin: 0,
        boxSizing: "border-box",
      }

      if (hasHead) {
        content = (
          <Cell key={`head-${playerID}-${position}`} sx={commonBoxStyle}>
            <span
              style={{ fontSize: cellSize * 0.8, lineHeight: 1, zIndex: 2 }}
            >
              {playerInfo?.emoji || "⭕"}
            </span>
          </Cell>
        )
      } else if (positions[1] === position) {
        // Snake length on the second body piece
        content = (
          <Cell key={`body-length-${playerID}-${position}`} sx={commonBoxStyle}>
            <Box
              sx={{
                fontSize: cellSize * 0.6,
                lineHeight: 1,
                color: "black",
                fontWeight: "bold",
                zIndex: 2,
              }}
            >
              {positions.length}
            </Box>
          </Cell>
        )
      } else if (hasTail && count > 1) {
        // Tail length indicator
        content = (
          <Cell key={`tail-${playerID}-${position}`} sx={commonBoxStyle}>
            <Box
              sx={{
                fontSize: cellSize * 0.6,
                lineHeight: 1,
                color: "black",
                fontWeight: "bold",
                zIndex: 2,
              }}
            >
              {count}
            </Box>
          </Cell>
        )
      } else {
        // Regular body segment
        content = (
          <Cell key={`body-${playerID}-${position}`} sx={commonBoxStyle} />
        )
      }

      if (content) {
        cellContentMap[position] = content
      }
    })
  })

  // Common style for non-snake cells
  const commonCellStyle = {
    fontSize: cellSize * 0.8,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
    margin: 0,
    boxSizing: "border-box",
  }

  // Place food
  food?.forEach((position) => {
    cellContentMap[position] = (
      <Cell key={`food-${position}`} sx={commonCellStyle}>
        <span style={{ zIndex: 2 }}>🍎</span>
      </Cell>
    )
  })

  // Place walls
  walls?.forEach((position) => {
    cellContentMap[position] = (
      <Cell key={`wall-${position}`} sx={commonCellStyle}>
        <span style={{ zIndex: 2 }}>🧱</span>
      </Cell>
    )
    cellBackgroundMap[position] = "#8B4513" // Brown color for walls
  })

  // Place hazards
  hazards?.forEach((position) => {
    cellContentMap[position] = (
      <Cell key={`hazard-${position}`} sx={commonCellStyle}>
        <span style={{ zIndex: 2 }}>☠️</span>
      </Cell>
    )
  })

  // Place clashes
  clashes?.forEach((clash) => {
    const position = clash.index
    cellContentMap[position] = (
      <Cell key={`clash-${position}`} sx={commonCellStyle}>
        <span style={{ zIndex: 2 }}>💀</span>
      </Cell>
    )
    cellBackgroundMap[position] = "#d3d3d3" // light gray
  })

  return {
    cellContentMap,
    cellBackgroundMap,
    cellAllowedMoveMap,
    clashesAtPosition,
  }
}

export default GameLogic
