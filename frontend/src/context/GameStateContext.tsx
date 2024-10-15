// src/context/GameStateContext.tsx

import { Box } from "@mui/material"
import {
  Bot,
  GameSetup,
  GameState,
  GameType,
  Human,
  MoveStatus,
  Player,
  Session,
  Turn,
} from "@shared/types/Game"
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { EmojiCycler } from "../components/EmojiCycler"
import { db } from "../firebaseConfig"
import { useUser } from "./UserContext"

interface GameStateContextType {
  gameState: GameState | null
  turns: Turn[]
  latestTurn: Turn | null
  hasSubmittedMove: boolean
  handlePrevTurn: () => void
  handleNextTurn: () => void
  handleLatestTurn: () => void
  selectedTurn: Turn | null
  selectedTurnIndex: number
  setSelectedTurnIndex: React.Dispatch<React.SetStateAction<number>>
  selectedSquare: number | null
  setSelectedSquare: React.Dispatch<React.SetStateAction<number | null>>
  startGame: () => Promise<void>
  submitMove: (selectedSquare: number) => Promise<void>
  error: string | null
  gameID: string
  timeRemaining: number
  bots: Bot[]
  humans: Human[]
  gameType: GameType
  setGameType: React.Dispatch<React.SetStateAction<GameType>>
  players: Player[]
  sessionName: string
  gameSetup: GameSetup | null
  latestMoveStatus: MoveStatus | null
  session: Session | null
}

const GameStateContext = createContext<GameStateContextType | undefined>(
  undefined,
)

