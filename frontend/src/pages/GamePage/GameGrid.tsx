import { Box } from "@mui/material"
import { GamePlayer, GameState, Player, Turn } from "@shared/types/Game"
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import React, { useLayoutEffect, useRef, useState } from "react"
import { useGameStateContext } from "../../context/GameStateContext"
import { useUser } from "../../context/UserContext"
import { db } from "../../firebaseConfig"
import ClashDialog from "./ClashDialog"
import GridCell from "./GridCell"
import OtherGameLogic from "./OtherGameLogic"
import SnakeGameLogic from "./SnakeGameLogic"

export interface GameLogicProps {
  selectedTurn: Turn | null
  gameState: GameState | null
  players: Player[]
  gridWidth: number
  cellSize: number
}

export interface GameLogicReturn {
  cellContentMap: { [index: number]: JSX.Element }
  cellBackgroundMap: { [index: number]: string }
  cellAllowedMoveMap: { [index: number]: boolean }
  clashesAtPosition: { [index: number]: any }
}

const GameGrid: React.FC = () => {
  const {
    gameState,
    gameSetup,
    players,
    hasSubmittedMove,
    selectedTurn,
    selectedSquare,
    setSelectedSquare,
    sessionName,
    gameID,
    latestTurn,
  } = useGameStateContext()

  const user = useUser()
  const winners = latestTurn?.winners || []
  const gridWidth = gameState?.setup.boardWidth || 8
  const gridHeight = gameState?.setup.boardHeight || 8
  const totalCells = gridWidth * gridHeight
  const winningSquaresSet = new Set(
    winners.flatMap((winner) => winner.winningSquares),
  )

  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<GamePlayer[]>([])

  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  const cellSize = containerWidth ? containerWidth / gridWidth : 0

  useLayoutEffect(() => {
    const updateContainerWidth = () => {
      if (gridRef.current) {
        setContainerWidth(gridRef.current.offsetWidth)
      }
    }
    updateContainerWidth()
    window.addEventListener("resize", updateContainerWidth)
    return () => {
      window.removeEventListener("resize", updateContainerWidth)
    }
  }, [gridWidth, selectedTurn])

  const handleSquareClick = async (index: number) => {
    if (!selectedTurn || !gameState) return

    if (gameSetup?.started) {
      const allowedMoves = selectedTurn.allowedMoves[user.userID] || []
      if (allowedMoves.includes(index)) {
        setSelectedSquare(index)

        // Handle clash
        const clash = clashesAtPosition[index]
        if (clash) {
          const playersInvolved = gameSetup.gamePlayers.filter((player) =>
            clash.playerIDs.includes(player.id),
          )
          setClashReason(clash.reason)
          setClashPlayersList(playersInvolved)
          setOpenClashDialog(true)
        }

        // Submit move
        if (gameID && sessionName) {
          const moveRef = collection(
            db,
            `sessions/${sessionName}/games/${gameID}/privateMoves`,
          )
          const moveNumber = gameState.turns.length - 1
          await addDoc(moveRef, {
            gameID,
            moveNumber,
            playerID: user.userID,
            move: index,
            timestamp: serverTimestamp(),
          })

          const moveStatusDocRef = doc(
            db,
            `sessions/${sessionName}/games/${gameID}/moveStatuses/${moveNumber}`,
          )
          await updateDoc(moveStatusDocRef, {
            movedPlayerIDs: arrayUnion(user.userID),
          })
        }
      }
    }
  }

  const disabled = hasSubmittedMove

  const gameLogicProps = {
    selectedTurn,
    gameState,
    players,
    gridWidth,
    cellSize,
  }

  const { cellContentMap, cellBackgroundMap, clashesAtPosition } =
    gameState?.setup.gameType === "snek"
      ? SnakeGameLogic(gameLogicProps)
      : OtherGameLogic(gameLogicProps)

  // Filter allowed moves for the current user
  const currentUserAllowedMoveMap: { [index: number]: boolean } = {}
  if (selectedTurn && user.userID) {
    const userAllowedMoves = selectedTurn.allowedMoves[user.userID] || []
    userAllowedMoves.forEach((move) => {
      currentUserAllowedMoveMap[move] = true
    })
  }

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
        {Array.from({ length: totalCells }).map((_, index) => (
          <GridCell
            key={index}
            index={index}
            cellSize={cellSize}
            cellContent={cellContentMap[index]}
            backgroundColor={cellBackgroundMap[index]}
            isWinningSquare={winningSquaresSet.has(index)}
            isLatestMove={latestTurn?.moves[user.userID] === index}
            isAllowedMove={currentUserAllowedMoveMap[index]}
            isSelected={selectedSquare === index}
            onClick={handleSquareClick}
            disabled={disabled}
          />
        ))}
      </Box>

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
