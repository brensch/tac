import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { GameState, Turn, Move } from "@shared/types/Game"

admin.initializeApp()

export const onMoveCreated = functions.firestore
  .document("games/{gameID}/privateMoves/{moveID}")
  .onCreate(async (snap, context) => {
    const moveData = snap.data() as Move
    const { gameID } = context.params

    // Log the game ID and move data
    logger.info(`Processing move for gameID: ${gameID}`, { moveData })

    const gameRef = admin.firestore().collection("games").doc(gameID)
    const gameDoc = await gameRef.get()
    const gameData = gameDoc.data() as GameState

    if (!gameData) {
      logger.error("Game not found", { gameID })
      return
    }

    // Log current game state
    logger.info("Game data retrieved", { gameData })

    const currentRound = gameData.currentRound

    // Reference to the current Turn document
    const currentTurnRef = admin
      .firestore()
      .collection(`games/${gameID}/turns`)
      .doc(currentRound.toString())

    // Update the hasMoved field atomically
    await currentTurnRef.set(
      {
        hasMoved: admin.firestore.FieldValue.arrayUnion(moveData.playerID),
      },
      { merge: true },
    )

    // Read the updated hasMoved field
    const currentTurnDoc = await currentTurnRef.get()
    let currentTurn: Turn
    if (currentTurnDoc.exists) {
      currentTurn = currentTurnDoc.data() as Turn
    } else {
      // Handle the case where the Turn document doesn't exist
      logger.error("Current Turn document does not exist.", { currentRound })
      return
    }

    const playersMoved = currentTurn.hasMoved
    logger.info(`Players moved in turn ${currentRound}`, { playersMoved })

    // Check if all players have moved
    const playerIDs = gameData.playerIDs
    const allPlayersMoved = playerIDs.every((playerID) =>
      playersMoved.includes(playerID),
    )

    logger.info(`All players moved: ${allPlayersMoved}`, {
      playerIDs,
      playersMoved,
    })

    if (allPlayersMoved) {
      // Process the moves in a transaction
      await admin.firestore().runTransaction(async (transaction) => {
        // Fetch necessary documents within transaction
        const currentTurnDoc = await transaction.get(currentTurnRef)
        const currentTurn = currentTurnDoc.data() as Turn

        // Fetch moves for the current round
        const movesRef = admin
          .firestore()
          .collection(`games/${gameID}/privateMoves`)
        const movesSnapshot = await movesRef
          .where("moveNumber", "==", currentRound)
          .get()

        const movesThisRound = movesSnapshot.docs.map(
          (doc) => doc.data() as Move,
        )

        // Log moves received in this round
        logger.info(`Moves received in round ${currentRound}`, {
          movesThisRound,
        })

        // Process moves and update the board
        const newBoard = [...currentTurn.board]
        const clashes = { ...currentTurn.clashes } // Copy previous clashes

        // Build a map of moves per square
        const moveMap: { [square: number]: string[] } = {}

        movesThisRound.forEach((move) => {
          // Check if the square is already blocked
          if (currentTurn.board[move.move] === "-1") {
            logger.info(`Square ${move.move} is blocked, move ignored`, {
              move,
            })
            return // Ignore this move
          }

          if (moveMap[move.move]) {
            moveMap[move.move].push(move.playerID)
          } else {
            moveMap[move.move] = [move.playerID]
          }
        })

        // Log move map
        logger.info("Move map for this round", { moveMap })

        // Apply moves to the board
        for (const squareStr in moveMap) {
          const square = parseInt(squareStr)
          const players = moveMap[square]

          if (players.length === 1) {
            // Only one player moved into this square
            const playerID = players[0]
            newBoard[square] = playerID // Update board with player ID
            logger.info(`Square ${square} captured by player ${playerID}`)
          } else if (players.length > 1) {
            // More than one player moved into the same square
            // Square gets blocked permanently, and neither player gets it
            newBoard[square] = "-1" // Block the square permanently
            clashes[square] = {
              players,
              reason: "Multiple players picked this square",
            }
            logger.info(
              `Square ${square} is blocked permanently due to conflict`,
              { players },
            )
          }
        }

        // Log the updated board
        logger.info("New board state", { newBoard })

        // Check for a winner
        const winLength = 4 // Number of squares in a row needed to win
        const winningPlayers = checkWinCondition(
          newBoard,
          gameData.boardWidth,
          winLength,
          playerIDs,
        )

        logger.info("Winning players", { winningPlayers })

        let winningSquares: number[] = []

        if (winningPlayers.length === 1) {
          // We have a winner
          const winner = winningPlayers[0]
          const winnerID = winner.playerID
          winningSquares = winner.winningSquares

          // Generate a new game
          const newGameData: GameState = {
            sessionName: gameData.sessionName,
            sessionIndex: gameData.sessionIndex + 1,
            playerIDs: [],
            currentRound: 0, // Start from 0 since no turns have occurred yet
            boardWidth: gameData.boardWidth,
            winner: "",
            started: false,
            nextGame: "",
          }

          const newGameRef = admin.firestore().collection("games").doc()

          // Update the game document with winner and nextGame
          transaction.update(gameRef, {
            winner: winnerID,
            nextGame: newGameRef.id,
          })

          // Create the new game document
          transaction.create(newGameRef, newGameData)

          logger.info(`Player ${winnerID} has won the game!`, { gameID })
        } else if (winningPlayers.length > 1) {
          // Multiple players won simultaneously; treat their moves as clashes

          // Build a set of player IDs who won
          const winningPlayerSet = new Set(
            winningPlayers.map((wp) => wp.playerID),
          )

          // For each move in this round, check if the player is a winning player
          movesThisRound.forEach((move) => {
            if (winningPlayerSet.has(move.playerID)) {
              const square = move.move
              // Block the square
              newBoard[square] = "-1"
              // Add to clashes
              if (!clashes[square]) {
                clashes[square] = {
                  players: Array.from(winningPlayerSet),
                  reason: "Multiple players won at the same time",
                }
              }
              logger.info(
                `Square ${square} blocked due to simultaneous win by player ${move.playerID}`,
              )
            }
          })

          logger.info(
            `Multiple players won simultaneously. Moves are treated as clashes and squares are blocked.`,
            { winningPlayers },
          )
        }

        // Create the Turn document for the next round with the new board and empty hasMoved
        const nextRound = currentRound + 1
        const nextTurnRef = admin
          .firestore()
          .collection(`games/${gameID}/turns`)
          .doc(nextRound.toString())

        const nextTurn: Turn = {
          turnNumber: nextRound,
          board: newBoard,
          hasMoved: [],
          clashes: clashes, // Include the calculated clashes
          winningSquares: winningSquares,
        }

        transaction.set(nextTurnRef, nextTurn)

        // Increment the currentRound in the game document
        transaction.update(gameRef, {
          currentRound: nextRound,
        })

        // Log round update
        logger.info(
          `Round ${currentRound} completed. Moved to round ${nextRound}`,
          {
            gameID,
          },
        )
      })
    } else {
      // Not all players have moved yet
      logger.info(`Waiting for other players to move`, {
        currentPlayersMoved: playersMoved,
        requiredPlayers: playerIDs,
      })
    }
  })

