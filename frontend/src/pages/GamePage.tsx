import React, { useEffect, useState } from "react"
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
} from "@mui/material"
import { GameState, PlayerInfo } from "@shared/types/Game"

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

  // Monitor the game document
  useEffect(() => {
    if (gameID && userID) {
      const gameDocRef = doc(db, "games", gameID)
      const unsubscribe = onSnapshot(gameDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data() as GameState
          setGameState(gameData)

          // Add user to the game if not already in it
          if (!gameData.playerIDs.includes(userID)) {
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
        }
      })
      return () => unsubscribe()
    }
  }, [gameID, userID])

  // **New useEffect to monitor player documents**
  useEffect(() => {
    if (gameState?.playerIDs) {
      // Array to store unsubscribe functions
      const unsubscribes: (() => void)[] = []

      // Temporary object to store playerInfos
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
          // Update the playerInfos state with the current values
          setPlayerInfos(Object.values(playersMap))
        })

        unsubscribes.push(unsubscribe)
      })

      // Cleanup function to unsubscribe from all listeners
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

        // Update currentTurnIndex to the latest turn
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
      // Update 'started' in the game document
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        started: true,
      })
    }
  }

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    if (gameStarted && !hasSubmittedMove) {
      // Get the latest turn's board
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

      // Add the move to Firestore with server-side timestamp
      await addDoc(moveRef, {
        gameID,
        moveNumber,
        playerID: userID,
        move: selectedSquare,
        timestamp: serverTimestamp(), // Store server-side timestamp
      })

      // Do not reset selectedSquare
      // setSelectedSquare(null);
      setHasSubmittedMove(true)
    }
  }

  // Navigate to previous turn
  const handlePrevTurn = () => {
    if (currentTurnIndex > 0) {
      setCurrentTurnIndex(currentTurnIndex - 1)
    }
  }

  // Navigate to next turn
  const handleNextTurn = () => {
    if (currentTurnIndex < turns.length - 1) {
      setCurrentTurnIndex(currentTurnIndex + 1)
    }
  }

  if (!gameState) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  const { currentRound, winner } = gameState
  const currentTurn = turns[currentTurnIndex]

  // Render the grid
  const renderGrid = () => {
    if (!currentTurn) {
      return <Typography>Loading board...</Typography>
    }

    const { board, clashes } = currentTurn

    const gridSize = gameState.boardWidth

    return (
      <Box
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
                  fontSize: "2rem",
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
      <Typography variant="h4">Game: {gameID}</Typography>
      <Typography variant="subtitle1">Current Round: {currentRound}</Typography>

      <Typography variant="h6" sx={{ marginTop: 2 }}>
        Players:
      </Typography>
      <TableContainer component={Paper} sx={{ maxWidth: 400, marginBottom: 2 }}>
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
        <Button color="primary" onClick={handleStartGame}>
          Start Game
        </Button>
      )}

      {gameStarted && (
        <>
          {winner ? (
            <Typography variant="h5" color="primary" sx={{ marginTop: 2 }}>
              Game Over! Winner:{" "}
              {playerInfos.find((p) => p.id === winner)?.nickname || winner}
            </Typography>
          ) : (
            <>
              {hasSubmittedMove ? (
                <Box
                  sx={{
                    backgroundColor: "#fffae6",
                    padding: 1,
                    marginBottom: 2,
                  }}
                >
                  <Typography>Waiting for other players...</Typography>
                </Box>
              ) : (
                selectedSquare !== null &&
                currentTurn.board[selectedSquare] === "" && (
                  <Button
                    color="primary"
                    onClick={handleMoveSubmit}
                    sx={{ marginBottom: 2 }}
                  >
                    Submit Move
                  </Button>
                )
              )}
            </>
          )}
          {renderGrid()}

          {/* Navigation controls */}
          <Box sx={{ marginTop: 2 }}>
            <Button onClick={handlePrevTurn} disabled={currentTurnIndex <= 0}>
              Previous Turn
            </Button>
            <Button
              onClick={handleNextTurn}
              disabled={currentTurnIndex >= turns.length - 1}
              sx={{ marginLeft: 1 }}
            >
              Next Turn
            </Button>
            <Typography variant="body2" sx={{ marginTop: 1 }}>
              Viewing Turn {currentTurn ? currentTurn.turnNumber : "Loading..."}{" "}
              of {turns.length - 1}
            </Typography>
          </Box>

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
              <Typography variant="h4">Waiting for other players...</Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

export default GamePage
