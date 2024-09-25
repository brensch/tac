// src/pages/GamePage.tsx

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
  Divider,
} from "@mui/material"
import { GameState, PlayerInfo, Turn } from "@shared/types/Game"
import { ArrowBack, ArrowForward, LastPage } from "@mui/icons-material"

const EmojiRain: React.FC<{ emoji: string }> = ({ emoji }) => {
  const [emojis, setEmojis] = React.useState<number[]>([])

  React.useEffect(() => {
    // Generate an array of numbers to represent emojis
    const emojiArray = Array.from({ length: 300 }, (_, i) => i)
    setEmojis(emojiArray)
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        top: -20,
        left: 0,
        width: "100%",
        height: "120%",
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
              top: `-50px`, // Start above the screen
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
                  0% { transform: translateY(0); }
                  100% { transform: translateY(120vh); }
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
  const [clashReason, setClashReason] = useState<string>("")

  // State for Rules Dialog
  const [openRulesDialog, setOpenRulesDialog] = useState(false)

  // State for Seconds Per Turn
  const [secondsPerTurn, setSecondsPerTurn] = useState<string>("10")

  // State for Time Remaining
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

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
    if (gameID && userID !== "") {
      const gameDocRef = doc(db, "games", gameID)
      const unsubscribe = onSnapshot(gameDocRef, async (docSnapshot) => {
        if (!docSnapshot.exists()) {
          setError("Game not found.")
          return
        }
        const gameData = docSnapshot.data() as GameState
        console.log("yo", gameData)
        setGameState(gameData)

        // Set boardWidth and secondsPerTurn from gameData
        setBoardWidth(
          gameData.boardWidth !== undefined
            ? gameData.boardWidth.toString()
            : "8",
        )
        setSecondsPerTurn(
          gameData.maxTurnTime !== undefined
            ? gameData.maxTurnTime.toString()
            : "10",
        )

        // Add user to the game if not already in it and game hasn't started
        if (!gameData.started && !gameData.playerIDs.includes(userID)) {
          await updateDoc(gameDocRef, {
            playerIDs: arrayUnion(userID),
          })
        }

        // Check if the player has submitted a move
        if (currentTurn) {
          setHasSubmittedMove(!!currentTurn.hasMoved[userID])
        }
      })
      return () => unsubscribe()
    }
  }, [gameID, userID])

  console.log(gameState)

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
    if (gameID && userID !== "") {
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
  }, [gameID, userID])

  // Determine if the game has started
  const gameStarted = gameState?.started

  // Start game
  const handleStartGame = async () => {
    if (gameState && gameID) {
      const gameDocRef = doc(db, "games", gameID)
      await updateDoc(gameDocRef, {
        playersReady: arrayUnion(userID), // Add the current userID to playersReady array
      })
    }
  }

  // Handle selecting a square
  const handleSquareClick = (index: number) => {
    const currentTurn = turns[turns.length - 1]
    const clash = currentTurn.clashes[index.toString()]
    if (clash) {
      handleClashClick(clash)
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
  const handleClashClick = (clash: { players: string[]; reason: string }) => {
    const players = clash.players.map(
      (id) =>
        playerInfos.find((p) => p.id === id) || {
          id,
          nickname: "Unknown",
          emoji: "",
        },
    )
    setClashPlayersList(players)
    setClashReason(clash.reason)
    setOpenClashDialog(true)
  }

  // Submit a move
  const handleMoveSubmit = async () => {
    if (selectedSquare !== null && gameState && userID && gameID) {
      const moveRef = collection(db, `games/${gameID}/privateMoves`)
      const moveNumber = currentTurn.turnNumber

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
          title: "Tactic toes",
          text: "This game is completely unrelated to toes.",
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

      if (!isNaN(newBoardWidth) && newBoardWidth >= 5 && newBoardWidth <= 20) {
        await updateDoc(gameDocRef, {
          boardWidth: newBoardWidth,
        })
      } else {
        // Handle invalid input: reset to default
        setBoardWidth("8")
        await updateDoc(gameDocRef, {
          boardWidth: 8,
        })
      }
    }
  }

  // Handle seconds per turn change
  const handleSecondsPerTurnChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setSecondsPerTurn(event.target.value)
  }

  const handleSecondsPerTurnBlur = async () => {
    if (gameID && !gameStarted) {
      const newMaxTurnTime = parseInt(secondsPerTurn, 10)
      const gameDocRef = doc(db, "games", gameID)

      if (!isNaN(newMaxTurnTime) && newMaxTurnTime > 0) {
        await updateDoc(gameDocRef, {
          maxTurnTime: newMaxTurnTime,
        })
      } else {
        // Handle invalid input: reset to default
        setSecondsPerTurn("10")
        await updateDoc(gameDocRef, {
          maxTurnTime: 10,
        })
      }
    }
  }

  const currentTurn = turns[currentTurnIndex]

  // Assuming you already have the gameID and other context from your component
  useEffect(() => {
    if (
      gameState?.winner == "" &&
      currentTurn &&
      gameState?.maxTurnTime &&
      gameID
    ) {
      const interval = setInterval(async () => {
        const now = Date.now() / 1000 // Current time in seconds
        // const startTimeSeconds = latestTurn.startTime.seconds // Start time from Firestore
        const startTimeSeconds = 1 // Start time from Firestore
        const elapsed = now - startTimeSeconds // Elapsed time since the turn started
        const remaining = Math.max(0, gameState.maxTurnTime - elapsed) // Remaining time

        setTimeRemaining(remaining) // Update your local state for the timer display

        // If time runs out, create a document in turnExpirationRequests
        if (remaining <= 0) {
          try {
            // Create a document in the games/{gameID}/turnExpirationRequests collection
            const expirationRequestsRef = collection(
              db,
              `games/${gameID}/turnExpirationRequests`,
            )

            await addDoc(expirationRequestsRef, {
              timestamp: new Date(),
              gameID: gameID,
              turnNumber: currentTurn.turnNumber, // Optional: Track the current turn number
              reason: "Turn timer expired", // Optional: Add a reason for the request
            })

            console.log(`Turn expiration request created for gameID: ${gameID}`)
          } catch (error) {
            console.error("Error creating turn expiration request:", error)
          }
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [currentTurn, gameState, gameID])

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
          const clash = clashes[index.toString()]
          const clashPlayers = clash ? clash.players : []
          const isWinningSquare = winningSquaresSet.has(index)

          return (
            <Box
              key={index}
              onClick={() => {
                if (clash) {
                  handleClashClick(clash)
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

  console.log(gameState.playersReady)

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {gameState.sessionName}
        </Typography>
        <Button
          onClick={() => setOpenRulesDialog(true)}
          sx={{ height: 30, ml: 2 }}
        >
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
              <Typography>1. Select a square by pressing it</Typography>
              <Typography>2. Press 'Submit Move'</Typography>
              <Typography>
                3. Read your opponents' minds to not pick the same square as
                them. If you fail to do this, that square will get blocked
                forever (❌)
              </Typography>
              <Typography sx={{ mb: 1 }}>
                4. Get 4 squares in a row to win
              </Typography>
            </Box>
          )}
          {gameState.nextGame !== "" && (
            <Button
              sx={{ mt: 2, zIndex: 10000000, bgcolor: "green" }}
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
                Game Over!{" "}
                {winner === "-1"
                  ? "Nobody made a move"
                  : `Winner: ${winnerInfo?.nickname || winner}`}
              </Typography>
              {/* Emoji Rain Effect */}
              {winnerEmoji && <EmojiRain emoji={winnerEmoji} />}
            </>
          ) : (
            <>
              <Button
                disabled={
                  hasSubmittedMove ||
                  !!currentTurn.hasMoved[userID] ||
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
                Submit Move ({Math.ceil(timeRemaining)}s left)
              </Button>
            </>
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
          <TextField
            label="Seconds per Turn"
            type="number"
            value={secondsPerTurn}
            onChange={handleSecondsPerTurnChange}
            onBlur={handleSecondsPerTurnBlur}
            disabled={gameStarted}
            fullWidth
            sx={{ mt: 2 }}
          />
          {parseInt(secondsPerTurn) <= 0 && (
            <Typography color="error">
              Seconds per Turn must be greater than 0
            </Typography>
          )}
        </Box>
      )}
      <TableContainer sx={{ my: 2, width: "100%" }}>
        <Table size="small" sx={{ borderCollapse: "collapse" }}>
          <TableHead>
            <TableRow>
              <TableCell>Players</TableCell>
              {gameStarted ? (
                <TableCell align="right">Time Taken</TableCell>
              ) : (
                <TableCell align="right">Ready</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {playerInfos.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.nickname} {player.emoji}
                </TableCell>
                {gameStarted ? (
                  <TableCell align="right">
                    {currentTurn?.hasMoved[player.id]?.moveTime
                      ? //   ? `${Math.round(
                        //       currentTurn.hasMoved[player.id].moveTime.seconds -
                        //         currentTurn.startTime.seconds,
                        //     )}s`
                        "yo"
                      : "Not yet"}
                  </TableCell>
                ) : (
                  <TableCell align="right">
                    {gameState.playersReady.find(
                      (readyPlayer) => readyPlayer === player.id,
                    )
                      ? "Yeah"
                      : "Nah"}
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
            Only press start once everyone has joined.
          </Typography>
          <Button fullWidth onClick={handleShare} sx={{ mb: 2 }}>
            Invite
          </Button>
          <Button
            variant={
              gameState.playersReady.find(
                (readyPlayer) => readyPlayer === userID,
              )
                ? "contained"
                : "outlined"
            }
            disabled={
              gameState.started ||
              gameState.boardWidth < 5 ||
              gameState.boardWidth > 20 ||
              parseInt(secondsPerTurn) <= 0
            }
            onClick={handleStartGame}
            sx={{ mb: 2 }}
            fullWidth
          >
            Ready
          </Button>
        </Box>
      )}

      {/* Highlight grid when waiting */}
      {currentTurn &&
        currentTurn.turnNumber === turns.length &&
        currentTurn.hasMoved[userID] && (
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
                  (player) => !currentTurn.hasMoved[player.id], // Check if player hasn't moved
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
          <DialogContentText>{clashReason}</DialogContentText>
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

      {/* Rules Dialog */}
      <Dialog open={openRulesDialog} onClose={() => setOpenRulesDialog(false)}>
        <DialogTitle>Game Rules</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Typography>1. Select a square by pressing it</Typography>
            <Typography>2. Press 'Submit Move'</Typography>
            <Typography>
              3. Read your opponents' minds to not pick the same square as them.
              If you fail to do this, that square will get blocked forever (❌)
            </Typography>
            <Typography sx={{ mb: 2 }}>
              4. Get 4 squares in a row to win
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              If more than one person wins at the same time, the squares they
              would have won with get blocked
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              If more than one person selects the same square, that square gets
              blocked
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Press on a blocked square to see the reason a square got blocked
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              You can see previous turns using the arrows below the board
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRulesDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default GamePage
