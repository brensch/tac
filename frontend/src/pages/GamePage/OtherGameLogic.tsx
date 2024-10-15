import { GameLogicProps, GameLogicReturn } from "./GameGrid"

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

  const { playerPieces, allowedMoves, clashes } = selectedTurn

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

  // Place player pieces
  Object.entries(playerPieces).forEach(([playerID, positions]) => {
    const playerInfo = players.find((p) => p.id === playerID)

    positions.forEach((position) => {
      cellContentMap[position] = (
        <span key={`piece-${position}`} style={{ fontSize: cellSize }}>
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
      <span key={`clash-${position}`} style={{ fontSize: cellSize }}>
        💥
      </span>
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
