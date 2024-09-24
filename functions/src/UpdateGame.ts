// functions/src/index.ts

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { GameState, Turn, Move } from "./types/Game" // Adjust the import path as necessary

admin.initializeApp()

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

// Main function to process a turn
async function processTurn(
  transaction: FirebaseFirestore.Transaction,
  gameID: string,
  gameData: GameState,
  currentTurn: Turn,
  currentTurnRef: FirebaseFirestore.DocumentReference,
) {
  const currentRound = gameData.currentRound

  // Fetch moves for the current round
  const movesRef = admin.firestore().collection(`games/${gameID}/privateMoves`)
  const movesSnapshot = await movesRef
    .where("moveNumber", "==", currentRound)
    .get()

  const movesThisRound = movesSnapshot.docs.map((doc) => doc.data() as Move)

  // Log moves received in this round
  logger.info(`Moves received in round ${currentRound}`, {
    movesThisRound,
  })

  // if no one moved, set winner to -1 (nobody won)
  if (movesThisRound.length === 0) {
    // No moves were made this round
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
      maxTurnTime: gameData.maxTurnTime,
    }

    const newGameRef = admin.firestore().collection("games").doc()
    transaction.create(newGameRef, newGameData)

    // Update the game document with winner and nextGame
    // Update the game document to set winner to "-1"

    transaction.update(admin.firestore().collection("games").doc(gameID), {
      winner: "-1",
      nextGame: newGameRef.id,
    })
    logger.info("No moves this round. Winner set to -1", { gameID })

    // Return from the function to prevent further processing
    return
  }

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
      logger.info(`Square ${square} is blocked permanently due to conflict`, {
        players,
      })
    }
  }

  // Log the updated board
  logger.info("New board state", { newBoard })

  // Check for a winner
  const winLength = 4 // Number of squares in a row needed to win
  const playerIDs = gameData.playerIDs
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
      maxTurnTime: gameData.maxTurnTime,
    }

    const newGameRef = admin.firestore().collection("games").doc()

    // Update the game document with winner and nextGame
    transaction.update(admin.firestore().collection("games").doc(gameID), {
      winner: winnerID,
      nextGame: newGameRef.id,
    })

    // Create the new game document
    transaction.create(newGameRef, newGameData)

    logger.info(`Player ${winnerID} has won the game!`, { gameID })
  } else if (winningPlayers.length > 1) {
    // Multiple players won simultaneously; treat their moves as clashes

    // Build a set of player IDs who won
    const winningPlayerSet = new Set(winningPlayers.map((wp) => wp.playerID))

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
    hasMoved: {},
    clashes: clashes, // Include the calculated clashes
    winningSquares: winningSquares,
    startTime: admin.firestore.Timestamp.now(),
  }

  transaction.set(nextTurnRef, nextTurn)

  // Increment the currentRound in the game document
  transaction.update(admin.firestore().collection("games").doc(gameID), {
    currentRound: nextRound,
  })

  // Log round update
  logger.info(`Round ${currentRound} completed. Moved to round ${nextRound}`, {
    gameID,
  })
}

