import React, { useEffect, useState, useRef, useLayoutEffect } from "react"
import { useParams } from "react-router-dom"
import {
  doc,
  updateDoc,
  onSnapshot,
  addDoc,
  collection,
  arrayUnion,
  query,
  where,
  getDocs,
  onSnapshot as onCollectionSnapshot,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { useUser } from "../context/UserContext"
import { db } from "../firebaseConfig"

import {
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  TextField,
} from "@mui/material"
import { GameState, PlayerInfo } from "@shared/types/Game"
import { ArrowBack, ArrowForward, LastPage } from "@mui/icons-material"

export interface Turn {
  turnNumber: number
  board: string[] // The board state after this turn
  hasMoved: string[] // List of player IDs who have submitted their move for this turn
  clashes: { [square: string]: string[] } // Map of square indices to player IDs who clashed
}

const GamePage: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()
  const { userID } = useUser()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerInfos, setPlayerInfos] = useState<PlayerInfo[]>([])
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null)
  const [hasSubmittedMove, setHasSubmittedMove] = useState<boolean>(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(-1)
  const [error, setError] = useState<string | null>(null)
  const [boardWidth, setBoardWidth] = useState<string>("8")

  // New ref and state for dynamic font sizing
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

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
  }, [gameState?.boardWidth])

  // Monitor the game document
  useEffect(() => {
    if (gameID && userID) {
      const gameDocRef = doc(db, "games", gameID)
      const unsubscribe = onSnapshot(gameDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data() as GameState
          setGameState(gameData)

          // Set boardWidth from gameData
          if (!gameStarted) {
            setBoardWidth(
              gameData.boardWidth !== undefined
                ? gameData.boardWidth.toString()
                : "8",
            )
          }

          // Add user to the game if not already in it and game hasn't started
          if (!gameData.started && !gameData.playerIDs.includes(userID)) {
            await updateDoc(gameDocRef, {
              playerIDs: arrayUnion(userID),
            })
          }

          // Check if the player has submitted a move
          const movesRef = collection(db, `games/${gameID}/privateMoves`)
          const movesQuery = query(
            movesRef,
            where("playerID", "==", userID),
            where("moveNumber", "==", gameData.currentRound),
          )
          const movesSnapshot = await getDocs(movesQuery)
          setHasSubmittedMove(!movesSnapshot.empty)
        } else {
          console.error("Game not found")
          setError("Game not found.")
        }
      })
      return () => unsubscribe()
    }
  }, [gameID, userID])

  // Monitor player documents
  useEffect(() => {
    if (gameState?.playerIDs) {
      const unsubscribes: (() => void)[] = []
      const playersMap: { [id: string]: PlayerInfo } = {}

      gameState.playerIDs.forEach((playerID) => {
        const playerDocRef = doc(db, "users", playerID)

        const unsubscribe = onSnapshot(playerDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const playerData = docSnap.data() as PlayerInfo
            playersMap[playerID] = {
              id: playerID,
              nickname: playerData?.nickname || "Unknown",
              emoji: playerData.emoji || "🦍",
            }
          } else {
            playersMap[playerID] = {
              id: playerID,
              nickname: "Unknown",
              emoji: "🦍",
            }
          }
          setPlayerInfos(Object.values(playersMap))
        })

        unsubscribes.push(unsubscribe)
      })

      return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe())
      }
    }
  }, [gameState?.playerIDs])

  // Monitor the turns collection
  useEffect(() => {
    if (gameID) {
      const turnsRef = collection(db, "games", gameID, "turns")
      const turnsQuery = query(turnsRef, orderBy("turnNumber", "asc"))

      const unsubscribe = onCollectionSnapshot(turnsQuery, (querySnapshot) => {
        const turnsList: Turn[] = querySnapshot.docs.map(
          (doc) => doc.data() as Turn,
        )
        setTurns(turnsList)
        setCurrentTurnIndex(turnsList.length - 1)
      })

      return () => unsubscribe()
    }
  }, [gameID])

  // Determine if the game has started
  const gameStarted = turns.length > 0

  // Start game
  const handleStartGame = async () => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        started: true,
      })
    }
  }

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    if (gameStarted && !hasSubmittedMove) {
      const latestTurn = turns[turns.length - 1]
      if (!latestTurn) {
        console.error("No turns available")
        return
      }

      const cellValue = latestTurn.board[index]

      if (cellValue === "" || cellValue === null) {
        setSelectedSquare(index)
      }
    }
  }

  // Submit a move
  const handleMoveSubmit = async () => {
    if (selectedSquare !== null && gameState && userID && gameID) {
      const moveRef = collection(db, `games/${gameID}/privateMoves`)
      const moveNumber = gameState.currentRound

      await addDoc(moveRef, {
        gameID,
        moveNumber,
        playerID: userID,
        move: selectedSquare,
        timestamp: serverTimestamp(),
      })

      setHasSubmittedMove(true)
    }
  }

  // Navigation handlers
  const handlePrevTurn = () => {
    if (currentTurnIndex > 0) {
      setCurrentTurnIndex(currentTurnIndex - 1)
    }
  }

  const handleNextTurn = () => {
    if (currentTurnIndex < turns.length - 1) {
      setCurrentTurnIndex(currentTurnIndex + 1)
    }
  }

  const handleLatestTurn = () => {
    setCurrentTurnIndex(turns.length - 1)
  }

  // Handle board width change
  const handleBoardWidthChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value
    setBoardWidth(value)
  }

  // Update Firestore when the input loses focus
  const handleBoardWidthBlur = async () => {
    if (gameID && !gameStarted) {
      const newBoardWidth = parseInt(boardWidth, 10)
      const gameDocRef = doc(db, "games", gameID)

      if (!isNaN(newBoardWidth) && newBoardWidth >= 0) {
        await updateDoc(gameDocRef, {
          boardWidth: newBoardWidth,
        })
      } else {
        // Handle invalid input: set a default or leave as is
        await updateDoc(gameDocRef, {
          boardWidth: null,
        })
      }
    }
  }

  if (!gameState || error) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        {error ? <Typography>{error}</Typography> : <CircularProgress />}
      </Box>
    )
  }

  const { winner } = gameState
  const currentTurn = turns[currentTurnIndex]

  // Render the grid
  const renderGrid = () => {
    if (!currentTurn) {
      return <Typography>Loading board...</Typography>
    }

    const { board, clashes } = currentTurn
    const gridSize = gameState.boardWidth || 8 // Default to 8 if undefined

    // Calculate cell size and font size
    const cellSize = containerWidth ? containerWidth / gridSize : 0
    const fontSize = cellSize ? Math.min(cellSize * 0.6, 48) : 16 // Set a max font size

    return (
      <Box
        ref={gridRef}
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
          border: "2px solid black",
        }}
      >
        {board.map((cell, index) => {
          const isSelected = selectedSquare === index
          const isCellEmpty = cell === ""
          const isBlocked = cell === "-1"
          const clashPlayers = clashes[index.toString()] || []

          return (
            <Box
              key={index}
              onClick={() => handleSquareClick(index)}
              sx={{
                width: "100%",
                paddingBottom: "100%", // Maintain aspect ratio
                position: "relative",
                border: "1px solid black",
                cursor:
                  gameStarted && !hasSubmittedMove && isCellEmpty && !isBlocked
                    ? "pointer"
                    : "default",
                backgroundColor: isSelected
                  ? "#cfe8fc"
                  : isBlocked
                  ? "#ddd"
                  : "white",
              }}
            >
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
                  fontSize: `${fontSize}px`, // Dynamic font size
                  textAlign: "center",
                  padding: 1,
                }}
              >
                {isBlocked
                  ? "❌"
                  : cell
                  ? playerInfos.find((p) => p.id === cell)?.emoji || cell
                  : clashPlayers.length > 0
                  ? clashPlayers
                      .map(
                        (playerID) =>
                          playerInfos.find((p) => p.id === playerID)?.emoji ||
                          playerID,
                      )
                      .join(", ")
                  : ""}
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  }

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h4">Game {gameID}</Typography>

      {gameStarted ? (
        <>
          {winner ? (
            <Typography variant="h5" color="primary" sx={{ my: 2 }}>
              Game Over! Winner:{" "}
              {playerInfos.find((p) => p.id === winner)?.nickname || winner}
            </Typography>
          ) : (
            <Button
              disabled={
                !(
                  selectedSquare !== null &&
                  currentTurn.board[selectedSquare] === "" &&
                  turns.length === currentTurn.turnNumber
                )
              }
              color="primary"
              onClick={handleMoveSubmit}
              sx={{ my: 2 }}
              fullWidth
            >
              Submit Move
            </Button>
          )}
          {renderGrid()}

          {/* Navigation controls */}
          <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
            <IconButton
              onClick={handlePrevTurn}
              disabled={currentTurnIndex <= 0}
            >
              <ArrowBack />
            </IconButton>

            <Typography variant="body2" sx={{ marginX: 2 }}>
              Viewing Turn {currentTurn ? currentTurn.turnNumber : "Loading..."}{" "}
              of {turns.length}
            </Typography>

            <IconButton
              onClick={handleNextTurn}
              disabled={currentTurnIndex >= turns.length - 1}
            >
              <ArrowForward />
            </IconButton>

            <IconButton
              onClick={handleLatestTurn}
              disabled={currentTurnIndex >= turns.length - 1}
            >
              <LastPage />
            </IconButton>
          </Box>
        </>
      ) : (
        <Box sx={{ my: 2 }}>
          <Button
            color="primary"
            disabled={
              gameState.started ||
              gameState.boardWidth < 5 ||
              gameState.boardWidth > 20
            }
            onClick={handleStartGame}
            sx={{ mb: 2 }}
            fullWidth
          >
            Start Game
          </Button>
          <TextField
            label="Board Size"
            type="number"
            value={boardWidth}
            onChange={handleBoardWidthChange}
            onBlur={handleBoardWidthBlur}
            disabled={gameStarted}
            fullWidth
          />
          {gameState.boardWidth < 5 && (
            <Typography color="error">
              Board needs to be bigger than 4
            </Typography>
          )}
        </Box>
      )}
      <TableContainer component={Paper} sx={{ my: 2, width: "100%" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Player</TableCell>
              <TableCell>Emoji</TableCell>
              <TableCell align="right">Has Moved</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {playerInfos.map((player) => (
              <TableRow key={player.id}>
                <TableCell component="th" scope="row">
                  {player.nickname}
                </TableCell>
                <TableCell component="th" scope="row">
                  {player.emoji}
                </TableCell>
                <TableCell align="right">
                  {currentTurn?.hasMoved.includes(player.id) ? "Yes" : "No"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!gameStarted && (
        <Typography variant="body2">
          Share the URL of this page to invite others.
        </Typography>
      )}

      {/* Highlight grid when waiting */}
      {hasSubmittedMove && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            bgcolor: "rgba(255, 255, 255, 0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <Typography sx={{ mx: 2, textAlign: "center" }} variant="h4">
            Waiting for other players
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default GamePage
