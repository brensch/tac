import React, { useEffect, useState, useRef, useLayoutEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
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
  CircularProgress,
  IconButton,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
} from "@mui/material"
import { GameState, PlayerInfo } from "@shared/types/Game"
import { ArrowBack, ArrowForward, LastPage } from "@mui/icons-material"

export interface Turn {
  turnNumber: number
  board: string[] // The board state after this turn
  hasMoved: string[] // List of player IDs who have submitted their move for this turn
  clashes: { [square: string]: string[] } // Map of square indices to player IDs who clashed
  winningSquares?: number[] // The list of squares involved in a winning condition
}

const EmojiRain: React.FC<{ emoji: string }> = ({ emoji }) => {
  const [emojis, setEmojis] = React.useState<number[]>([])

  React.useEffect(() => {
    // Generate an array of numbers to represent emojis
    const emojiArray = Array.from({ length: 100 }, (_, i) => i)
    setEmojis(emojiArray)
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      {emojis.map((i) => {
        const left = Math.random() * 100 // Random left position
        const delay = Math.random() * 5 // Random animation delay
        const duration = Math.random() * 5 + 5 // Random animation duration between 5s and 10s
        const size = Math.random() * 24 + 24 // Random size between 24px and 48px

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "-50px",
              left: `${left}%`,
              fontSize: `${size}px`,
              animation: `fall ${duration}s linear ${delay}s infinite`,
            }}
          >
            {emoji}
          </div>
        )
      })}
      <style>
        {`
          @keyframes fall {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(100vh); opacity: 0; }
          }
        `}
      </style>
    </div>
  )
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
  const navigate = useNavigate()

  // New ref and state for dynamic font sizing
  const gridRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  // State for Clash Dialog
  const [openClashDialog, setOpenClashDialog] = useState(false)
  const [clashPlayersList, setClashPlayersList] = useState<PlayerInfo[]>([])

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
  }, [gameState?.boardWidth, currentTurnIndex])

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
    const currentTurn = turns[turns.length - 1]
    const clashPlayers = currentTurn.clashes[index.toString()] || []
    if (clashPlayers.length > 0) {
      handleClashClick(clashPlayers)
      return
    }

    if (gameStarted && !hasSubmittedMove) {
      if (!currentTurn) {
        console.error("No turns available")
        return
      }

      const cellValue = currentTurn.board[index]

      if (cellValue === "" || cellValue === null) {
        setSelectedSquare(index)
      }
    }
  }

  // Handle clash click
  const handleClashClick = (clashPlayerIDs: string[]) => {
    const players = clashPlayerIDs.map(
      (id) =>
        playerInfos.find((p) => p.id === id) || {
          id,
          nickname: "Unknown",
          emoji: "",
        },
    )
    setClashPlayersList(players)
    setOpenClashDialog(true)
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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Play tactic toes with me",
          text: "It's nothing to do with toes.",
          url: `/session/${gameState?.sessionName}`,
        })
        console.log("Content shared successfully")
      } catch (error) {
        console.error("Error sharing content:", error)
      }
    } else {
      console.log("Web Share API is not supported in your browser.")
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
  console.log(gameState)
  console.log(currentTurn)

  // Render the grid
  const renderGrid = () => {
    if (!currentTurn) {
      return <Typography>Loading board...</Typography>
    }

    const { board, clashes, winningSquares } = currentTurn
    const gridSize = gameState.boardWidth || 8 // Default to 8 if undefined
    const winningSquaresSet = new Set(winningSquares || [])

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
          const isWinningSquare = winningSquaresSet.has(index)

          return (
            <Box
              key={index}
              onClick={() => {
                if (clashPlayers.length > 0) {
                  handleClashClick(clashPlayers)
                } else {
                  handleSquareClick(index)
                }
              }}
              sx={{
                width: "100%",
                paddingBottom: "100%", // Maintain aspect ratio
                position: "relative",
                border: "1px solid black",
                cursor:
                  gameStarted && !hasSubmittedMove && isCellEmpty && !isBlocked
                    ? "pointer"
                    : "default",
                backgroundColor: isWinningSquare
                  ? "green"
                  : isSelected
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
                  ? playerInfos.find((p) => p.id === cell)?.emoji || cell[0]
                  : clashPlayers.length > 0
                  ? clashPlayers
                      .map(
                        (playerID) =>
                          playerInfos.find((p) => p.id === playerID)?.emoji ||
                          "",
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

  const playerInCurrentGame = gameState.playerIDs.find(
    (playerID) => playerID === userID,
  )

  const winnerInfo = playerInfos.find((p) => p.id === winner)
  const winnerEmoji = winnerInfo?.emoji || ""

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {gameState.sessionName}
        </Typography>
        <Button onClick={handleShare} sx={{ height: 30, ml: 2 }}>
          Rules
        </Button>
        <Button onClick={handleShare} sx={{ height: 30, ml: 2 }}>
          Invite
        </Button>
      </Box>

      {gameStarted ? (
        <>
          {turns.length === 1 && (
            <Box sx={{ mt: 2 }}>
              <Typography>1. Select a square by touching it</Typography>
              <Typography>2. Press Submit Move</Typography>
              <Typography>
                3. Read your opponents' minds to not pick the same square as
                them
              </Typography>
              <Typography sx={{ mb: 1 }}>
                4. Get 4 squares in a row to win
              </Typography>
            </Box>
          )}
          {gameState.nextGame !== "" && (
            <Button
              sx={{ mt: 2 }}
              fullWidth
              onClick={() => navigate(`/game/${gameState.nextGame}`)}
            >
              Play again?
            </Button>
          )}
          {!playerInCurrentGame && (
            <Alert sx={{ mt: 2 }} severity="warning">
              This game started before you joined. Watch until the next game
              starts.
            </Alert>
          )}
          {winner ? (
            <>
              <Typography variant="h5" color="primary" sx={{ my: 2 }}>
                Game Over! Winner: {winnerInfo?.nickname || winner}
              </Typography>
              {/* Emoji Rain Effect */}
              {winnerEmoji && <EmojiRain emoji={winnerEmoji} />}
            </>
          ) : (
            <Button
              disabled={
                hasSubmittedMove ||
                currentTurn.hasMoved.includes(userID) ||
                !playerInCurrentGame ||
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
          <Typography variant="h5" sx={{ mb: 2 }}>
            New Game{" "}
          </Typography>
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
      <TableContainer sx={{ my: 2, width: "100%" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Players</TableCell>
              {gameStarted && <TableCell align="right">Has Moved</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {playerInfos.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.nickname} {player.emoji}
                </TableCell>
                {gameStarted && (
                  <TableCell align="right">
                    {currentTurn?.hasMoved.includes(player.id) ? "Yes" : "No"}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!gameStarted && (
        <Box>
          <Typography sx={{ mb: 2 }}>
            Only press start once everyone has joined, or they'll have to wait
            for the next game.
          </Typography>
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
        </Box>
      )}

      {/* Highlight grid when waiting */}
      {currentTurn &&
        currentTurn.turnNumber === turns.length &&
        currentTurn.hasMoved.includes(userID) && (
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
              Waiting for
              <br />
              {playerInfos
                .filter(
                  (player) => !currentTurn.hasMoved.includes(player.id), // Check if player hasn't moved
                )
                .map((player, index) => (
                  <React.Fragment key={player.id}>
                    {player.nickname}
                    {index < playerInfos.length - 1 && <br />}
                  </React.Fragment>
                ))}
            </Typography>
          </Box>
        )}

      {/* Clash Dialog */}
      <Dialog open={openClashDialog} onClose={() => setOpenClashDialog(false)}>
        <DialogTitle>Clash Details</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Players who clashed over this square:
          </DialogContentText>
          <List>
            {clashPlayersList.map((player) => (
              <ListItem key={player.id}>
                <ListItemText primary={`${player.nickname} ${player.emoji}`} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenClashDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default GamePage
