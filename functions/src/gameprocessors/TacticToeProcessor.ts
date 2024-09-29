// functions/src/gameprocessors/FreePlaceConnect4Processor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Square, Turn, Move, GameState } from "@shared/types/Game"
import { logger } from "../logger" // Adjust the path as necessary
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"

/**
 * Processor class for the Free Place Connect4 game logic.
 */
export class TacticToeProcessor extends GameProcessor {
  constructor(
    transaction: Transaction,
    gameID: string,
    latestMoves: Move[],
    currentTurn?: Turn,
  ) {
    super(transaction, gameID, latestMoves, currentTurn)
  }

  /**
   * Initializes the Free Place Connect4 game by setting up the board and creating the first turn.
   * @param gameState The current state of the game.
   */
  async initializeGame(gameState: GameState): Promise<void> {
    try {
      const initialBoard = this.initializeBoard(
        gameState.boardWidth,
        gameState.playerIDs,
      )

      // Construct DocumentReference for the first turn
      const turnRef = admin
        .firestore()
        .collection(`games/${this.gameID}/turns`)
        .doc("1")

      const now = Date.now()

      const firstTurn: Turn = {
        turnNumber: 1,
        board: initialBoard,
        boardWidth: gameState.boardWidth,
        gameType: gameState.gameType,
        playerIDs: gameState.playerIDs,
        playerHealth: [],
        hasMoved: {},
        clashes: {},

        turnTime: gameState.maxTurnTime,
        startTime: admin.firestore.Timestamp.fromMillis(now),
        endTime: admin.firestore.Timestamp.fromMillis(
          now + gameState.maxTurnTime * 1000,
        ), // e.g., 60 seconds
      }

      // Set turn and update game within transaction
      this.transaction.set(turnRef, firstTurn)

      // Reference to the game document
      const gameRef = admin.firestore().collection("games").doc(this.gameID)

      // Update the game document to mark it as started
      this.transaction.update(gameRef, { started: true })

      logger.info(
        `FreePlaceConnect4: Turn 1 created and game ${this.gameID} has started.`,
      )
    } catch (error) {
      logger.error(
        `FreePlaceConnect4: Error initializing game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Initializes the board for Free Place Connect4.
   * @param boardWidth The width of the board.
   * @param boardHeight The height of the board.
   * @param playerIDs Array of player IDs.
   * @returns An array representing the initialized board.
   */
  private initializeBoard(boardWidth: number, playerIDs: string[]): Square[] {
    const boardSize = boardWidth * boardWidth
    const board: Square[] = Array(boardSize)
      .fill(null)
      .map(() => ({
        playerID: null,
        wall: false,
        bodyPosition: [0],
        food: false,
        allowedPlayers: [...playerIDs], // All players can move to any unoccupied square
      }))

    logger.info(
      "FreePlaceConnect4: Board initialized with all squares available for all players.",
      {
        board,
      },
    )

    return board
  }

  /**
   * Applies the latest moves to the Free Place Connect4 board.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const newBoard = this.currentTurn.board.map((square) => ({ ...square })) // Deep copy
      const clashes: Record<string, any> = { ...this.currentTurn.clashes }
      const playerIDs = this.currentTurn.playerIDs

      // Apply moves to the board
      this.latestMoves.forEach((move) => {
        const squareIndex = move.move
        if (squareIndex >= 0 && squareIndex < newBoard.length) {
          const square = newBoard[squareIndex]
          if (square.playerID === null) {
            // Valid move
            square.playerID = move.playerID
            square.allowedPlayers = [] // Square is now occupied

            logger.info(
              `FreePlaceConnect4: Square ${squareIndex} occupied by player ${move.playerID}`,
              { squareIndex, playerID: move.playerID },
            )
          } else {
            // Conflict: Square already occupied
            // Record clash
            if (!clashes[squareIndex]) {
              clashes[squareIndex] = {
                players: [],
                reason: "Square already occupied.",
              }
            }
            clashes[squareIndex].players.push(move.playerID)

            logger.warn(
              `FreePlaceConnect4: Square ${squareIndex} already occupied. Move by player ${move.playerID} recorded as clash.`,
              { squareIndex, playerID: move.playerID },
            )
          }
        } else {
          logger.warn(
            `FreePlaceConnect4: Invalid move index ${squareIndex} by player ${move.playerID}.`,
            { squareIndex, playerID: move.playerID },
          )
        }
      })

      // Update allowedPlayers for all squares after moves
      newBoard.forEach((square) => {
        if (square.playerID === null) {
          // Unoccupied and valid square
          square.allowedPlayers = [...playerIDs]
        } else {
          // Occupied or invalid square
          square.allowedPlayers = []
        }
      })

      // Update the board and clashes in the current turn
      this.currentTurn.board = newBoard
      this.currentTurn.clashes = clashes
    } catch (error) {
      logger.error(
        `FreePlaceConnect4: Error applying moves for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Finds winners based on the updated Free Place Connect4 board.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const board = this.currentTurn.board
      const boardWidth = this.currentTurn.boardWidth
      const playerIDs = this.currentTurn.playerIDs
      const winCondition = 4 // Number of connected pieces to win

      const winners: Winner[] = []

      playerIDs.forEach((playerID) => {
        if (this.checkWinCondition(board, boardWidth, playerID, winCondition)) {
          // Collect all indices of the player's pieces for winningSquares
          const winningSquares = board
            .map((square, index) => (square.playerID === playerID ? index : -1))
            .filter((index) => index !== -1)

          const score = winningSquares.length // You can define scoring logic

          winners.push({
            playerID,
            score,
            winningSquares,
          })

          logger.info(
            `FreePlaceConnect4: Player ${playerID} has won the game.`,
            {
              gameID: this.gameID,
            },
          )
        }
      })

      return winners
    } catch (error) {
      logger.error(
        `FreePlaceConnect4: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Checks if a player meets the win condition.
   * @param board The game board.
   * @param boardWidth The width of the board.
   * @param boardHeight The height of the board.
   * @param playerID The player ID to check for.
   * @param winCondition The number of connected pieces required to win.
   * @returns True if the player meets the win condition, false otherwise.
   */
  private checkWinCondition(
    board: Square[],
    boardWidth: number,
    playerID: string,
    winCondition: number,
  ): boolean {
    const size = { width: boardWidth, height: boardWidth }

    // Directions to check: horizontal, vertical, diagonal down-right, diagonal up-right
    const directions = [
      { x: 1, y: 0 }, // Horizontal
      { x: 0, y: 1 }, // Vertical
      { x: 1, y: 1 }, // Diagonal down-right
      { x: 1, y: -1 }, // Diagonal up-right
    ]

    for (let y = 0; y < size.height; y++) {
      for (let x = 0; x < size.width; x++) {
        const index = y * size.width + x
        if (board[index].playerID === playerID) {
          for (const dir of directions) {
            let count = 1
            let nx = x + dir.x
            let ny = y + dir.y
            while (
              nx >= 0 &&
              nx < size.width &&
              ny >= 0 &&
              ny < size.height &&
              board[ny * size.width + nx].playerID === playerID
            ) {
              count++
              if (count === winCondition) {
                return true
              }
              nx += dir.x
              ny += dir.y
            }
          }
        }
      }
    }

    return false
  }
}
