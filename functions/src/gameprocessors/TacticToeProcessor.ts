// functions/src/gameprocessors/TacticToeProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Square, Turn, Move, GameState } from "@shared/types/Game"
import { logger } from "../logger" // Adjust the path as necessary
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"

/**
 * Processor class for the Tactic Toe game logic.
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
   * Initializes the Tactic Toe game by setting up the board and creating the first turn.
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
        playerHealth: [], // Not used in Tactic Toe
        hasMoved: {},
        // Removed clashes from Turn
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
        `TacticToe: Turn 1 created and game ${this.gameID} has started.`,
      )
    } catch (error) {
      logger.error(`TacticToe: Error initializing game ${this.gameID}:`, error)
      throw error
    }
  }

  /**
   * Initializes the board for Tactic Toe.
   * @param boardWidth The width of the board.
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
        clash: null, // Initialize clash as null
      }))

    logger.info(
      "TacticToe: Board initialized with all squares available for all players.",
      {
        board,
      },
    )

    return board
  }

  /**
   * Applies the latest moves to the Tactic Toe board.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const newBoard = this.currentTurn.board.map((square) => ({
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
            `TacticToe: Invalid move index ${squareIndex} by player ${move.playerID}.`,
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
              `TacticToe: Square ${squareIndex} occupied by player ${players[0]}`,
              { squareIndex, playerID: players[0] },
            )
          } else {
            // Square already occupied
            square.clash = {
              players: players,
              reason: "Square already occupied.",
            }
            logger.warn(
              `TacticToe: Square ${squareIndex} already occupied. Move by player ${players[0]} recorded as clash.`,
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
            `TacticToe: Clash at square ${squareIndex} by players ${players.join(
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
        `TacticToe: Error applying moves for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Finds winners based on the updated Tactic Toe board.
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

          logger.info(`TacticToe: Player ${playerID} has won the game.`, {
            gameID: this.gameID,
          })
        }
      })

      return winners
    } catch (error) {
      logger.error(
        `TacticToe: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Checks if a player meets the win condition.
   * @param board The game board.
   * @param boardWidth The width of the board.
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
