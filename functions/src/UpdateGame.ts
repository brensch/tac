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

    // Fetch all moves for the current round
    const movesRef = admin
      .firestore()
      .collection(`games/${gameID}/privateMoves`)
    const movesSnapshot = await movesRef
      .where("moveNumber", "==", currentRound)
      .get()

    const movesThisRound = movesSnapshot.docs.map((doc) => doc.data() as Move)

    // Log moves received in this round
    logger.info(`Moves received in round ${currentRound}`, { movesThisRound })

    // Check if all players have moved
    const playerIDs = gameData.playerIDs
    const playersMoved = movesThisRound.map((move) => move.playerID)

    const allPlayersMoved = playerIDs.every((playerID) =>
      playersMoved.includes(playerID),
    )

    logger.info(`All players moved: ${allPlayersMoved}`, {
      playerIDs,
      playersMoved,
    })

    if (allPlayersMoved) {
      // Get the previous turn to get previous board state and locked squares
      let previousTurn: Turn | null = null
      if (currentRound > 0) {
        const previousTurnRef = admin
          .firestore()
          .collection(`games/${gameID}/turns`)
          .doc((currentRound - 1).toString())
        const previousTurnDoc = await previousTurnRef.get()
        previousTurn = previousTurnDoc.exists
          ? (previousTurnDoc.data() as Turn)
          : null
      }

      // If no previous turn, initialize board
      const boardWidth = gameData.boardWidth
      const boardSize = boardWidth * boardWidth
      const previousBoard = previousTurn
        ? previousTurn.board
        : Array(boardSize).fill("")
      const previousLockedSquares = previousTurn
        ? previousTurn.lockedSquares
        : []

      // Process the moves
      const newBoard = [...previousBoard]
      let lockedSquaresNextRound: number[] = [] // Squares to lock in the next round
      const clashes: { [square: number]: string[] } = {} // Map of square to player IDs who clashed

      // Build a map of moves per square
      const moveMap: { [square: number]: string[] } = {}

      // Build the move map
      movesThisRound.forEach((move) => {
        // Check if the square is currently locked
        if (previousLockedSquares.includes(move.move)) {
          logger.info(`Square ${move.move} is locked, move ignored`, { move })
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
        } else {
          // Multiple players moved into the same square
          // Square gets locked for the next turn, and neither player gets it
          lockedSquaresNextRound.push(square)
          clashes[square] = players
          logger.info(`Square ${square} is locked due to conflict`, { players })
        }
      }

      // Remove duplicates from lockedSquaresNextRound
      lockedSquaresNextRound = Array.from(new Set(lockedSquaresNextRound))

      // Log locked squares for the next round
      logger.info("Locked squares for next round", { lockedSquaresNextRound })

      // Check for a winner
      const winLength = 3 // Number of squares in a row needed to win
      const winningPlayers = checkWinCondition(
        newBoard,
        boardWidth,
        winLength,
        playerIDs,
      )

      logger.info("Winning players", { winningPlayers })

      // Handle multiple winners as clashes
      if (winningPlayers.length === 1) {
        // We have a winner
        const winnerID = winningPlayers[0]
        await gameRef.update({
          winner: winnerID,
        })
        logger.info(`Player ${winnerID} has won the game!`, { gameID })
      } else if (winningPlayers.length > 1) {
        // Multiple players won simultaneously; treat their moves as clashes
        winningPlayers.forEach((playerID) => {
          // Find the squares this player claimed in this turn
          for (let i = 0; i < newBoard.length; i++) {
            if (newBoard[i] === playerID) {
              // Revert the square to previous state
              newBoard[i] = previousBoard[i]
              lockedSquaresNextRound.push(i)
              // Add to clashes
              if (!clashes[i]) {
                clashes[i] = []
              }
              clashes[i].push(playerID)
            }
          }
        })
        logger.info(
          `Multiple players won simultaneously. Moves are treated as clashes.`,
          { winningPlayers },
        )
      }

      // Create the new Turn object
      const newTurn: Turn = {
        turnNumber: currentRound,
        board: newBoard,
        hasMoved: playerIDs, // All players have moved
        lockedSquares: lockedSquaresNextRound,
        clashes: clashes,
      }

      // Save the new Turn document
      const newTurnRef = admin
        .firestore()
        .collection(`games/${gameID}/turns`)
        .doc(currentRound.toString())

      await newTurnRef.set(newTurn)

      // Increment the currentRound in the game document
      await gameRef.update({
        currentRound: currentRound + 1,
      })

      // Log round update
      logger.info(`Round ${currentRound} completed`, { gameID })
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
): string[] {
  const winningPlayers: Set<string> = new Set()

  playerIDs.forEach((playerID) => {
    // Check rows, columns, and diagonals
    if (hasPlayerWon(board, boardWidth, winLength, playerID)) {
      winningPlayers.add(playerID)
    }
  })

  return Array.from(winningPlayers)
}

// Helper function to check if a player has won
function hasPlayerWon(
  board: string[],
  boardWidth: number,
  winLength: number,
  playerID: string,
): boolean {
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
        let dx = x
        let dy = y

        while (
          dx >= 0 &&
          dx < size &&
          dy >= 0 &&
          dy < size &&
          board[dy * size + dx] === playerID
        ) {
          count++
          if (count === winLength) {
            return true
          }
          dx += dir.x
          dy += dir.y
        }
      }
    }
  }

  return false
}
