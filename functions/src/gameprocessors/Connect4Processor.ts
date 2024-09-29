// functions/src/gameprocessors/Connect4Processor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Square, Turn, Move, GameState } from "@shared/types/Game"
import { logger } from "../logger" // Adjust the path as necessary
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"

/**
 * Processor class for Connect Four game logic.
 */
export class Connect4Processor extends GameProcessor {
  constructor(
    transaction: Transaction,
    gameID: string,
    latestMoves: Move[],
    currentTurn?: Turn,
  ) {
    super(transaction, gameID, latestMoves, currentTurn)
  }

  /**
   * Initializes the Connect Four game by setting up the board and creating the first turn.
   */
  async initializeGame(gameState: GameState): Promise<void> {
    try {
      const initialBoard = this.initializeConnect4Board(
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
        hasMoved: {},
        playerHealth: [], // Not used
        turnTime: gameState.maxTurnTime,
        startTime: admin.firestore.Timestamp.fromMillis(now),
        endTime: admin.firestore.Timestamp.fromMillis(
          now + gameState.maxTurnTime * 1000,
        ),
        playerIDs: gameState.playerIDs,
        scores: gameState.playerIDs.map(() => 0), // Initialize scores to zero
        alivePlayers: [...gameState.playerIDs], // All players are alive at the start
      }

      // Set turn and update game within transaction
      this.transaction.set(turnRef, firstTurn)

      // Reference to the game document
      const gameRef = admin.firestore().collection("games").doc(this.gameID)

      // Update the game document to mark it as started
      this.transaction.update(gameRef, { started: true })

      logger.info(
        `Connect4: Turn 1 created and game ${this.gameID} has started.`,
      )
    } catch (error) {
      logger.error(`Connect4: Error initializing game ${this.gameID}:`, error)
      throw error
    }
  }

