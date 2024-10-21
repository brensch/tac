import { Box, IconButton, Typography } from "@mui/material"
import { GamePlayer, GameState, Player } from "@shared/types/Game"
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
import {
  ArrowBack,
  ArrowForward,
  FirstPage,
  LastPage,
} from "@mui/icons-material"

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

  // Initialize selectedTurnIndex and turnCount to 0
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number>(-1)
  const [turnCount, setTurnCount] = useState<number>(0)

  const [clashReason, setClashReason] = useState<string>("")
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<GamePlayer[]>([])
  const [gameLogicReturn, setGameLogicReturn] = useState<
    GameLogicReturn | undefined
  >()
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
  }, [gridWidth, selectedTurnIndex])

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

  // Update selectedTurnIndex and turnCount when gameState.turns.length changes
  useEffect(() => {
    if (gameState?.turns) {
      const newTurnCount = gameState.turns.length
      if (newTurnCount !== turnCount) {
        setTurnCount(newTurnCount)
        setSelectedTurnIndex(newTurnCount - 1) // Automatically go to the latest turn
      }
    }
  }, [gameState?.turns?.length])

  // Update gameLogicReturn when relevant variables change
  useEffect(() => {
    if (gameState && players) {
      const gameLogicProps = {
        gameState,
        players,
        gridWidth,
        cellSize,
        selectedTurnIndex: selectedTurnIndex >= 0 ? selectedTurnIndex : 0,
      }

      setGameLogicReturn(
        gameState.setup.gameType === "snek"
          ? SnakeGameLogic(gameLogicProps)
          : OtherGameLogic(gameLogicProps),
      )
    }
  }, [gameState, players, gridWidth, cellSize, selectedTurnIndex])

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
    if (gameState?.turns && selectedTurnIndex < gameState.turns.length - 1) {
      setSelectedTurnIndex(selectedTurnIndex + 1)
    }
  }

  const handleLatestTurn = () => {
    if (gameState?.turns) {
      setSelectedTurnIndex(gameState.turns.length - 1)
    }
  }

  const handleFirstTurn = () => {
    if (gameState?.turns) {
      setSelectedTurnIndex(0)
    }
  }

  if (!gameLogicReturn) return

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
            key={`${index}-${selectedTurnIndex}`}
            index={index}
            cellSize={cellSize}
            cellContent={gameLogicReturn.cellContentMap[index]}
            backgroundColor={gameLogicReturn.cellBackgroundMap[index]}
            isWinningSquare={
              selectedTurnIndex === turnCount - 1 &&
              winningSquaresSet.has(index)
            }
            isLatestMove={latestTurn?.moves[user.userID] === index}
            isAllowedMove={currentUserAllowedMoveMap[index]}
            isSelected={selectedSquare === index}
            onClick={handleSquareClick}
            disabled={disabled}
            selectedTurnIndex={selectedTurnIndex}
          />
        ))}
      </Box>
      {/* Navigation controls */}
      <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
        <IconButton
          onClick={handleFirstTurn}
          disabled={
            !gameState?.turns || selectedTurnIndex >= gameState.turns.length - 1
          }
        >
          <FirstPage />
        </IconButton>
        <IconButton onClick={handlePrevTurn} disabled={selectedTurnIndex <= 0}>
          <ArrowBack />
        </IconButton>
        <Typography variant="body2" sx={{ marginX: 2 }}>
          {gameState?.turns ? selectedTurnIndex + 1 : "Loading..."} of{" "}
          {gameState?.turns?.length || 0}
        </Typography>

        <IconButton
          onClick={handleNextTurn}
          disabled={
            !gameState?.turns || selectedTurnIndex >= gameState.turns.length - 1
          }
        >
          <ArrowForward />
        </IconButton>
        <IconButton
          onClick={handleLatestTurn}
          disabled={
            !gameState?.turns || selectedTurnIndex >= gameState.turns.length - 1
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
