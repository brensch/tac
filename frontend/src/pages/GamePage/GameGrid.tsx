import { Box, IconButton, Typography } from "@mui/material"
import { GamePlayer, GameState, Player, Turn } from "@shared/types/Game"
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useGameStateContext } from "../../context/GameStateContext"
import { useUser } from "../../context/UserContext"
import { db } from "../../firebaseConfig"
import ClashDialog from "./ClashDialog"
import GridCell from "./GridCell"
import OtherGameLogic from "./OtherGameLogic"
import SnakeGameLogic from "./SnakeGameLogic"
import { ArrowBack, ArrowForward, LastPage } from "@mui/icons-material"

export interface GameLogicProps {
  gameState: GameState | null
  players: Player[]
  gridWidth: number
  cellSize: number
  selectedTurnIndex: number
}

export interface ClashInfo {
  reason: string
  playerIDs: string[]
}

export interface GameLogicReturn {
  cellContentMap: { [index: number]: JSX.Element }
  cellBackgroundMap: { [index: number]: string }
  cellAllowedMoveMap: { [index: number]: boolean }
  clashesAtPosition: { [index: number]: ClashInfo }
}

const GameGrid: React.FC = () => {
  const {
    gameState,
    gameSetup,
    players,
    hasSubmittedMove,
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
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number>(
    gameState?.turns ? gameState?.turns.length - 1 : 0,
  )
  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<GamePlayer[]>([])
  const [gameLogicReturn, setGameLogicReturn] = useState<
    GameLogicReturn | undefined
  >()
  const [turnCount, setTurnCount] = useState(gameState?.turns.length)
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  const cellSize = containerWidth ? containerWidth / gridWidth : 0

  console.log(selectedTurnIndex)
  console.log(turnCount)
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
  }, [gridWidth])

  const handleSquareClick = async (index: number) => {
    if (!latestTurn || !gameState) return

    if (gameSetup?.started) {
      const allowedMoves = latestTurn.allowedMoves[user.userID] || []
      if (allowedMoves.includes(index)) {
        setSelectedSquare(index)

        // Handle clash
        const clash = gameLogicReturn?.clashesAtPosition[index]
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

  useEffect(() => {
    const gameLogicProps = {
      gameState,
      players,
      gridWidth,
      cellSize,
      selectedTurnIndex: selectedTurnIndex ? selectedTurnIndex - 1 : 0,
    }

    setGameLogicReturn(
      gameState?.setup.gameType === "snek"
        ? SnakeGameLogic(gameLogicProps)
        : OtherGameLogic(gameLogicProps),
    )
    console.log(
      !turnCount,
      gameState?.turns && gameState.turns.length,
      turnCount,
    )
    if (
      !turnCount ||
      (gameState?.turns && gameState.turns.length > turnCount)
    ) {
      console.log("setting")
      setTurnCount(gameState?.turns.length)
      setSelectedTurnIndex(gameState?.turns.length || 1)
    }
  }, [gameState, players, gridWidth, cellSize, selectedTurnIndex])

  if (!gameLogicReturn) return

  // Filter allowed moves for the current user
  const currentUserAllowedMoveMap: { [index: number]: boolean } = {}
  if (latestTurn && user.userID) {
    const userAllowedMoves = latestTurn.allowedMoves[user.userID] || []
    userAllowedMoves.forEach((move) => {
      currentUserAllowedMoveMap[move] = true
    })
  }

  // Navigation handlers
  const handlePrevTurn = () => {
    if (gameState?.turns && selectedTurnIndex > 0) {
      setSelectedTurnIndex(selectedTurnIndex - 1)
    }
  }

  const handleNextTurn = () => {
    if (gameState?.turns && selectedTurnIndex < gameState?.turns.length - 1) {
      setSelectedTurnIndex(selectedTurnIndex + 1)
    }
  }

  const handleLatestTurn = () => {
    if (gameState?.turns) {
      setSelectedTurnIndex(gameState?.turns?.length - 1)
    }
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
            key={`${selectedTurnIndex}-${index}`}
            index={index}
            cellSize={cellSize}
            cellContent={gameLogicReturn.cellContentMap[index]}
            backgroundColor={gameLogicReturn.cellBackgroundMap[index]}
            isWinningSquare={winningSquaresSet.has(index)}
            isLatestMove={latestTurn?.moves[user.userID] === index}
            isAllowedMove={currentUserAllowedMoveMap[index]}
            isSelected={selectedSquare === index}
            onClick={handleSquareClick}
            disabled={disabled}
          />
        ))}
      </Box>
      {/* Navigation controls */}
      <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <IconButton onClick={handlePrevTurn} disabled={selectedTurnIndex <= 0}>
          <ArrowBack />
        </IconButton>
        <Typography variant="body2" sx={{ marginX: 2 }}>
          {latestTurn ? selectedTurnIndex + 1 : "Loading..."} of{" "}
          {gameState?.turns.length}
        </Typography>
        <IconButton
          onClick={handleNextTurn}
          disabled={
            !gameState?.turns ||
            selectedTurnIndex >= gameState?.turns.length - 1
          }
        >
          <ArrowForward />
        </IconButton>
        <IconButton
          onClick={handleLatestTurn}
          disabled={
            !gameState?.turns ||
            selectedTurnIndex >= gameState?.turns.length - 1
          }
        >
          <LastPage />
        </IconButton>
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