  /**
   * Applies the latest moves to the Connect Four board and updates scores.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const newBoard = this.currentTurn.board.map((square) => ({ ...square })) // Deep copy

      // Build a map of moves per column based on move positions
      const moveMap: { [column: number]: string[] } = {}

      this.latestMoves.forEach((move) => {
        const position = move.move
        if (!this.currentTurn) return

        const column = position % this.currentTurn.boardWidth // Convert position to column
        if (moveMap[column]) {
          moveMap[column].push(move.playerID)
        } else {
          moveMap[column] = [move.playerID]
        }
        logger.debug(
          `Connect4: Move position ${position} mapped to column ${column} by player ${move.playerID}.`,
        )
      })

      // Apply moves to the board
      for (const columnStr in moveMap) {
        const column = parseInt(columnStr, 10)
        const players = moveMap[column]

        if (players.length === 1) {
          const playerID = players[0]
          const row = this.findAvailableRow(newBoard, column)
          if (row !== -1) {
            const index = row * this.currentTurn.boardWidth + column
            newBoard[index].playerID = playerID
            newBoard[index].allowedPlayers = [] // Mark as occupied
            logger.info(
              `Connect4: Player ${playerID} placed at column ${column}, row ${row}.`,
            )

            // Make the square above available if within bounds and unoccupied
            const aboveRow = row - 1
            if (aboveRow >= 0) {
              const aboveIndex = aboveRow * this.currentTurn.boardWidth + column
              if (newBoard[aboveIndex].playerID === null) {
                newBoard[aboveIndex].allowedPlayers = [
                  ...this.currentTurn.playerIDs,
                ]
                logger.info(
                  `Connect4: Square above column ${column}, row ${aboveRow} is now available.`,
                )
              }
            }
          } else {
            logger.warn(
              `Connect4: Column ${column} is full. Move by player ${players[0]} ignored.`,
            )
          }
        } else if (players.length > 1) {
          // Conflict: multiple players attempted to place in the same column
          logger.warn(
            `Connect4: Multiple players (${players.join(
              ", ",
            )}) attempted to place in column ${column}. Resolving conflict.`,
          )
          // Block the column by marking the lowest available square as a clash
          for (
            let row: number = this.currentTurn.boardWidth - 1;
            row >= 0;
            row--
          ) {
            const index = row * this.currentTurn.boardWidth + column
            if (newBoard[index].playerID === null) {
              newBoard[index].playerID = null
              newBoard[index].food = false
              newBoard[index].allowedPlayers = [] // Ensure it's blocked
              newBoard[index].clash = {
                players,
                reason:
                  "Multiple players attempted to place in the same column.",
              }
              logger.info(
                `Connect4: Column ${column} at row ${row} is blocked due to conflict among players ${players.join(
                  ", ",
                )}.`,
              )
              break
            }
          }
        }
      }

      // Update the board in the current turn
      this.currentTurn.board = newBoard

      // Update scores based on the longest line
      const scores = this.currentTurn.playerIDs.map((playerID) =>
        this.calculateLongestLine(
          newBoard,
          this.currentTurn!.boardWidth,
          playerID,
        ),
      )

      this.currentTurn.scores = scores
      this.currentTurn.alivePlayers = [...this.currentTurn.playerIDs] // All players are alive
    } catch (error) {
      logger.error(
        `Connect4: Error applying moves for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Finds winners based on the updated Connect Four board.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const newBoard = this.currentTurn.board
      const winLength = 4 // Standard Connect Four
      const playerIDs = this.currentTurn.playerIDs

      const winningPlayers = this.checkWinConditionConnect4(
        newBoard,
        this.currentTurn.boardWidth,
        winLength,
        playerIDs,
      )

      const winners: Winner[] = []

      if (winningPlayers.length === 1) {
        const winnerID = winningPlayers[0].playerID
        const winningSquares = winningPlayers[0].winningSquares
        const score = winningPlayers[0].longestLine
        winners.push({ playerID: winnerID, score, winningSquares })
        logger.info(`Connect4: Player ${winnerID} has won the game!`)
      } else if (winningPlayers.length > 1) {
        // Handle multiple winners
        winners.push(
          ...winningPlayers.map((wp) => ({
            playerID: wp.playerID,
            score: wp.longestLine,
            winningSquares: wp.winningSquares,
          })),
        )
        logger.info(`Connect4: Multiple players have won the game!`, {
          winners,
        })
      }

      return winners
    } catch (error) {
      logger.error(
        `Connect4: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Calculates the longest continuous line for a player.
   * @param board The current game board.
   * @param boardWidth The width of the board.
   * @param playerID The ID of the player.
   * @returns The length of the longest line.
   */
  private calculateLongestLine(
    board: Square[],
    boardWidth: number,
    playerID: string,
  ): number {
    const boardHeight = board.length / boardWidth
    let maxLength = 0

    // Convert board to 2D array
    const grid: Square[][] = []
    for (let y = 0; y < boardHeight; y++) {
      const row: Square[] = []
      for (let x = 0; x < boardWidth; x++) {
        const index = y * boardWidth + x
        row.push(board[index])
      }
      grid.push(row)
    }

    const directions = [
      { dx: 1, dy: 0 }, // horizontal
      { dx: 0, dy: 1 }, // vertical
      { dx: 1, dy: 1 }, // diagonal down-right
      { dx: 1, dy: -1 }, // diagonal up-right
    ]

    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        if (grid[y][x].playerID === playerID) {
          for (const dir of directions) {
            let length = 1
            let nx = x + dir.dx
            let ny = y + dir.dy
            while (
              nx >= 0 &&
              nx < boardWidth &&
              ny >= 0 &&
              ny < boardHeight &&
              grid[ny][nx].playerID === playerID
            ) {
              length++
              nx += dir.dx
              ny += dir.dy
            }
            if (length > maxLength) {
              maxLength = length
            }
          }
        }
      }
    }
    return maxLength
  }

  /**
   * Checks for a win condition in Connect Four.
   * @param board The current game board.
   * @param boardWidth The width of the board.
   * @param winLength The number of consecutive pieces needed to win.
   * @param playerIDs Array of player IDs.
   * @returns An array of winning players with their winning squares and longest line.
   */
  private checkWinConditionConnect4(
    board: Square[],
    boardWidth: number,
    winLength: number,
    playerIDs: string[],
  ): { playerID: string; winningSquares: number[]; longestLine: number }[] {
    const winningPlayers: {
      playerID: string
      winningSquares: number[]
      longestLine: number
    }[] = []

    playerIDs.forEach((playerID) => {
      const result = this.hasPlayerWonConnect4(
        board,
        boardWidth,
        winLength,
        playerID,
      )
      if (result.hasWon) {
        winningPlayers.push({
          playerID,
          winningSquares: result.winningSquares,
          longestLine: result.longestLine,
        })
      }
    })

    return winningPlayers
  }

  /**
   * Helper function to determine if a player has won Connect Four.
   * @param board The current game board.
   * @param boardWidth The width of the board.
   * @param winLength The number of consecutive pieces needed to win.
   * @param playerID The ID of the player to check.
   * @returns An object indicating if the player has won, their winning squares, and longest line.
   */
  private hasPlayerWonConnect4(
    board: Square[],
    boardWidth: number,
    winLength: number,
    playerID: string,
  ): { hasWon: boolean; winningSquares: number[]; longestLine: number } {
    const size = boardWidth
    let maxLength = 0
    let winningSquares: number[] = []

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
          let tempWinningSquares: number[] = []
          let dx = x
          let dy = y

          while (
            dx >= 0 &&
            dx < size &&
            dy >= 0 &&
            dy < size &&
            board[dy * size + dx].playerID === playerID
          ) {
            tempWinningSquares.push(dy * size + dx)
            count++
            if (count > maxLength) {
              maxLength = count
              winningSquares = [...tempWinningSquares]
            }
            if (count === winLength) {
              return { hasWon: true, winningSquares, longestLine: maxLength }
            }
            dx += dir.x
            dy += dir.y
          }
        }
      }
    }

    return { hasWon: false, winningSquares: [], longestLine: maxLength }
  }

  /**
   * Finds the next available row in a given column.
   * @param board The current game board.
   * @param column The column to check.
   * @returns The row index where a piece can be placed or -1 if the column is full.
   */
  private findAvailableRow(board: Square[], column: number): number {
    if (!this.currentTurn) {
      logger.error("Connect4: Current turn is undefined.")
      return -1
    }

    const boardWidth = this.currentTurn.boardWidth

    // Validate column
    if (column < 0 || column >= boardWidth) {
      logger.error(
        `Connect4: Invalid column ${column} requested. Valid range is 0 to ${
          boardWidth - 1
        }.`,
      )
      return -1
    }

    for (let row = boardWidth - 1; row >= 0; row--) {
      // Assuming square board
      const index = row * boardWidth + column

      // Check if index is within bounds
      if (index < 0 || index >= board.length) {
        logger.error(
          `Connect4: Calculated index ${index} is out of bounds for board size ${board.length}.`,
        )
        continue
      }

      const square = board[index]

      // Additional check to ensure square is properly initialized
      if (!square) {
        logger.error(`Connect4: Square at index ${index} is undefined.`)
        continue
      }

      if (square.playerID === null) {
        logger.info(
          `Connect4: Available row found at row ${row} for column ${column}.`,
        )
        return row
      }
    }

    logger.warn(
      `Connect4: No available rows found in column ${column}. Column is full.`,
    )
    return -1 // Column is full
  }

  /**
   * Initializes the board for Connect Four.
   * @param boardWidth The width of the board.
   * @param playerIDs Array of player IDs.
   * @returns An array representing the initialized board.
   */
  private initializeConnect4Board(
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
        allowedPlayers: [], // Initially, no squares are available
        clash: null,
      }))

    // Mark only the bottom row as available
    for (let column = 0; column < boardWidth; column++) {
      const bottomRow = boardWidth - 1
      const index = bottomRow * boardWidth + column
      board[index].allowedPlayers = [...playerIDs]
    }

    logger.info("Connect4: Board initialized with bottom row available.", {
      board,
    })

    return board
  }
}
