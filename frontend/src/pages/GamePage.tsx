import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import {
  doc,
  getDoc,
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
  setDoc,
  serverTimestamp,
} from "firebase/firestore"
import { useUser } from "../context/UserContext"
import { db } from "../firebaseConfig"
import { GameState, PlayerInfo, Turn, Move } from "@shared/types/Game"

const GamePage: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()
  const { userDoc, userID } = useUser()
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

          // Fetch player nicknames
          const playerPromises = gameData.playerIDs.map(async (playerID) => {
            const playerDocRef = doc(db, "users", playerID)
            const playerDocSnap = await getDoc(playerDocRef)
            if (playerDocSnap.exists()) {
              const playerData = playerDocSnap.data()
              return {
                id: playerID,
                nickname: playerData?.nickname || "Unknown",
              }
            }
            return { id: playerID, nickname: "Unknown" }
          })

          const players = await Promise.all(playerPromises)
          setPlayerInfos(players)

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
      // Create an initial Turn document with an empty board
      const boardSize = gameState.boardWidth * gameState.boardWidth
      const initialBoard = Array(boardSize).fill("")

      const initialTurn: Turn = {
        turnNumber: 0,
        board: initialBoard,
        hasMoved: [],
        lockedSquares: [],
        clashes: {},
      }

      const turnRef = doc(db, "games", gameID, "turns", "0")
      await setDoc(turnRef, initialTurn)

      // Update currentRound in the game document
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        currentRound: 1, // Start from round 1 after initial turn 0
      })
    }
  }

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    if (gameStarted && !hasSubmittedMove) {
      // Get the latest turn's locked squares
      const latestTurn = turns[turns.length - 1]
      if (!latestTurn) {
        console.error("No turns available")
        return
      }

      if (
        latestTurn.board[index] === "" &&
        !latestTurn.lockedSquares.includes(index)
      ) {
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

      setSelectedSquare(null)
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
    return <div>Loading game...</div>
  }

  const { currentRound } = gameState
  const currentTurn = turns[currentTurnIndex]

  // Render the grid
  const renderGrid = () => {
    if (!currentTurn) {
      return <div>Loading board...</div>
    }

    const { board, lockedSquares } = currentTurn

    // Calculate cell size based on board width
    const gridSize = gameState.boardWidth
    const cellSize = `${100 / gridSize}%`

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          width: "100%",
          maxWidth: "600px",
          margin: "0 auto",
          border: "2px solid black",
        }}
      >
        {board.map((cell, index) => {
          const isLocked = lockedSquares.includes(index)
          const isSelected = selectedSquare === index
          const isCellEmpty = cell === ""

          return (
            <div
              key={index}
              onClick={() => handleSquareClick(index)}
              style={{
                width: "100%",
                paddingBottom: "100%", // Maintain aspect ratio
                position: "relative",
                border: "1px solid black",
                cursor:
                  gameStarted && !hasSubmittedMove && isCellEmpty && !isLocked
                    ? "pointer"
                    : "default",
                backgroundColor: isSelected
                  ? "#f0f0f0"
                  : isLocked
                  ? "#ddd"
                  : "white",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "1.5rem",
                }}
              >
                {cell
                  ? playerInfos.find((p) => p.id === cell)?.nickname || cell
                  : ""}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <h1>Game ID: {gameID}</h1>
      <h2>User ID: {userID}</h2>
      <h3>Nickname: {userDoc?.nickname}</h3>
      <h4>Game Started: {gameStarted ? "Yes" : "No"}</h4>
      <h4>Current Round: {currentRound}</h4>

      <h4>Players:</h4>
      <ul>
        {playerInfos.map((player) => (
          <li key={player.id}>{player.nickname}</li>
        ))}
      </ul>

      {!gameStarted && <button onClick={handleStartGame}>Start Game</button>}

      {gameStarted && (
        <>
          {hasSubmittedMove ? (
            <p style={{ backgroundColor: "#fffae6", padding: "10px" }}>
              Waiting for other players...
            </p>
          ) : (
            selectedSquare !== null && (
              <button onClick={handleMoveSubmit}>Submit Move</button>
            )
          )}

          {/* Navigation controls */}
          <div>
            <button onClick={handlePrevTurn} disabled={currentTurnIndex <= 0}>
              Previous Turn
            </button>
            <button
              onClick={handleNextTurn}
              disabled={currentTurnIndex >= turns.length - 1}
            >
              Next Turn
            </button>
            <p>
              Viewing Turn {currentTurn ? currentTurn.turnNumber : "Loading..."}{" "}
              of {turns.length - 1}
            </p>
          </div>

          {renderGrid()}

          {/* Display clashes */}
          {currentTurn && Object.keys(currentTurn.clashes).length > 0 && (
            <div>
              <h4>Clashes this turn:</h4>
              <ul>
                {Object.entries(currentTurn.clashes).map(
                  ([square, players]) => (
                    <li key={square}>
                      Square {square} had a clash between{" "}
                      {players
                        .map(
                          (playerID) =>
                            playerInfos.find((p) => p.id === playerID)
                              ?.nickname || playerID,
                        )
                        .join(", ")}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {/* Highlight grid when waiting */}
          {hasSubmittedMove && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <h2>Waiting for other players...</h2>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default GamePage
