// functions/src/gameprocessors/LongboiProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Square, Turn, Move, GameState } from "@shared/types/Game"
import { logger } from "../logger" // Adjust the path as necessary
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"

/**
 * Processor class for Longboi game logic.
 */
export class LongboiProcessor extends GameProcessor {
  constructor(
    transaction: Transaction,
    gameID: string,
    latestMoves: Move[],
    currentTurn?: Turn,
  ) {
    super(transaction, gameID, latestMoves, currentTurn)
  }

  /**
   * Initializes the Longboi game by setting up the board and creating the first turn.
   * @param gameState The current state of the game.
   */
  async initializeGame(gameState: GameState): Promise<void> {
    try {
      const initialBoard = this.initializeLongboiBoard(
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
        playerHealth: [], //not used
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
        `Longboi: Turn 1 created and game ${this.gameID} has started.`,
      )
    } catch (error) {
      logger.error(`Longboi: Error initializing game ${this.gameID}:`, error)
      throw error
    }
  }

  /**
   * Initializes the board for Longboi.
   * @param boardWidth The width of the board.
   * @param playerIDs Array of player IDs.
   * @returns An array representing the initialized board.
   */
  private initializeLongboiBoard(
    boardWidth: number,
    playerIDs: string[],
  ): Square[] {
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
      "Longboi: Board initialized with all squares available for all players.",
      {
        board,
      },
    )

    return board
  }

  /**
   * Applies the latest moves to the Longboi board.
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
              `Longboi: Square ${squareIndex} captured by player ${move.playerID}`,
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
              `Longboi: Square ${squareIndex} already occupied. Move by player ${move.playerID} recorded as clash.`,
              { squareIndex, playerID: move.playerID },
            )
          }
        } else {
          logger.warn(
            `Longboi: Invalid move index ${squareIndex} by player ${move.playerID}.`,
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
          // Occupied or eaten square
          square.allowedPlayers = []
        }
      })

      // Update the board and clashes in the current turn
      this.currentTurn.board = newBoard
      this.currentTurn.clashes = clashes
    } catch (error) {
      logger.error(
        `Longboi: Error applying moves for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Finds winners based on the updated Longboi board.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const newBoard = this.currentTurn.board
      const playerIDs = this.currentTurn.playerIDs

      const isBoardFull = newBoard.every((square) => square.playerID !== null)

      if (!isBoardFull) {
        // The game continues; no winners yet
        return []
      }

      // Calculate scores for each player
      const winners: Winner[] = []

      playerIDs.forEach((playerID) => {
        const playerSquares = newBoard
          .map((square, index) => ({ ...square, index }))
          .filter((square) => square.playerID === playerID)

        const score = playerSquares.length // Number of squares occupied
        const winningSquares = playerSquares.map((square) => square.index)

        winners.push({
          playerID,
          score,
          winningSquares,
        })

        logger.info(
          `Longboi: Player ${playerID} has occupied ${score} squares.`,
          {
            gameID: this.gameID,
          },
        )
      })

      return winners
    } catch (error) {
      logger.error(
        `Longboi: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }
}