export const GameStateProvider: React.FC<{
  children: React.ReactNode
  gameID: string
  sessionName: string
}> = ({ children, gameID, sessionName }) => {
  const { userID } = useUser()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameSetup, setGameSetup] = useState<GameSetup | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [latestMoveStatus, setLatestMoveStatus] = useState<MoveStatus | null>(
    null,
  )
  const [humans, setHumans] = useState<Human[]>([])
  const [turns, setTurns] = useState<Turn[]>([])
  const [latestTurn, setLatestTurn] = useState<Turn | null>(null)
  const [hasSubmittedMove, setHasSubmittedMove] = useState<boolean>(false)
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number>(-1)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [currentTurn, setSelectedTurn] = useState<Turn | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null)
  const [bots, setBots] = useState<Bot[]>([])
  const [gameType, setGameType] = useState<GameType>("snek")

  // Use useRef to persist playersMap across renders
  const humanMapRef = useRef<{ [id: string]: Human }>({})

  // **NEW**: Use useRef to store the interval ID
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)

  // Subscribe to game document
  useEffect(() => {
    const gameDocRef = doc(db, `sessions/${sessionName}/games`, gameID)
    const unsubscribe = onSnapshot(gameDocRef, async (docSnapshot) => {
      if (!docSnapshot.exists()) {
        setError("Game not found.")
        return
      }
      const gameData = docSnapshot.data() as GameState
      setGameState(gameData)
      setTurns(gameData.turns)
      setLatestTurn(gameData.turns[gameData.turns.length - 1])
      setSelectedTurnIndex(gameData.turns.length - 1)
      setSelectedTurn(gameData.turns[gameData.turns.length - 1])
    })

    return () => unsubscribe()
  }, [gameID, sessionName])

  // Subscribe to session document
  useEffect(() => {
    const sessionDocRef = doc(db, `sessions/${sessionName}`)
    const unsubscribe = onSnapshot(sessionDocRef, async (docSnapshot) => {
      if (!docSnapshot.exists()) {
        setError("Game not found.")
        return
      }
      const session = docSnapshot.data() as Session
      setSession(session)
    })

    return () => unsubscribe()
  }, [gameID, sessionName])

  // Subscribe to game document
  useEffect(() => {
    if (!gameID || userID === "") return

    const gameDocRef = doc(db, `sessions/${sessionName}/setups`, gameID)
    const unsubscribe = onSnapshot(gameDocRef, async (docSnapshot) => {
      if (!docSnapshot.exists()) {
        setError("Game not found.")
        return
      }
      const gameData = docSnapshot.data() as GameSetup
      setGameSetup(gameData)

      // Add user to the game if not already in it and game hasn't started
      const userExists = gameData.gamePlayers.find(
        (player) => player.id === userID,
      )
      if (!gameData.started && !userExists) {
        try {
          const newGamePlayer = {
            id: userID, // userID or bot ID
            type: "human", // or "bot", depending on the player
          }
          // Update the gamePlayers array with arrayUnion to add the new player
          await updateDoc(gameDocRef, {
            gamePlayers: arrayUnion(newGamePlayer), // Use arrayUnion with the full GamePlayer object
          })
        } catch (err) {
          console.error("Error adding user to the game:", err)
          setError("Failed to join the game.")
        }
      }
    })

    return () => unsubscribe()
  }, [gameID, userID])

  // Subscribe to the "bots" collection and filter by 'gameType'
  useEffect(() => {
    if (!gameSetup?.gameType) return // Ensure gameType is available

    const botsQuery = query(
      collection(db, "bots"),
      where("capabilities", "array-contains", gameSetup.gameType), // Query bots where 'capabilities' contains 'gameType'
    )

    const unsubscribe = onSnapshot(botsQuery, (snapshot) => {
      const botsData = snapshot.docs.map((doc) => doc.data() as Bot)
      setBots(botsData)
    })

    return () => unsubscribe() // Cleanup on component unmount
  }, [gameSetup?.gameType]) // Rerun if gameType changes

  // Subscribe to player documents
  useEffect(() => {
    if (!gameSetup?.gamePlayers) return

    const newPlayerIDs = gameSetup.gamePlayers
      .filter((player) => player.type === "human")
      .map((player) => player.id)
    const unsubscribes: Record<string, () => void> = {} // Track unsubscribes by playerID

    // Handle subscription setup
    newPlayerIDs.forEach((playerID) => {
      if (!unsubscribes[playerID]) {
        // Create a new subscription if it doesn't exist for this player
        const playerDocRef = doc(db, "users", playerID)

        const unsubscribe = onSnapshot(playerDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const playerData = docSnap.data() as Human
            humanMapRef.current[playerID] = {
              id: playerID,
              name: playerData?.name || "Unknown",
              emoji: playerData.emoji || "🦍",
              colour: playerData.colour,
              createdAt: playerData.createdAt,
            }
          } else {
            // Player document was deleted or doesn't exist
            delete humanMapRef.current[playerID] // Remove the player from the map
          }

          // Update playerInfos based on the current playersMap
          setHumans(Object.values(humanMapRef.current))
        })

        unsubscribes[playerID] = unsubscribe
      }
    })

    // Clean up subscriptions for players that are no longer in playerIDs
    const currentPlayerIDs = Object.keys(humanMapRef.current)
    currentPlayerIDs.forEach((playerID) => {
      if (!newPlayerIDs.includes(playerID)) {
        // Unsubscribe and remove the player if they are no longer part of the game
        unsubscribes[playerID]?.()
        delete unsubscribes[playerID]
        delete humanMapRef.current[playerID] // Also remove from the map
      }
    })

    // Clean up all subscriptions on unmount or when gameID changes
    return () => {
      Object.values(unsubscribes).forEach((unsubscribe) => unsubscribe())
    }
  }, [gameSetup?.gamePlayers, gameID])

  // Subscribe to turns collection
  useEffect(() => {
    if (gameID && userID !== "") {
      const turnsRef = collection(
        db,
        "sessions",
        sessionName,
        "games",
        gameID,
        "moveStatuses",
      )

      // Query to get the document with the highest moveNumber
      const turnsQuery = query(
        turnsRef,
        orderBy("moveNumber", "desc"),
        limit(1),
      )

      const unsubscribe = onSnapshot(turnsQuery, (querySnapshot) => {
        if (!querySnapshot.empty) {
          const highestMoveStatus = querySnapshot.docs[0].data() as MoveStatus

          // Set the current turn index to the move number of the highest move
          setSelectedTurnIndex(highestMoveStatus.moveNumber)
          setLatestMoveStatus(highestMoveStatus)
        }
      })

      return () => unsubscribe()
    }
  }, [gameID, userID])

  // Manage current turn based on currentTurnIndex
  useEffect(() => {
    setSelectedTurn(turns[selectedTurnIndex])
  }, [turns, selectedTurnIndex, gameState])

  // Handle turn expiration
  useEffect(() => {
    // Early return if latestTurn, gameSetup, or gameID is not valid
    // also return if we have winners since no longer need to count
    if (
      !latestTurn ||
      !gameSetup?.maxTurnTime ||
      !gameID ||
      latestTurn.winners.length > 0
    ) {
      // Clear the interval if any of the dependencies are invalid
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
      return
    }

    let intervalTime = 1000 // Initial interval time

    const intervalFunction = async () => {
      const now = Date.now() / 1000 // Current time in seconds
      const endTimeSeconds =
        latestTurn.endTime instanceof Timestamp ? latestTurn.endTime.seconds : 0 // End time from Firestore
      const remaining = endTimeSeconds - now // Time remaining for the turn

      setTimeRemaining(remaining) // Update your local state for the timer display

      if (remaining > -1 || !gameState) {
        return // If there's still time remaining, continue the interval
      }

      // Check Firestore for existing expiration requests
      const expirationRequestsRef = collection(
        db,
        `sessions/${sessionName}/games/${gameID}/expirationRequests`,
      )

      // No existing expiration requests, create a new one
      await addDoc(expirationRequestsRef, {
        timestamp: new Date(),
        playerID: userID,
      })

      console.log(`Turn expiration request created for gameID: ${gameID}, `)

      // Slow down the interval after expiration to reduce resource usage
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current) // Clear the current interval
      }
      intervalTime = 10000 // Increase interval time
      intervalIdRef.current = setInterval(intervalFunction, intervalTime) // Set new interval with the updated time
    }

    // Clear any existing interval before setting a new one
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
    }

    intervalIdRef.current = setInterval(intervalFunction, intervalTime) // Set initial interval

    // Cleanup function: stop the timer when the current turn changes, nextGame is set, or gameID changes
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [latestTurn, userID, gameState, gameID, sessionName, gameSetup])

  // Function to start the game
  const startGame = async () => {
    if (gameID && gameState && !gameSetup?.started) {
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
    if (selectedTurnIndex > 0) {
      setSelectedTurnIndex(selectedTurnIndex - 1)
    }
  }

  const handleNextTurn = () => {
    if (selectedTurnIndex < turns.length - 1) {
      setSelectedTurnIndex(selectedTurnIndex + 1)
    }
  }

  const handleLatestTurn = () => {
    setSelectedTurnIndex(turns.length - 1)
  }

  // Function to submit a move
  const submitMove = async (selectedSquare: number) => {
    if (!latestTurn || !gameState || !userID || !gameID) {
      setError("Cannot submit move at this time.")
      return
    }

    const moveRef = collection(db, `games/${gameID}/privateMoves`)
    const moveNumber = gameState.turns.length - 1

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
        humans,
        turns,
        latestTurn,
        selectedTurn: currentTurn,
        selectedTurnIndex: selectedTurnIndex,
        hasSubmittedMove,
        handlePrevTurn,
        handleNextTurn,
        handleLatestTurn,
        setSelectedTurnIndex: setSelectedTurnIndex,
        selectedSquare,
        setSelectedSquare,
        startGame,
        submitMove,
        error,
        gameID,
        timeRemaining,
        bots,
        gameType,
        setGameType,
        players: [...humans, ...bots],
        sessionName,
        gameSetup,
        latestMoveStatus,
        session,
      }}
    >
      {gameSetup ? (
        children
      ) : (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh", // Full viewport height
          }}
        >
          <EmojiCycler />
        </Box>
      )}{" "}
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
