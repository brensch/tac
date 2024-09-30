// functions/src/gameprocessors/Connect4Processor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Turn, Move, GameState, Clash } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"
import { FirstMoveTimeoutSeconds } from "../timings"

/**
 * Processor class for the Connect4 game logic.
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
   * Initializes the Connect4 game by setting up the initial turn.
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
        `Connect4: Turn 1 created and game ${this.gameID} has started.`,
      )
    } catch (error) {
      logger.error(`Connect4: Error initializing game ${this.gameID}:`, error)
      throw error
    }
  }

  /**
   * Initializes the first turn for Connect4.
   * @param gameState The current state of the game.
   * @returns The initial Turn object.
   */
  private initializeTurn(gameState: GameState): Turn {
    const { boardWidth, boardHeight, playerIDs } = gameState
    const now = Date.now()

    // Initialize grid as an array of strings or null
    const grid: (string | null)[] = Array(boardWidth * boardHeight).fill(null)

    // Initialize playerPieces as occupied positions for each player
    const playerPieces: { [playerID: string]: number[] } = {}
    playerIDs.forEach((playerID) => {
      playerPieces[playerID] = []
    })

    // Initialize allowed moves (top row indices)
    const allowedMoves = this.calculateAllowedMoves(
      grid,
      boardWidth,
      boardHeight,
      playerIDs,
    )

    const firstTurn: Turn = {
      turnNumber: 1,
      boardWidth: boardWidth,
      boardHeight: boardHeight,
      gameType: gameState.gameType,
      playerIDs: playerIDs,
      playerHealth: {}, // Not used in Connect4
      hasMoved: {},
      turnTime: gameState.maxTurnTime,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + FirstMoveTimeoutSeconds * 1000),
      scores: {}, // Not used at the start
      alivePlayers: [...playerIDs],
      allowedMoves: allowedMoves,
      walls: [], // No walls in Connect4
      playerPieces: playerPieces, // Players' occupied positions
      food: [], // No food in Connect4
      hazards: [], // No hazards in Connect4
      clashes: [], // Initialize empty array for clashes
      gameOver: false,
      moves: {},
    }

    // Store grid as part of the turn for easy access
    ;(firstTurn as any).grid = grid

    return firstTurn
  }

  /**
   * Calculates allowed moves (columns that are not full).
   */
  private calculateAllowedMoves(
    grid: (string | null)[],
    boardWidth: number,
    boardHeight: number,
    playerIDs: string[],
  ): { [playerID: string]: number[] } {
    const allowedMoves: { [playerID: string]: number[] } = {}
    const topRowIndices: number[] = []

    for (let x = 0; x < boardWidth; x++) {
      const index = x
      if (grid[index] === null) {
        topRowIndices.push(index)
      }
    }

    // All players have the same allowed moves in Connect4
    playerIDs.forEach((playerID) => {
      allowedMoves[playerID] = [...topRowIndices]
    })

    return allowedMoves
  }

  /**
   * Applies the latest moves to the Connect4 game.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const { boardWidth, boardHeight, playerPieces } = this.currentTurn

      // Retrieve grid from the current turn
      const grid: (string | null)[] = (this.currentTurn as any).grid

      // Deep copy grid and playerPieces
      const newGrid = [...grid]
      const newPlayerPieces: { [playerID: string]: number[] } = {}
      Object.keys(playerPieces).forEach((playerID) => {
        newPlayerPieces[playerID] = [...playerPieces[playerID]]
      })

      // Clashes array
      const clashes: Clash[] = this.currentTurn.clashes
        ? [...this.currentTurn.clashes]
        : []

      // Map to track moves to columns
      const moveMap: { [column: number]: string[] } = {}

      // Map to track the final positions of moves for each player
      const latestMovePositions: { [playerID: string]: number } = {}

      // Process latest moves
      for (const move of this.latestMoves) {
        const { playerID, move: position } = move

        // Validate move
        const allowedMoves = this.currentTurn.allowedMoves[playerID]
        if (!allowedMoves.includes(position)) {
          logger.warn(
            `Connect4: Invalid move by ${playerID} to position ${position}.`,
          )
          continue
        }

        if (!moveMap[position]) {
          moveMap[position] = []
        }
        moveMap[position].push(playerID)
      }

      // Process moves and handle clashes
      for (const columnStr in moveMap) {
        const column = parseInt(columnStr)
        const players = moveMap[column]

        // Determine the target position (lowest available position in the column)
        let targetPosition = column
        while (
          targetPosition + boardWidth < boardWidth * boardHeight &&
          newGrid[targetPosition + boardWidth] === null
        ) {
          targetPosition += boardWidth
        }

        if (
          newGrid[targetPosition] !== null &&
          newGrid[targetPosition] !== "clash"
        ) {
          // Column is full
          logger.warn(
            `Connect4: Column ${column} is full. Moves by players ${players.join(
              ", ",
            )} ignored.`,
          )
          continue
        }

        if (players.length === 1) {
          const playerID = players[0]

          // Place the piece at the target position
          newGrid[targetPosition] = playerID

          // Update the player's occupied positions
          newPlayerPieces[playerID].push(targetPosition)

          // Record the latest move position for the player
          latestMovePositions[playerID] = targetPosition
        } else {
          // Clash occurs at targetPosition
          logger.warn(
            `Connect4: Clash at position ${targetPosition} by players ${players.join(
              ", ",
            )}.`,
          )

          // Record the clash
          clashes.push({
            index: targetPosition,
            playerIDs: players,
            reason: "Multiple players attempted to drop in the same column",
          })

          // Mark the grid position as a clash
          newGrid[targetPosition] = "clash"
        }
      }

      // Update allowed moves
      const newAllowedMoves = this.calculateAllowedMoves(
        newGrid,
        boardWidth,
        boardHeight,
        this.currentTurn.playerIDs,
      )

      // Update the current turn
      ;(this.currentTurn as any).grid = newGrid
      this.currentTurn.allowedMoves = newAllowedMoves
      this.currentTurn.playerPieces = newPlayerPieces
      this.currentTurn.clashes = clashes

      // Store the latest move positions for use in findWinners
      ;(this.currentTurn as any).latestMovePositions = latestMovePositions
    } catch (error) {
      logger.error(
        `Connect4: Error applying moves for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Finds winners based on the current state of the grid.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const { boardWidth, boardHeight, playerIDs } = this.currentTurn
      const grid: (string | null)[] = (this.currentTurn as any).grid
      const latestMovePositions: { [playerID: string]: number } =
        (this.currentTurn as any).latestMovePositions || {}

      if (this.latestMoves.length === 0) {
        return this.currentTurn.alivePlayers.map((player) => ({
          playerID: player,
          score: 0,
          winningSquares: [],
        }))
      }

      // Map to hold winning squares for each player
      const playerWinningLines: { [playerID: string]: number[] } = {}

      // Check for winners starting from their latest move positions
      for (const playerID of playerIDs) {
        const latestMovePos = latestMovePositions[playerID]
        if (latestMovePos === undefined) {
          continue
        }
        const winningSquares = this.checkWinnerAtPosition(
          grid,
          boardWidth,
          boardHeight,
          playerID,
          latestMovePos,
        )
        if (winningSquares.length >= 4) {
          playerWinningLines[playerID] = winningSquares
        }
      }

      const winners = Object.keys(playerWinningLines)

      if (winners.length === 1) {
        const winnerID = winners[0]
        const winner: Winner = {
          playerID: winnerID,
          score: 1,
          winningSquares: playerWinningLines[winnerID],
        }
        logger.info(`Connect4: Player ${winnerID} has won the game.`)
        return [winner]
      } else if (winners.length > 1) {
        // Multiple players won at the same time
        logger.info(
          `Connect4: Multiple players have won simultaneously: ${winners.join(
            ", ",
          )}. Converting winning moves to clashes.`,
        )

        // Convert only the positions of their latest moves to clashes
        for (const playerID of winners) {
          const latestMovePos = latestMovePositions[playerID]
          if (latestMovePos === undefined) {
            continue
          }

          // Avoid duplicate clashes at the same position
          if (
            (this.currentTurn.clashes || []).some(
              (clash) => clash.index === latestMovePos,
            )
          ) {
            continue
          }

          this.currentTurn.clashes!.push({
            index: latestMovePos,
            playerIDs: winners,
            reason: "Multiple players achieved a winning line simultaneously",
          })

          // Update grid to reflect the clash
          ;(this.currentTurn as any).grid[latestMovePos] = "clash"

          // Remove the piece from playerPieces
          const playerPieces = this.currentTurn.playerPieces[playerID]
          const index = playerPieces.indexOf(latestMovePos)
          if (index !== -1) {
            playerPieces.splice(index, 1)
          }
        }

        // No winner declared
        return []
      }

      // Check for draw (no more moves)
      const allCellsFilled = grid.every(
        (cell) => cell !== null && cell !== "clash",
      )
      if (allCellsFilled) {
        logger.info(`Connect4: Game ended in a draw.`)
        return playerIDs.map((playerID) => ({
          playerID,
          score: 0,
          winningSquares: [],
        }))
      }

      // Game continues
      return []
    } catch (error) {
      logger.error(
        `Connect4: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Checks if the player has a winning line starting from a specific position.
   */
  private checkWinnerAtPosition(
    grid: (string | null)[],
    boardWidth: number,
    boardHeight: number,
    playerID: string,
    position: number,
  ): number[] {
    const directions = [
      { dx: 1, dy: 0 }, // Horizontal
      { dx: 0, dy: 1 }, // Vertical
      { dx: 1, dy: 1 }, // Diagonal down-right
      { dx: 1, dy: -1 }, // Diagonal up-right
    ]

    const x = position % boardWidth
    const y = Math.floor(position / boardWidth)

    for (const { dx, dy } of directions) {
      const winningSquares = [position]

      // Check in the positive direction
      let nx = x + dx
      let ny = y + dy
      while (
        nx >= 0 &&
        nx < boardWidth &&
        ny >= 0 &&
        ny < boardHeight &&
        grid[ny * boardWidth + nx] === playerID
      ) {
        winningSquares.push(ny * boardWidth + nx)
        nx += dx
        ny += dy
      }

      // Check in the negative direction
      nx = x - dx
      ny = y - dy
      while (
        nx >= 0 &&
        nx < boardWidth &&
        ny >= 0 &&
        ny < boardHeight &&
        grid[ny * boardWidth + nx] === playerID
      ) {
        winningSquares.push(ny * boardWidth + nx)
        nx -= dx
        ny -= dy
      }

      if (winningSquares.length >= 4) {
        return winningSquares
      }
    }

    return []
  }
}