// Function to check for a win condition
function checkWinCondition(
  board: string[],
  boardWidth: number,
  winLength: number,
  playerIDs: string[],
): { playerID: string; winningSquares: number[] }[] {
  const winningPlayers: { playerID: string; winningSquares: number[] }[] = []

  playerIDs.forEach((playerID) => {
    const result = hasPlayerWon(board, boardWidth, winLength, playerID)
    if (result.hasWon) {
      winningPlayers.push({ playerID, winningSquares: result.winningSquares })
    }
  })

  return winningPlayers
}

// Helper function to check if a player has won
function hasPlayerWon(
  board: string[],
  boardWidth: number,
  winLength: number,
  playerID: string,
): { hasWon: boolean; winningSquares: number[] } {
  const size = boardWidth

  // Direction vectors: right, down, down-right, down-left
  const directions = [
    { x: 1, y: 0 }, // Horizontal
    { x: 0, y: 1 }, // Vertical
    { x: 1, y: 1 }, // Diagonal down-right
    { x: -1, y: 1 }, // Diagonal down-left
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const dir of directions) {
        let count = 0
        let winningSquares: number[] = []
        let dx = x
        let dy = y

        while (
          dx >= 0 &&
          dx < size &&
          dy >= 0 &&
          dy < size &&
          board[dy * size + dx] === playerID
        ) {
          winningSquares.push(dy * size + dx)
          count++
          if (count === winLength) {
            return { hasWon: true, winningSquares }
          }
          dx += dir.x
          dy += dir.y
        }
      }
    }
  }

  return { hasWon: false, winningSquares: [] }
}

export const onGameStarted = functions.firestore
  .document("games/{gameID}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() as GameState
    const afterData = change.after.data() as GameState
    const { gameID } = context.params

    // Check if 'started' changed from false to true
    if (!beforeData.started && afterData.started) {
      logger.info(`Game ${gameID} has started`)

      const boardWidth = afterData.boardWidth
      const boardSize = boardWidth * boardWidth

      // Initialize an empty board
      const initialBoard = Array(boardSize).fill("")

      // Create the Turn 1 document
      const turnRef = admin
        .firestore()
        .collection(`games/${gameID}/turns`)
        .doc("1")

      const firstTurn: Turn = {
        turnNumber: 1,
        board: initialBoard,
        hasMoved: [],
        clashes: {},
      }

      // Set the currentRound to 1 in the game document
      const gameRef = admin.firestore().collection("games").doc(gameID)

      // Use a transaction to ensure consistency
      await admin.firestore().runTransaction(async (transaction) => {
        transaction.set(turnRef, firstTurn)
        transaction.update(gameRef, { currentRound: 1 })
      })

      logger.info(`Turn 1 created for game ${gameID}`)
    }
  })
