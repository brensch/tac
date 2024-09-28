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

      // Apply moves to the board without conflict handling (assuming Longboi doesn't have move conflicts)
      this.latestMoves.forEach((move) => {
        const squareIndex = move.move
        if (squareIndex >= 0 && squareIndex < newBoard.length) {
          newBoard[squareIndex].playerID = move.playerID
          // Optionally, update other Square properties based on Longboi rules
          logger.info(
            `Longboi: Square ${squareIndex} captured by player ${move.playerID}`,
          )
        } else {
          logger.warn(
            `Longboi: Invalid move index ${squareIndex} by player ${move.playerID}.`,
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

      const winningPlayers = this.checkWinConditionLongboi(
        newBoard,
        this.currentTurn.boardWidth,
        winLength,
        playerIDs,
      )

      const winners: Winner[] = []

      if (winningPlayers.length === 1) {
        const winnerID = winningPlayers[0].playerID
        const winningSquares = winningPlayers[0].winningSquares
        const score = this.calculateScore(winningSquares.length)
        winners.push({ playerID: winnerID, score, winningSquares })
        logger.info(`Longboi: Player ${winnerID} has won the game!`, {
          gameID: this.gameID,
        })
      } else if (winningPlayers.length > 1) {
        // Handle multiple winners
        winners.push(
          ...winningPlayers.map((wp) => ({
            playerID: wp.playerID,
            score: this.calculateScore(wp.winningSquares.length),
            winningSquares: wp.winningSquares,
          })),
        )
        logger.info(`Longboi: Multiple players have won the game!`, {
          winners,
          gameID: this.gameID,
        })
      }

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
   * Checks for a win condition in Longboi based on the longest continuous connected path.
   * @param board The current game board.
   * @param boardWidth The width of the board.
   * @param winLength The target length for winning.
   * @param playerIDs Array of player IDs.
   * @returns An array of winning players with their winning squares.
   */
  private checkWinConditionLongboi(
    board: Square[],
    boardWidth: number,
    winLength: number,
    playerIDs: string[],
  ): { playerID: string; winningSquares: number[] }[] {
    // Ensure no player wins unless all squares are filled
    if (board.some((square) => square.playerID === null)) {
      return [] // No winner if there are empty squares
    }

    const longestPaths: { playerID: string; winningSquares: number[] }[] = []

    playerIDs.forEach((playerID) => {
      const result = this.findLongestConnectedPathForPlayer(
        board,
        boardWidth,
        playerID,
      )
      longestPaths.push({ playerID, winningSquares: result })
    })

    // Determine the maximum path length
    const longestPathLength = Math.max(
      ...longestPaths.map((p) => p.winningSquares.length),
    )

    // Return players with the longest path and meeting the win length
    return longestPaths.filter(
      (p) =>
        p.winningSquares.length === longestPathLength &&
        longestPathLength >= winLength,
    )
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

    // Direction vectors: right, down, left, up
    const directions = [
      { x: 1, y: 0 }, // Right
      { x: 0, y: 1 }, // Down
      { x: -1, y: 0 }, // Left
      { x: 0, y: -1 }, // Up
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
        allowedPlayers: [...playerIDs],
      }))

    // Customize initial board for 'longboi' as needed
    // Example: Place specific markers
    // board[0].isHead = true
    // board[boardSize - 1].isTail = true

    return board
  }
}
