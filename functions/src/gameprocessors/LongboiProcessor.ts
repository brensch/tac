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
        hasMoved: {},
        clashes: {},
        winners: [],
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
   * Applies the latest moves to the Longboi board.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const newBoard = this.currentTurn.board.map((square) => ({ ...square })) // Deep copy
      const clashes: Record<string, any> = { ...this.currentTurn.clashes }

      // Apply moves to the board
      this.latestMoves.forEach((move) => {
        const squareIndex = move.move
        if (squareIndex >= 0 && squareIndex < newBoard.length) {
          const square = newBoard[squareIndex]
          if (square.playerID === null) {
            square.playerID = move.playerID
            square.allowedPlayers = [] // Mark as occupied
            logger.info(
              `Longboi: Square ${squareIndex} captured by player ${move.playerID}`,
              { squareIndex, playerID: move.playerID },
            )

            // Make adjacent squares available based on Longboi's rules
            if (!this.currentTurn) return
            this.updateAdjacentSquares(
              newBoard,
              squareIndex,
              this.currentTurn.boardWidth,
            )
          } else {
            // Conflict: Square already occupied
            clashes[squareIndex] = {
              players: [move.playerID],
              reason: "Square already occupied.",
            }
            logger.warn(
              `Longboi: Square ${squareIndex} already occupied. Move by player ${move.playerID} ignored.`,
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
      const winLength = 4 // Example condition
      const playerIDs = this.currentTurn.playerIDs

      const isBoardFull = newBoard.every(
        (square) => square.playerID !== null || square.eaten,
      )

      if (!isBoardFull) {
        // The game continues; no winners yet
        return []
      }

      // Since the board is full, calculate each player's longest path
      const winners: Winner[] = []

      playerIDs.forEach((playerID) => {
        if (!this.currentTurn) return
        const longestPath = this.findLongestConnectedPathForPlayer(
          newBoard,
          this.currentTurn.boardWidth,
          playerID,
        )

        if (longestPath.length >= winLength) {
          const score = this.calculateScore(longestPath.length)
          winners.push({
            playerID,
            score,
            winningSquares: longestPath,
          })
          logger.info(
            `Longboi: Player ${playerID} has a path of length ${longestPath.length}.`,
            {
              gameID: this.gameID,
            },
          )
        } else {
          // Players who do not meet the win condition can be excluded or handled as needed
          logger.info(
            `Longboi: Player ${playerID} does not meet the win condition.`,
            {
              gameID: this.gameID,
            },
          )
        }
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

  /**
   * Calculates the score based on the number of winning squares.
   * @param winningSquaresCount Number of squares in the winning sequence.
   * @returns Calculated score.
   */
  private calculateScore(winningSquaresCount: number): number {
    // Example scoring logic: 5 points per winning square
    return winningSquaresCount * 5
  }

  /**
   * Helper function to find the longest connected path for a player in Longboi.
   * @param board The current game board.
   * @param boardWidth The width of the board.
   * @param playerID The ID of the player.
   * @returns An array of square indices representing the longest path.
   */
  private findLongestConnectedPathForPlayer(
    board: Square[],
    boardWidth: number,
    playerID: string,
  ): number[] {
    const size = boardWidth
    let longestPath: number[] = []
    const visited: Set<number> = new Set()

    // Direction vectors: right, down, left, up, and diagonals
    const directions = [
      { x: 1, y: 0 }, // Right
      { x: -1, y: 0 }, // Left
      { x: 0, y: 1 }, // Down
      { x: 0, y: -1 }, // Up
      { x: 1, y: 1 }, // Down-Right
      { x: -1, y: 1 }, // Down-Left
      { x: 1, y: -1 }, // Up-Right
      { x: -1, y: -1 }, // Up-Left
    ]

    // Helper to convert (x, y) to a single index in the board array
    const index = (x: number, y: number) => y * size + x

    // Depth-first search (DFS) to find the longest connected path
    const dfs = (
      x: number,
      y: number,
      path: number[],
      visitedInPath: Set<number>,
    ): number[] => {
      const currentIdx = index(x, y)
      const currentPath = [...path, currentIdx]
      visitedInPath.add(currentIdx)

      let maxPath = currentPath

      directions.forEach((dir) => {
        const newX = x + dir.x
        const newY = y + dir.y
        const newIdx = index(newX, newY)

        if (
          newX >= 0 &&
          newX < size &&
          newY >= 0 &&
          newY < size &&
          board[newIdx].playerID === playerID &&
          !visitedInPath.has(newIdx) // Prevent revisiting in the same path
        ) {
          const newPath = dfs(newX, newY, currentPath, new Set(visitedInPath))
          if (newPath.length > maxPath.length) {
            maxPath = newPath
          }
        }
      })

      return maxPath
    }

    // Iterate over all squares in the board and initiate DFS for each unvisited square of the player
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const currentIdx = index(x, y)
        if (
          board[currentIdx].playerID === playerID &&
          !visited.has(currentIdx)
        ) {
          const path = dfs(x, y, [], new Set())
          path.forEach((idx) => visited.add(idx))
          if (path.length > longestPath.length) {
            longestPath = path
          }
        }
      }
    }

    return longestPath
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
        isTail: false,
        isHead: false,
        eaten: false,
        allowedPlayers: [], // Initially, no squares are available
      }))

    // Define which squares are initially available.
    // For example, only the bottom row is available.
    for (let column = 0; column < boardWidth; column++) {
      const bottomRow = boardWidth - 1
      const index = bottomRow * boardWidth + column
      board[index].allowedPlayers = [...playerIDs]
    }

    logger.info("Longboi: Board initialized with bottom row available.", {
      board,
    })

    return board
  }

  /**
   * Updates adjacent squares to make them available after a move.
   * @param board The current game board.
   * @param squareIndex The index of the square that was just occupied.
   * @param gameWidth The width of the board.
   */
  private updateAdjacentSquares(
    board: Square[],
    squareIndex: number,
    gameWidth: number,
  ): void {
    const size = gameWidth
    const x = squareIndex % size
    const y = Math.floor(squareIndex / size)

    // Define adjacent directions (up, down, left, right, diagonals)
    const directions = [
      { dx: 1, dy: 0 }, // Right
      { dx: -1, dy: 0 }, // Left
      { dx: 0, dy: 1 }, // Down
      { dx: 0, dy: -1 }, // Up
      { dx: 1, dy: 1 }, // Down-Right
      { dx: -1, dy: 1 }, // Down-Left
      { dx: 1, dy: -1 }, // Up-Right
      { dx: -1, dy: -1 }, // Up-Left
    ]

    directions.forEach((dir) => {
      const newX = x + dir.dx
      const newY = y + dir.dy
      if (newX >= 0 && newX < size && newY >= 0 && newY < size) {
        const adjacentIndex = newY * size + newX
        const adjacentSquare = board[adjacentIndex]
        if (adjacentSquare.playerID === null && !adjacentSquare.eaten) {
          // Make the square available for all players if not already available
          if (adjacentSquare.allowedPlayers.length === 0) {
            adjacentSquare.allowedPlayers = [...this.currentTurn!.playerIDs]
            logger.info(
              `Longboi: Square ${adjacentIndex} is now available for all players.`,
              { squareIndex: adjacentIndex },
            )
          }
        }
      }
    })
  }
}
