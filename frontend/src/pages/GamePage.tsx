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
} from "firebase/firestore"
import { useUser } from "../context/UserContext"
import { db } from "../firebaseConfig"
import { GameState, PlayerInfo } from "@shared/types/Game" // Import shared types

const GamePage: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()
  const { userDoc, userID } = useUser()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerInfos, setPlayerInfos] = useState<PlayerInfo[]>([]) // Player list with nicknames
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null) // Track selected square
  const [hasSubmittedMove, setHasSubmittedMove] = useState<boolean>(false) // Track if player has submitted move

  // Monitor the game document by `gameID` and update state in real-time
  useEffect(() => {
    if (gameID && userID) {
      const gameDocRef = doc(db, "games", gameID)
      const unsubscribe = onSnapshot(gameDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data() as GameState
          setGameState(gameData)

          // Fetch player nicknames for all players in the game
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

          // Add the user to the game if not already in it and the game hasn't started
          if (!gameData.playerIDs.includes(userID) && !gameData.started) {
            await updateDoc(gameDocRef, {
              playerIDs: arrayUnion(userID),
            })
          }

          // Check if the player has already submitted a move for the current round
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

  // Start game by setting "started" to true
  const handleStartGame = async () => {
    if (gameState) {
      const gameDocRef = doc(db, "games", gameID!)
      await updateDoc(gameDocRef, { started: true })
    }
  }

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    if (
      gameState?.started &&
      selectedSquare === null &&
      gameState.board[index] === "" &&
      !hasSubmittedMove
    ) {
      setSelectedSquare(index)
    }
  }

  // Submit a move for the player
  const handleMoveSubmit = async () => {
    if (selectedSquare !== null && gameState && userID) {
      const moveRef = collection(db, `games/${gameID}/privateMoves`)
      const moveNumber = gameState.currentRound // Current round as the move number

      // Add the move to Firestore (create a new doc)
      await addDoc(moveRef, {
        gameID,
        moveNumber,
        playerID: userID,
        move: selectedSquare,
      })

      setSelectedSquare(null) // Reset after submission
      setHasSubmittedMove(true) // Update the state to reflect that the player has submitted a move
    }
  }

  if (!gameState) {
    return <div>Loading game...</div>
  }

  const { board, boardWidth, started, currentRound } = gameState

  // Render the grid
  const renderGrid = () => {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${boardWidth}, 50px)`,
        }}
      >
        {board.map((cell, index) => (
          <div
            key={index}
            onClick={() => handleSquareClick(index)} // Handle square click
            style={{
              width: "50px",
              height: "50px",
              border: "1px solid black",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "1.5rem",
              cursor:
                started &&
                selectedSquare === null &&
                cell === "" &&
                !hasSubmittedMove
                  ? "pointer"
                  : "not-allowed",
              backgroundColor: selectedSquare === index ? "#f0f0f0" : "white", // Change background when selected
            }}
          >
            {cell || "-"}
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
      <h4>Game Started: {started ? "Yes" : "No"}</h4>
      <h4>Turn Number: {currentRound}</h4>

      <h4>Players:</h4>
      <ul>
        {playerInfos.map((player) => (
          <li key={player.id}>
            {player.nickname}{" "}
            {gameState.hasMoved.includes(player.id) ? "(Moved)" : "(Not moved)"}
          </li>
        ))}
      </ul>

      <button onClick={handleStartGame} disabled={started}>
        Start Game
      </button>

      {hasSubmittedMove && <p>Waiting for other players...</p>}

      {selectedSquare !== null && (
        <button onClick={handleMoveSubmit}>Submit Move</button>
      )}
      {renderGrid()}
    </div>
  )
}

export default GamePage
