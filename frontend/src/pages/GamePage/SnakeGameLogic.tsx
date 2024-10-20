import { Box, SxProps, Theme } from "@mui/material"
import React from "react"
import { GameLogicProps, GameLogicReturn } from "./GameGrid"

const BORDER_WIDTH = 4 // Width of the white border and corner size

interface BorderStyles {
  borderTop: string
  borderRight: string
  borderBottom: string
  borderLeft: string
}

interface CellProps {
  children?: React.ReactNode
  sx?: SxProps<Theme>
  borders: BorderStyles
  onClick?: () => void
}

const Cell: React.FC<CellProps> = ({ children, sx, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      position: "relative",
      width: "100%",
      height: "100%",
      padding: 0,
      margin: 0,
      boxSizing: "border-box",
    }}
  >
    <Box
      onClick={onClick}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        padding: 0,
        margin: 0,
        boxSizing: "border-box",
        ...sx,
      }}
    >
      {children}
    </Box>

    {/* Corner boxes */}
    {[
      { top: 0, left: 0 },
      { top: 0, right: 0 },
      { bottom: 0, left: 0 },
      { bottom: 0, right: 0 },
    ].map((position, index) => (
      <Box
        key={index}
        sx={{
          position: "absolute",
          width: BORDER_WIDTH,
          height: BORDER_WIDTH,
          backgroundColor: "white",
          zIndex: 2,
          ...position,
        }}
      />
    ))}
  </Box>
)

interface ClashInfo {
  index: number
  playerIDs: string[]
  reason: string
}

interface SnakeSegmentInfo {
  hasHead: boolean
  hasTail: boolean
  count: number
}

interface CellSnakeSegments {
  [position: number]: {
    [playerID: string]: SnakeSegmentInfo
  }
}

const GameLogic = ({
  gameState,
  players,
  cellSize,
  selectedTurnIndex,
}: GameLogicProps): GameLogicReturn => {
  const cellContentMap: { [index: number]: JSX.Element } = {}
  const cellBackgroundMap: { [index: number]: string } = {}
  const cellAllowedMoveMap: { [index: number]: boolean } = {}
  const clashesAtPosition: { [index: number]: ClashInfo } = {}
  const selectedTurn = gameState?.turns[selectedTurnIndex]

  if (!selectedTurn || !gameState) {
    return {
      cellContentMap,
      cellBackgroundMap,
      cellAllowedMoveMap,
      clashesAtPosition,
    }
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
  Object.entries(allowedMoves).forEach(([, moves]) => {
    moves.forEach((position) => {
      cellAllowedMoveMap[position] = true
    })
  })

  const cellSnakeSegments: CellSnakeSegments = {}

  // Helper function to determine snake segment borders
  const getSnakeBorders = (
    position: number,
    index: number,
    positions: number[],
  ): BorderStyles => {
    const gridWidth = gameState.setup.boardWidth
    const prevPos = index > 0 ? positions[index - 1] : null
    const nextPos = index < positions.length - 1 ? positions[index + 1] : null

    const borders: BorderStyles = {
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

    console.log(borders)
    return borders
  }

  // Collect snake segments
  Object.entries(playerPieces).forEach(([playerID, positions]) => {
    const playerInfo = players.find((p) => p.id === playerID)

    // Iterate through positions in reverse order
    for (let index = positions.length - 1; index >= 0; index--) {
      const position = positions[index]
      const isHead = index === 0
      const isTail = index === positions.length - 1

      if (!cellSnakeSegments[position]) {
        cellSnakeSegments[position] = {}
      }

      if (!cellSnakeSegments[position][playerID]) {
        cellSnakeSegments[position][playerID] = {
          hasHead: isHead,
          hasTail: isTail,
          count: 1,
        }
      } else {
        cellSnakeSegments[position][playerID].count += 1
        // Preserve head information if this segment is the head
        if (isHead) {
          cellSnakeSegments[position][playerID].hasHead = true
        }
      }

      cellBackgroundMap[position] = playerInfo?.colour || "white"
    }
  })

  // Render snake segments
  Object.entries(cellSnakeSegments).forEach(([positionStr, playersInCell]) => {
    const position = parseInt(positionStr)

    Object.entries(playersInCell).forEach(([playerID, segmentInfo]) => {
      // Use type assertion here
      const { hasHead, hasTail, count } = segmentInfo as SnakeSegmentInfo
      const playerInfo = players.find((p) => p.id === playerID)
      const positions = playerPieces[playerID]

      const borders = getSnakeBorders(
        position,
        positions.indexOf(position),
        positions,
      )

      let content: JSX.Element | null = null

      const commonBoxStyle: SxProps<Theme> = {
        ...borders,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: playerInfo?.colour || "white",
        padding: 0,
        margin: 0,
      }

      if (hasHead) {
        content = (
          <Cell
            key={`head-${playerID}-${position}`}
            sx={commonBoxStyle}
            borders={borders}
          >
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
          <Cell
            key={`body-length-${playerID}-${position}`}
            sx={commonBoxStyle}
            borders={borders}
          >
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
          <Cell
            key={`tail-${playerID}-${position}`}
            sx={commonBoxStyle}
            borders={borders}
          >
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
          <Cell
            key={`body-${playerID}-${position}`}
            sx={commonBoxStyle}
            borders={borders}
          />
        )
      }

      if (content) {
        cellContentMap[position] = content
      }
    })
  })

  // Common style for non-snake cells
  const commonCellStyle: SxProps<Theme> = {
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
      <Box key={`food-${position}`} sx={commonCellStyle}>
        🍎
      </Box>
    )
  })

  // Place walls
  walls?.forEach((position) => {
    cellContentMap[position] = (
      <Box key={`wall-${position}`} sx={commonCellStyle}>
        🧱
      </Box>
    )
    cellBackgroundMap[position] = "#8B4513" // Brown color for walls
  })

  // Place hazards
  hazards?.forEach((position) => {
    cellContentMap[position] = (
      <Box key={`hazard-${position}`} sx={commonCellStyle}>
        <span style={{ zIndex: 2 }}>☠️</span>
      </Box>
    )
  })

  // Place clashes
  clashes?.forEach((clash) => {
    const position = clash.index
    cellContentMap[position] = (
      <Box key={`clash-${position}`} sx={commonCellStyle}>
        💀
      </Box>
    )
    cellBackgroundMap[position] = "#d3d3d3" // light gray
  })

  console.log(cellContentMap)

  return {
    cellContentMap,
    cellBackgroundMap,
    cellAllowedMoveMap,
    clashesAtPosition,
  }
}

export default GameLogic
