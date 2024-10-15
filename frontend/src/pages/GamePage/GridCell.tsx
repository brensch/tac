import React from "react"
import { Box } from "@mui/material"

interface GridCellProps {
  index: number
  cellSize: number
  cellContent: React.ReactNode
  backgroundColor: string
  isWinningSquare: boolean
  isLatestMove: boolean
  isAllowedMove: boolean
  isSelected: boolean
  onClick: (index: number) => void
  disabled: boolean
}

const BORDER_WIDTH = 4

const GridCell: React.FC<GridCellProps> = ({
  index,
  cellSize,
  cellContent,
  backgroundColor,
  isWinningSquare,
  isLatestMove,
  isAllowedMove,
  isSelected,
  onClick,
  disabled,
}) => {
  return (
    <Box
      onClick={() => {
        if (disabled) return
        onClick(index)
      }}
      sx={{
        width: "100%",
        paddingBottom: "100%",
        position: "relative",
        border: "1px solid black",
        cursor: disabled ? "default" : "pointer",
        backgroundColor: isWinningSquare ? "green" : backgroundColor || "white",
        transition: "background-color 0.3s",
        boxSizing: "border-box",
      }}
    >
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
          fontSize: `${cellSize}px`,
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
}

export default GridCell
