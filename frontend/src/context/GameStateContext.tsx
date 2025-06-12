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
  and,
  arrayUnion,
  collection,
  doc,
  DocumentSnapshot,
  limit,
  onSnapshot,
  or,
  orderBy,
  query,
  QuerySnapshot,
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
  latestTurn: Turn | null
  hasSubmittedMove: boolean
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
  connectivityStatus: 'connected' | 'disconnected'
  queryTimedOut: boolean
}

const GameStateContext = createContext<GameStateContextType | undefined>(
  undefined,
)

const queryMaxDuration = 2000

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
  const [latestTurn, setLatestTurn] = useState<Turn | null>(null)
  const [hasSubmittedMove, setHasSubmittedMove] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null)
  const [bots, setBots] = useState<Bot[]>([])
  const [gameType, setGameType] = useState<GameType>("snek")
  const [connectivityStatus, setConnectivityStatus] = useState<'connected' | 'disconnected'>('connected')
  const [queryTimedOut, setQueryTimedOut] = useState<boolean>(false)

  const humanMapRef = useRef<{ [id: string]: Human }>({})
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const initialGameIDRef = useRef(gameID)

  // Helper function to update connectivity status based on snapshot metadata
  const updateConnectivityStatus = (snapshot: DocumentSnapshot | QuerySnapshot) => {
    const isConnected = !snapshot.metadata.fromCache
    setConnectivityStatus(isConnected ? 'connected' : 'disconnected')
  }

  // Subscribe to game document
  useEffect(() => {
    const gameDocRef = doc(db, `sessions/${sessionName}/games`, gameID)
    let timeoutId: NodeJS.Timeout | null = null

    const startQueryTimeout = () => {
      timeoutId = setTimeout(() => {
        setQueryTimedOut(true)
        setError("Loading game data is taking longer than usual.")
      }, queryMaxDuration)
    }

    const clearQueryTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    startQueryTimeout()

    const unsubscribe = onSnapshot(
      gameDocRef,
      { includeMetadataChanges: true },
      (docSnapshot) => {
        updateConnectivityStatus(docSnapshot)

        if (!docSnapshot.exists()) {
          setError("Game not found.")
          return
        }

        const gameData = docSnapshot.data() as GameState
        setGameState(gameData)
        setLatestTurn(gameData.turns[gameData.turns.length - 1])

        if (!docSnapshot.metadata.fromCache) {
          clearQueryTimeout()
          setQueryTimedOut(false)
        }
      },
      (error) => {
        console.error("Error in game subscription:", error)
        setError("An error occurred while fetching game updates.")
        clearQueryTimeout()
      }
    )
    return () => {
      unsubscribe()
      clearQueryTimeout()
    }
  }, [gameID, sessionName])

  // Subscribe to session document
  useEffect(() => {
    const sessionDocRef = doc(db, `sessions/${sessionName}`)
    let timeoutId: NodeJS.Timeout | null = null

    const startQueryTimeout = () => {
      timeoutId = setTimeout(() => {
        setQueryTimedOut(true)
        setError("Loading session data is taking longer than usual.")
      }, queryMaxDuration)
    }

    const clearQueryTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    startQueryTimeout()

    const unsubscribe = onSnapshot(
      sessionDocRef,
      { includeMetadataChanges: true },
      (docSnapshot) => {
        updateConnectivityStatus(docSnapshot)

        if (!docSnapshot.exists()) {
          setError("Session not found.")
          return
        }

        const sessionData = docSnapshot.data() as Session
        setSession(sessionData)

        if (!docSnapshot.metadata.fromCache) {
          clearQueryTimeout()
          setQueryTimedOut(false)
        }
      },
      (error) => {
        console.error("Error in session subscription:", error)
        setError("An error occurred while fetching session updates.")
        clearQueryTimeout()
      }
    )
    return () => {
      unsubscribe()
      clearQueryTimeout()
    }
  }, [sessionName])

  // Subscribe to game setup
  useEffect(() => {
    if (!gameID || userID === "") return
    const gameDocRef = doc(db, `sessions/${sessionName}/setups`, gameID)
    let timeoutId: NodeJS.Timeout | null = null

    const startQueryTimeout = () => {
      timeoutId = setTimeout(() => {
        setQueryTimedOut(true)
        setError("Loading game setup is taking longer than usual.")
      }, queryMaxDuration)
    }

    const clearQueryTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    startQueryTimeout()

    const unsubscribe = onSnapshot(
      gameDocRef,
      { includeMetadataChanges: true },
      async (docSnapshot) => {
        updateConnectivityStatus(docSnapshot)

        if (!docSnapshot.exists()) {
          setError("Game setup not found.")
          return
        }

        const gameData = docSnapshot.data() as GameSetup
        setGameSetup(gameData)

        if (!docSnapshot.metadata.fromCache) {
          clearQueryTimeout()
          setQueryTimedOut(false)
        }

        const userExists = gameData.gamePlayers.find(
          (player) => player.id === userID,
        )
        if (!gameData.started && !userExists) {
          try {
            const newGamePlayer = {
              id: userID,
              type: "human",
            }
            await updateDoc(gameDocRef, {
              gamePlayers: arrayUnion(newGamePlayer),
            })
          } catch (err) {
            console.error("Error adding user to the game:", err)
            setError("Failed to join the game.")
          }
        }
      },
      (error) => {
        console.error("Error in game setup subscription:", error)
        setError("An error occurred while fetching game setup.")
        clearQueryTimeout()
      }
    )
    return () => {
      unsubscribe()
      clearQueryTimeout()
    }
  }, [gameID, userID, sessionName])

  // Subscribe to the "bots" collection
  useEffect(() => {
    if (!gameSetup?.gameType) return
    const botsQuery = query(
      collection(db, "bots"),
      and(
        where("capabilities", "array-contains", gameSetup.gameType),
        or(
          where("public", "==", true),
          where("owner", "==", userID)
        )
      )
    )
    let timeoutId: NodeJS.Timeout | null = null

    const startQueryTimeout = () => {
      timeoutId = setTimeout(() => {
        setQueryTimedOut(true)
        setError("Loading bots data is taking longer than usual.")
      }, queryMaxDuration)
    }

    const clearQueryTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    startQueryTimeout()

    const unsubscribe = onSnapshot(
      botsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        updateConnectivityStatus(snapshot)

        const botsData = snapshot.docs.map((doc) => doc.data() as Bot)
        setBots(botsData)

        if (!snapshot.metadata.fromCache) {
          clearQueryTimeout()
          setQueryTimedOut(false)
        }
      },
      (error) => {
        console.error("Error in bots subscription:", error)
        setError("An error occurred while fetching bots data.")
        clearQueryTimeout()
      }
    )
    return () => {
      unsubscribe()
      clearQueryTimeout()
    }
  }, [gameSetup?.gameType])

  // Subscribe to player documents
  useEffect(() => {
    if (!gameSetup?.gamePlayers) return

    const unsubscribes: Record<string, () => void> = {}
    const humanMap = humanMapRef.current

    const playerIDs = gameSetup.gamePlayers
      .filter((player) => player.type === "human")
      .map((player) => player.id)

    playerIDs.forEach((playerID) => {
      if (!unsubscribes[playerID]) {
        const playerDocRef = doc(db, "users", playerID)
        let timeoutId: NodeJS.Timeout | null = null

        const startQueryTimeout = () => {
          timeoutId = setTimeout(() => {
            setQueryTimedOut(true)
            setError("Loading player data is taking longer than usual.")
          }, queryMaxDuration)
        }

        const clearQueryTimeout = () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        }

        startQueryTimeout()

        const unsubscribe = onSnapshot(
          playerDocRef,
          { includeMetadataChanges: true },
          (docSnap) => {
            updateConnectivityStatus(docSnap)

            if (docSnap.exists()) {
              const playerData = docSnap.data() as Human
              humanMap[playerID] = {
                id: playerID,
                name: playerData?.name || "Unknown",
                emoji: playerData.emoji || "🦍",
                colour: playerData.colour,
                createdAt: playerData.createdAt,
              }
            } else {
              delete humanMap[playerID]
            }
            setHumans(Object.values(humanMap))

            if (!docSnap.metadata.fromCache) {
              clearQueryTimeout()
              setQueryTimedOut(false)
            }
          },
          (error) => {
            console.error(`Error in player subscription for ${playerID}:`, error)
            setError("An error occurred while fetching player updates.")
            clearQueryTimeout()
          }
        )

        unsubscribes[playerID] = () => {
          unsubscribe()
          clearQueryTimeout()
        }
      }
    })

    return () => {
      Object.values(unsubscribes).forEach((unsubscribe) => unsubscribe())
    }
  }, [gameSetup?.gamePlayers])

  // Subscribe to moveStatuses collection
  useEffect(() => {
    if (!gameID || userID === "") return

    const moveStatusesRef = collection(
      db,
      "sessions",
      sessionName,
      "games",
      gameID,
      "moveStatuses",
    )

    const moveStatusesQuery = query(
      moveStatusesRef,
      orderBy("moveNumber", "desc"),
      limit(1),
    )
    let timeoutId: NodeJS.Timeout | null = null

    const startQueryTimeout = () => {
      timeoutId = setTimeout(() => {
        setQueryTimedOut(true)
        setError("Loading move status data is taking longer than usual.")
      }, queryMaxDuration)
    }

    const clearQueryTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    startQueryTimeout()

    const unsubscribe = onSnapshot(
      moveStatusesQuery,
      { includeMetadataChanges: true },
      (querySnapshot) => {
        updateConnectivityStatus(querySnapshot)

        if (!querySnapshot.empty) {
          const highestMoveStatus = querySnapshot.docs[0].data() as MoveStatus
          setLatestMoveStatus(highestMoveStatus)
        }

        if (!querySnapshot.metadata.fromCache) {
          clearQueryTimeout()
          setQueryTimedOut(false)
        }
      },
      (error) => {
        console.error("Error in move status subscription:", error)
        setError("An error occurred while fetching move updates.")
        clearQueryTimeout()
      }
    )

    return () => {
      unsubscribe()
      clearQueryTimeout()
    }
  }, [gameID, userID, sessionName])

  // Timer effect
  useEffect(() => {
    const shouldClearInterval = () => {
      if (
        !latestTurn ||
        !gameSetup?.maxTurnTime ||
        !gameID ||
        latestTurn.winners.length > 0 ||
        gameID !== initialGameIDRef.current
      ) {
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current)
          intervalIdRef.current = null
        }
        return true
      }
      return false
    }

    if (shouldClearInterval()) {
      return
    }

    let intervalTime = 1000

    const intervalFunction = async () => {
      if (shouldClearInterval()) {
        return
      }

      const now = Date.now() / 1000
      const endTimeSeconds =
        latestTurn?.endTime instanceof Timestamp
          ? latestTurn.endTime.seconds
          : 0
      const remaining = endTimeSeconds - now

      setTimeRemaining(remaining)

      // if (remaining > -1 || !gameState) {
      //   return
      // }

      // const expirationRequestsRef = collection(
      //   db,
      //   `sessions/${sessionName}/games/${gameID}/expirationRequests`,
      // )

      // await addDoc(expirationRequestsRef, {
      //   timestamp: new Date(),
      //   playerID: userID,
      // })

      // console.log(`Turn expiration request created for gameID: ${gameID}`)

      // if (intervalIdRef.current) {
      //   clearInterval(intervalIdRef.current)
      // }
      // intervalTime = 10000
      // intervalIdRef.current = setInterval(intervalFunction, intervalTime)
    }

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current)
    }

    intervalIdRef.current = setInterval(intervalFunction, intervalTime)

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

  const providerValue: GameStateContextType = {
    gameState,
    humans,
    latestTurn,
    hasSubmittedMove,
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
    connectivityStatus,
    queryTimedOut,
  }

  return (
    <GameStateContext.Provider value={providerValue}>
      {gameSetup ? (
        children
      ) : (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <EmojiCycler />
        </Box>
      )}
    </GameStateContext.Provider>
  )
}

export const useGameStateContext = (): GameStateContextType => {
  const context = useContext(GameStateContext)
  if (!context) {
    throw new Error(
      "useGameStateContext must be used within a GameStateProvider"
    )
  }
  return context
}
