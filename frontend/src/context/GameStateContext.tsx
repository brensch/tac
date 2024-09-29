// src/context/GameStateContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react"
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "../firebaseConfig"
import { useUser } from "./UserContext"
import { GameState, Move, PlayerInfo, Turn } from "@shared/types/Game"

interface GameStateContextType {
  gameState: GameState | null
  playerInfos: PlayerInfo[]
  turns: Turn[]
  latestTurn: Turn | undefined
  currentTurn: Turn | undefined
  currentTurnIndex: number
  hasSubmittedMove: boolean
  handlePrevTurn: () => void
  handleNextTurn: () => void
  handleLatestTurn: () => void
  setCurrentTurnIndex: React.Dispatch<React.SetStateAction<number>>
  selectedSquare: number | null
  setSelectedSquare: React.Dispatch<React.SetStateAction<number | null>>
  startGame: () => Promise<void>
  submitMove: (selectedSquare: number) => Promise<void>
  error: string | null
  gameID: string
  timeRemaining: number
}

const GameStateContext = createContext<GameStateContextType | undefined>(
  undefined,
)

export const GameStateProvider: React.FC<{
  children: React.ReactNode
  gameID: string
}> = ({ children, gameID }) => {
  const { userID } = useUser()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerInfos, setPlayerInfos] = useState<PlayerInfo[]>([])
  const [turns, setTurns] = useState<Turn[]>([])
  const [latestTurn, setLatestTurn] = useState<Turn | undefined>(undefined)
  const [hasSubmittedMove, setHasSubmittedMove] = useState<boolean>(false)
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(-1)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [currentTurn, setCurrentTurn] = useState<Turn | undefined>()
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null)

  // Use useRef to persist playersMap across renders
  const playersMapRef = useRef<{ [id: string]: PlayerInfo }>({})

  // Subscribe to game document
  useEffect(() => {
    if (gameID && userID !== "") {
      const gameDocRef = doc(db, "games", gameID)
      const unsubscribe = onSnapshot(gameDocRef, async (docSnapshot) => {
        if (!docSnapshot.exists()) {
          setError("Game not found.")
          return
        }
        const gameData = docSnapshot.data() as GameState
        setGameState(gameData)

        // Add user to the game if not already in it and game hasn't started
        if (!gameData.started && !gameData.playerIDs.includes(userID)) {
          try {
            await updateDoc(gameDocRef, {
              playerIDs: arrayUnion(userID),
            })
          } catch (err) {
            console.error("Error adding user to the game:", err)
            setError("Failed to join the game.")
          }
        }
      })

      return () => unsubscribe()
    }
  }, [gameID, userID])

  // Subscribe to player documents
  useEffect(() => {
    if (gameState?.playerIDs) {
      const unsubscribes: (() => void)[] = []

      gameState.playerIDs.forEach((playerID) => {
        const playerDocRef = doc(db, "users", playerID)

        const unsubscribe = onSnapshot(playerDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const playerData = docSnap.data() as PlayerInfo
            playersMapRef.current[playerID] = {
              id: playerID,
              nickname: playerData?.nickname || "Unknown",
              emoji: playerData.emoji || "🦍",
              colour: playerData.colour,
            }
          } else {
            playersMapRef.current[playerID] = {
              id: playerID,
              nickname: "Unknown",
              emoji: "🦍",
              colour: "#222222",
            }
          }
          // Update playerInfos based on the current playersMap
          setPlayerInfos(Object.values(playersMapRef.current))
        })

        unsubscribes.push(unsubscribe)
      })

      return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe())
      }
    }
  }, [gameState?.playerIDs, gameID])

  // Subscribe to turns collection
  useEffect(() => {
    if (gameID && userID !== "") {
      const turnsRef = collection(db, "games", gameID, "turns")
      const turnsQuery = query(turnsRef, orderBy("turnNumber", "asc"))

      const unsubscribe = onSnapshot(turnsQuery, (querySnapshot) => {
        const turnsList: Turn[] = querySnapshot.docs.map(
          (doc) => doc.data() as Turn,
        )

        setTurns(turnsList)
        setLatestTurn(turnsList[turnsList.length - 1])
        setHasSubmittedMove(!!turnsList[turnsList.length - 1]?.hasMoved[userID])

        setCurrentTurnIndex(turnsList.length - 1)
      })

      return () => unsubscribe()
    }
  }, [gameID, userID])

  // Manage current turn based on currentTurnIndex
  useEffect(() => {
    setCurrentTurn(turns[currentTurnIndex])
  }, [turns, currentTurnIndex])

  // Handle turn expiration
  useEffect(() => {
    if (
      !latestTurn ||
      (gameState?.winners.length && gameState?.winners.length > 0) || // Updated condition
      !currentTurn ||
      !gameState?.maxTurnTime ||
      !gameID
    )
      return

    let intervalTime = 100 // Initial interval time
    let intervalId: NodeJS.Timeout

    const intervalFunction = async () => {
      const now = Date.now() / 1000 // Current time in seconds
      const endTimeSeconds = latestTurn.endTime.seconds // End time from Firestore
      const remaining = endTimeSeconds - now // Time remaining for the turn

      setTimeRemaining(remaining) // Update your local state for the timer display

      if (remaining > -1) {
        return
      }
      // If the time runs out, check Firestore for existing expiration requests
      const expirationRequestsRef = collection(
        db,
        `games/${gameID}/turns/${latestTurn.turnNumber}/expirationRequests`,
      )

      // No existing expiration requests, create a new one
      await addDoc(expirationRequestsRef, {
        timestamp: new Date(),
        playerID: userID,
      })

      console.log(`Turn expiration request created for gameID: ${gameID}`)

      // Slow down the interval after expiration to reduce resource usage
      clearInterval(intervalId) // Clear the current interval
      intervalTime = 3000 // Increase interval time
      intervalId = setInterval(intervalFunction, intervalTime) // Set new interval with the updated time
    }

    intervalId = setInterval(intervalFunction, intervalTime) // Set initial interval

    return () => clearInterval(intervalId) // Cleanup on unmount or dependency change
  }, [latestTurn, userID, currentTurn, gameState, gameID])

  // Function to start the game
  const startGame = async () => {
    if (gameID && gameState && !gameState.started) {
      const gameDocRef = doc(db, "games", gameID)
      try {
        await updateDoc(gameDocRef, {
          started: true,
          firstPlayerReadyTime: serverTimestamp(),
        })
      } catch (err) {
        console.error("Error starting the game:", err)
        setError("Failed to start the game.")
      }
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

  // Function to submit a move
  const submitMove = async (selectedSquare: number) => {
    if (!latestTurn || !gameState || !userID || !gameID) {
      setError("Cannot submit move at this time.")
      return
    }

    const moveRef = collection(db, `games/${gameID}/privateMoves`)
    const moveNumber = latestTurn.turnNumber

    try {
      await addDoc(moveRef, {
        gameID,
        moveNumber,
        playerID: userID,
        move: selectedSquare,
        timestamp: serverTimestamp(),
      })
      setHasSubmittedMove(true)
    } catch (err) {
      console.error("Error submitting move:", err)
      setError("Failed to submit move.")
    }
  }

  return (
    <GameStateContext.Provider
      value={{
        gameState,
        playerInfos,
        turns,
        latestTurn,
        currentTurn,
        currentTurnIndex,
        hasSubmittedMove,
        handlePrevTurn,
        handleNextTurn,
        handleLatestTurn,
        setCurrentTurnIndex,
        selectedSquare,
        setSelectedSquare,
        startGame,
        submitMove,
        error,
        gameID,
        timeRemaining,
      }}
    >
      {children}
    </GameStateContext.Provider>
  )
}

export const useGameStateContext = (): GameStateContextType => {
  const context = useContext(GameStateContext)
  if (!context) {
    throw new Error(
      "useGameStateContext must be used within a GameStateProvider",
    )
  }
  return context
}
