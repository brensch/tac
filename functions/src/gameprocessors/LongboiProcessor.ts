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
        turnTime: gameState.maxTurnTime,
        startTime: admin.firestore.Timestamp.fromMillis(now),
        endTime: admin.firestore.Timestamp.fromMillis(
          now + gameState.maxTurnTime * 1000,
        ),
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
   * Applies the latest moves to the Longboi board and updates scores.
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

      // Calculate scores for each player
      const scores = playerIDs.map((playerID) =>
        this.calculateLongestLine(
          newBoard,
          this.currentTurn!.boardWidth,
          playerID,
        ),
      )

      // Update scores and alivePlayers in the current turn
      this.currentTurn.scores = scores
      this.currentTurn.alivePlayers = [...playerIDs] // In Longboi, players are not eliminated

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

      // Use the scores calculated in applyMoves
      const winners: Winner[] = []

      playerIDs.forEach((playerID, index) => {
        const longestLine = this.currentTurn!.scores[index]

        const playerSquares = newBoard
          .map((square, idx) => ({ ...square, index: idx }))
          .filter((square) => square.playerID === playerID)

        const winningSquares = playerSquares.map((square) => square.index)

        winners.push({
          playerID,
          score: longestLine,
          winningSquares,
        })

        logger.info(
          `Longboi: Player ${playerID} has a longest line of ${longestLine}.`,
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