export const onMoveCreated = functions.firestore
  .document("games/{gameID}/privateMoves/{moveID}")
  .onCreate(async (snap, context) => {
    const moveData = snap.data() as Move
    const { gameID } = context.params

    logger.info(`Processing move for gameID: ${gameID}`, { moveData })

    const gameRef = admin.firestore().collection("games").doc(gameID)
    const gameDoc = await gameRef.get()
    const gameData = gameDoc.data() as GameState

    if (!gameData) {
      logger.error("Game not found", { gameID })
      return
    }

    const currentRound = gameData.currentRound

    // Reference to the current Turn document
    const currentTurnRef = admin
      .firestore()
      .collection(`games/${gameID}/turns`)
      .doc(currentRound.toString())

    const currentTurnDoc = await currentTurnRef.get()
    if (!currentTurnDoc.exists) {
      logger.error("Current Turn document does not exist.", { currentRound })
      return
    }

    const currentTurn = currentTurnDoc.data() as Turn

    // Use the moveData.timestamp to check when the move was created
    const moveTimestamp = moveData.timestamp
    const turnStartTimestamp = currentTurn.startTime
    const elapsedSeconds = moveTimestamp.seconds - turnStartTimestamp.seconds

    // Check if the move was created after the turn has expired
    if (
      elapsedSeconds >= gameData.maxTurnTime ||
      moveData.moveNumber !== currentTurn.turnNumber
    ) {
      logger.info(
        `Move received too late for turn ${currentRound}. Ignoring move.`,
        { moveData },
      )
      return // Ignore the move
    }

    await admin.firestore().runTransaction(async (transaction) => {
      // Update hasMoved
      const hasMoved = currentTurn.hasMoved || {}
      hasMoved[moveData.playerID] = {
        moveTime: moveTimestamp,
      }
      transaction.update(currentTurnRef, { hasMoved })

      const playersMoved = Object.keys(hasMoved)
      const allPlayersMoved = gameData.playerIDs.every((playerID) =>
        playersMoved.includes(playerID),
      )

      const now = admin.firestore.Timestamp.now()
      const timeLimitReached =
        now.seconds - turnStartTimestamp.seconds >= gameData.maxTurnTime

      if (allPlayersMoved || timeLimitReached) {
        logger.info(`Processing turn ${currentRound}`)
        await processTurn(
          transaction,
          gameID,
          gameData,
          currentTurn,
          currentTurnRef,
        )
      } else {
        logger.info(
          "Not all players have moved, and time limit not reached yet.",
        )
      }
    })
  })

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
        hasMoved: {},
        clashes: {},
        startTime: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 1000),
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

// Process the turn if the timer has expired
async function processExpiredTurn(
  gameID: string,
  currentTurn: Turn,
  gameData: GameState,
) {
  const currentRound = gameData.currentRound
  const currentTurnRef = admin
    .firestore()
    .collection(`games/${gameID}/turns`)
    .doc(currentRound.toString())

  await admin.firestore().runTransaction(async (transaction) => {
    await processTurn(
      transaction,
      gameID,
      gameData,
      currentTurn,
      currentTurnRef,
    )
  })
}

// Firestore trigger for when a client indicates that a turn might have expired
export const onTurnExpirationRequest = functions.firestore
  .document("games/{gameID}/turnExpirationRequests/{requestID}")
  .onCreate(async (snap, context) => {
    const { gameID } = context.params

    logger.info(`Processing turn expiration request for gameID: ${gameID}`)

    const gameRef = admin.firestore().collection("games").doc(gameID)
    const gameDoc = await gameRef.get()
    const gameData = gameDoc.data() as GameState

    if (!gameData) {
      logger.error("Game not found", { gameID })
      return
    }

    const currentRound = gameData.currentRound
    const currentTurnRef = admin
      .firestore()
      .collection(`games/${gameID}/turns`)
      .doc(currentRound.toString())

    const currentTurnDoc = await currentTurnRef.get()
    if (!currentTurnDoc.exists) {
      logger.error("Current Turn document does not exist.", { currentRound })
      return
    }

    const currentTurn = currentTurnDoc.data() as Turn
    const now = admin.firestore.Timestamp.now()
    const elapsedSeconds = now.seconds - currentTurn.startTime.seconds

    // Check if the turn has expired
    if (elapsedSeconds >= gameData.maxTurnTime) {
      logger.info(`Turn ${currentRound} has expired. Processing...`)
      await processExpiredTurn(gameID, currentTurn, gameData)
    } else {
      logger.info(
        `Turn ${currentRound} has not expired yet. Time remaining: ${
          gameData.maxTurnTime - elapsedSeconds
        } seconds.`,
      )
    }
  })
