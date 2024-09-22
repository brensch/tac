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
    if (gameStarted && selectedSquare === null && !hasSubmittedMove) {
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

      // Add the move to Firestore
      await addDoc(moveRef, {
        gameID,
        moveNumber,
        playerID: userID,
        move: selectedSquare,
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

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gameState.boardWidth}, 50px)`,
        }}
      >
        {board.map((cell, index) => (
          <div
            key={index}
            onClick={() => handleSquareClick(index)}
            style={{
              width: "50px",
              height: "50px",
              border: "1px solid black",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "1.5rem",
              cursor:
                gameStarted &&
                selectedSquare === null &&
                cell === "" &&
                !hasSubmittedMove &&
                !lockedSquares.includes(index)
                  ? "pointer"
                  : "not-allowed",
              backgroundColor:
                selectedSquare === index
                  ? "#f0f0f0"
                  : lockedSquares.includes(index)
                  ? "#ddd"
                  : "white",
            }}
          >
            {cell
              ? playerInfos.find((p) => p.id === cell)?.nickname || cell
              : "-"}
          </div>
        ))}
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
          {hasSubmittedMove && <p>Waiting for other players...</p>}

          {selectedSquare !== null && (
            <button onClick={handleMoveSubmit}>Submit Move</button>
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
        </>
      )}
    </div>
  )
}

export default GamePage
