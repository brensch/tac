// functions/src/gameprocessors/LongboiProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Turn, Move, GameState, Clash } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"

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
   * Initializes the Longboi game by setting up the initial turn.
   * @param gameState The current state of the game.
   */
  async initializeGame(gameState: GameState): Promise<void> {
    try {
      const initialTurn = this.initializeTurn(gameState)

      // Construct DocumentReference for the first turn
      const turnRef = admin
        .firestore()
        .collection(`games/${this.gameID}/turns`)
        .doc("1")

      // Set turn and update game within transaction
      this.transaction.set(turnRef, initialTurn)

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
   * Initializes the first turn for Longboi.
   * @param gameState The current state of the game.
   * @returns The initial Turn object.
   */
  private initializeTurn(gameState: GameState): Turn {
    const { boardWidth, boardHeight, playerIDs } = gameState
    const now = Date.now()

    // Initialize playerPieces as occupied positions for each player
    const playerPieces: { [playerID: string]: number[] } = {}
    playerIDs.forEach((playerID) => {
      playerPieces[playerID] = []
    })

    // Initialize allowed moves (all positions on the board)
    const totalCells = boardWidth * boardHeight
    const allPositions = Array.from({ length: totalCells }, (_, index) => index)
    const allowedMoves: { [playerID: string]: number[] } = {}
    playerIDs.forEach((playerID) => {
      allowedMoves[playerID] = [...allPositions]
    })

    const firstTurn: Turn = {
      turnNumber: 1,
      boardWidth: boardWidth,
      boardHeight: boardHeight,
      gameType: gameState.gameType,
      playerIDs: playerIDs,
      playerHealth: {}, // Not used in Longboi
      hasMoved: {},
      turnTime: gameState.maxTurnTime,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + gameState.maxTurnTime * 1000),
      scores: {}, // Initialize scores as empty map
      alivePlayers: [...playerIDs], // All players are alive

      // New fields
      food: [], // Not used in Longboi
      hazards: [], // Not used in Longboi
      playerPieces: playerPieces, // Players' occupied positions
      allowedMoves: allowedMoves,
      walls: [], // No walls in Longboi
      clashes: [], // Initialize empty array for clashes
      gameOver: false,
      moves: {},
    }

    return firstTurn
  }

  /**
   * Applies the latest moves to the Longboi game and updates scores.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const { playerIDs, boardWidth, boardHeight, playerPieces, allowedMoves } =
        this.currentTurn

      // Deep copy playerPieces
      const newPlayerPieces: { [playerID: string]: number[] } = {}
      Object.keys(playerPieces).forEach((playerID) => {
        newPlayerPieces[playerID] = [...playerPieces[playerID]]
      })

      // Map to keep track of moves to positions
      const moveMap: { [position: number]: string[] } = {}

      // Clashes array
      const clashes: Clash[] = []

      // Process latest moves
      this.latestMoves.forEach((move) => {
        const position = move.move
        const playerID = move.playerID

        // Check if position is allowed for the player
        if (!allowedMoves[playerID]?.includes(position)) {
          logger.warn(
            `Longboi: Invalid move by player ${playerID} to position ${position}. Move ignored.`,
          )
          return
        }

        if (!moveMap[position]) {
          moveMap[position] = []
        }
        moveMap[position].push(playerID)
      })

      // Process moves and handle clashes
      for (const positionStr in moveMap) {
        const position = parseInt(positionStr)
        const players = moveMap[position]

        if (players.length === 1) {
          // Valid move
          const playerID = players[0]
          newPlayerPieces[playerID].push(position)
          logger.info(
            `Longboi: Position ${position} claimed by player ${playerID}.`,
          )
        } else {
          // Clash: Multiple players attempted to claim the same position
          logger.warn(
            `Longboi: Clash at position ${position} by players ${players.join(
              ", ",
            )}.`,
          )
          // Record the clash
          clashes.push({
            index: position,
            playerIDs: players,
            reason: "Multiple players attempted to claim the same position",
          })
        }
      }

      // Update allowed moves (exclude claimed positions)
      const totalCells = boardWidth * boardHeight
      const allPositions = Array.from(
        { length: totalCells },
        (_, index) => index,
      )
      const claimedPositions = new Set<number>()
      Object.values(newPlayerPieces).forEach((positions) => {
        positions.forEach((pos) => claimedPositions.add(pos))
      })

      const newAllowedMoves: { [playerID: string]: number[] } = {}
      playerIDs.forEach((playerID) => {
        newAllowedMoves[playerID] = allPositions.filter(
          (pos) => !claimedPositions.has(pos),
        )
      })

      // Calculate scores based on the longest line
      const scores: { [playerID: string]: number } = {}
      playerIDs.forEach((playerID) => {
        scores[playerID] = this.calculateLongestLine(
          newPlayerPieces[playerID],
          boardWidth,
          boardHeight,
        )
      })

      // Update the current turn
      this.currentTurn.playerPieces = newPlayerPieces
      this.currentTurn.scores = scores
      this.currentTurn.allowedMoves = newAllowedMoves
      this.currentTurn.alivePlayers = [...playerIDs] // All players are alive
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
   * Finds winners based on the updated Longboi game.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const { boardWidth, boardHeight, playerIDs, playerPieces, scores } =
        this.currentTurn
      const totalPositions = boardWidth * boardHeight

      // Check if all positions are claimed
      const claimedPositionsCount = Object.values(playerPieces).reduce(
        (sum, positions) => sum + positions.length,
        0,
      )

      const isBoardFull = claimedPositionsCount >= totalPositions

      // If no one moved, also end the game
      if (!isBoardFull && this.latestMoves.length !== 0) {
        // Game continues
        return []
      }

      // Determine the player(s) with the longest line
      let maxLineLength = 0
      const potentialWinners: string[] = []

      playerIDs.forEach((playerID) => {
        const lineLength = scores[playerID]
        if (lineLength > maxLineLength) {
          maxLineLength = lineLength
          potentialWinners.length = 0 // Reset potential winners
          potentialWinners.push(playerID)
        } else if (lineLength === maxLineLength) {
          potentialWinners.push(playerID)
        }
      })

      if (potentialWinners.length === 1) {
        const winnerID = potentialWinners[0]
        const winningSquares = playerPieces[winnerID]
        const winner: Winner = {
          playerID: winnerID,
          score: maxLineLength,
          winningSquares: winningSquares,
        }
        logger.info(
          `Longboi: Player ${winnerID} has won the game with a longest line of ${maxLineLength}.`,
        )
        return [winner]
      } else {
        // Tie or draw
        logger.info(
          `Longboi: Game ended in a draw among players: ${potentialWinners.join(
            ", ",
          )}.`,
        )
        return potentialWinners.map((playerID) => ({
          playerID,
          score: scores[playerID],
          winningSquares: playerPieces[playerID],
        }))
      }
    } catch (error) {
      logger.error(
        `Longboi: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Calculates the longest continuous line for a player.
   * @param positions The positions claimed by the player.
   * @param boardWidth The width of the board.
   * @param boardHeight The height of the board.
   * @returns The length of the longest line.
   */
  private calculateLongestLine(
    positions: number[],
    boardWidth: number,
    boardHeight: number,
  ): number {
    if (positions.length === 0) return 0

    // Convert positions to a grid for easier traversal
    const grid = Array(boardHeight)
      .fill(null)
      .map(() => Array(boardWidth).fill(false))

    positions.forEach((pos) => {
      const x = pos % boardWidth
      const y = Math.floor(pos / boardWidth)
      grid[y][x] = true
    })

    const directions = [
      { dx: 1, dy: 0 }, // horizontal
      { dx: 0, dy: 1 }, // vertical
      { dx: 1, dy: 1 }, // diagonal down-right
      { dx: 1, dy: -1 }, // diagonal up-right
    ]

    let maxLength = 0

    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        if (grid[y][x]) {
          for (const dir of directions) {
            let length = 1
            let nx = x + dir.dx
            let ny = y + dir.dy
            while (
              ny >= 0 &&
              ny < boardHeight &&
              nx >= 0 &&
              nx < boardWidth &&
              grid[ny][nx]
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
}
