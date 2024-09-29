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
        playerHealth: [], // Not used in Longboi
        hasMoved: {},
        // Removed clashes from Turn
        turnTime: gameState.maxTurnTime,
        startTime: admin.firestore.Timestamp.fromMillis(now),
        endTime: admin.firestore.Timestamp.fromMillis(now + 60 * 1000), // e.g., 60 seconds
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
        clash: null, // Initialize clash as null
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
      const newBoard: Square[] = this.currentTurn.board.map((square) => ({
        ...square,
        allowedPlayers: [],
        clash: null, // Reset clashes
      })) // Deep copy

      const playerIDs = this.currentTurn.playerIDs

      // Map to keep track of moves to squares
      const moveMap: { [squareIndex: number]: string[] } = {}

      // Apply moves to the board
      this.latestMoves.forEach((move) => {
        const squareIndex = move.move
        if (squareIndex >= 0 && squareIndex < newBoard.length) {
          if (!moveMap[squareIndex]) {
            moveMap[squareIndex] = []
          }
          moveMap[squareIndex].push(move.playerID)
        } else {
          logger.warn(
            `Longboi: Invalid move index ${squareIndex} by player ${move.playerID}.`,
            { squareIndex, playerID: move.playerID },
          )
        }
      })

      // Process moves and handle clashes
      for (const squareIndexStr in moveMap) {
        const squareIndex = parseInt(squareIndexStr)
        const players = moveMap[squareIndex]
        const square = newBoard[squareIndex]

        if (players.length === 1) {
          if (square.playerID === null) {
            // Valid move
            square.playerID = players[0]
            logger.info(
              `Longboi: Square ${squareIndex} captured by player ${players[0]}`,
              { squareIndex, playerID: players[0] },
            )
          } else {
            // Square already occupied
            square.clash = {
              players: players,
              reason: "Square already occupied.",
            }
            logger.warn(
              `Longboi: Square ${squareIndex} already occupied. Move by player ${players[0]} recorded as clash.`,
              { squareIndex, playerID: players[0] },
            )
          }
        } else {
          // Clash due to multiple players attempting to occupy the same square
          square.clash = {
            players: players,
            reason: "Multiple players attempted to occupy the same square.",
          }
          logger.warn(
            `Longboi: Clash at square ${squareIndex} by players ${players.join(
              ", ",
            )}.`,
            { squareIndex, players },
          )
        }
      }

      // Update allowedPlayers for all squares after moves
      newBoard.forEach((square) => {
        if (square.playerID === null && !square.clash) {
          // Unoccupied and valid square
          square.allowedPlayers = [...playerIDs]
        } else {
          // Occupied or invalid square
          square.allowedPlayers = []
        }
      })

      // Update the board in the current turn
      this.currentTurn.board = newBoard
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

      const isBoardFull = newBoard.every(
        (square) => square.playerID !== null || square.clash !== null,
      )

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
