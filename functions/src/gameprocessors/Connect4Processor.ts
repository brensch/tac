import { GameProcessor } from "./GameProcessor"
import {
  Winner,
  Turn,
  Move,
  GameState,
  Clash,
  GamePlayer,
} from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { FieldValue, Transaction } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"
import { FirstMoveTimeoutSeconds } from "../timings"

/**
 * Processor class for the Connect4 game logic.
 */
export class Connect4Processor extends GameProcessor {
  constructor(
    gameState: GameState, // transaction: Transaction, // gameID: string, // latestMoves: Move[], // currentTurn?: Turn,
  ) {
    super(gameState)
  }

  // /**
  //  * Initializes the Connect4 game by setting up the initial turn.
  //  * @param gameState The current state of the game.
  //  */
  // async initializeGame(): Turn {
  //   try {
  //     const initialTurn = this.initializeTurn(gameState)

  //     // Construct DocumentReference for the first turn
  //     const turnRef = admin
  //       .firestore()
  //       .collection(`games/${this.gameID}/turns`)
  //       .doc("1")

  //     // Set turn and update game within transaction
  //     this.transaction.set(turnRef, initialTurn)

  //     // Reference to the game document
  //     const gameRef = admin.firestore().collection("games").doc(this.gameID)

  //     // Update the game document to mark it as started
  //     this.transaction.update(gameRef, { started: true })

  //     logger.info(
  //       `Connect4: Turn 1 created and game ${this.gameID} has started.`,
  //     )
  //   } catch (error) {
  //     logger.error(`Connect4: Error initializing game ${this.gameID}:`, error)
  //     throw error
  //   }
  // }

  /**
   * Initializes the first turn for Connect4.
   * @param gameState The current state of the game.
   * @returns The initial Turn object.
   */
  initializeTurn(): Turn {
    const { boardWidth, boardHeight, gamePlayers } = this.gameState.Setup
    const now = Date.now()

    // Initialize grid as an array of strings or null
    const grid: (string | null)[] = Array(boardWidth * boardHeight).fill(null)

    // Initialize playerPieces as occupied positions for each player
    const playerPieces: { [playerID: string]: number[] } = {}
    gamePlayers.forEach((player) => {
      playerPieces[player.id] = []
    })

    // Initialize allowed moves (top row indices)
    const allowedMoves = this.calculateAllowedMoves(
      grid,
      boardWidth,
      boardHeight,
      gamePlayers,
    )

    const firstTurn: Turn = {
      playerHealth: {}, // Not used in Connect4
      startTime: FieldValue.serverTimestamp(),
      scores: {}, // Not used at the start
      alivePlayers: gamePlayers.map((player) => player.id), // Use player IDs
      allowedMoves: allowedMoves,
      walls: [], // No walls in Connect4
      playerPieces: playerPieces, // Players' occupied positions
      food: [], // No food in Connect4
      hazards: [], // No hazards in Connect4
      clashes: [], // Initialize empty array for clashes
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
    gamePlayers: GamePlayer[],
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
    gamePlayers.forEach((player) => {
      allowedMoves[player.id] = [...topRowIndices]
    })

    return allowedMoves
  }

  /**
   * Applies the latest moves to the Connect4 game and creates the nextTurn object.
   */
  applyMoves(moves: Move[]): Turn | null {
    if (!this.currentTurn) return null

    const { playerPieces, allowedMoves, clashes } = this.currentTurn
    const { boardWidth, boardHeight } = this.gameState

    // Deep copy playerPieces
    const newPlayerPieces: { [playerID: string]: number[] } = {}
    Object.keys(playerPieces).forEach((playerID) => {
      newPlayerPieces[playerID] = [...playerPieces[playerID]]
    })

    // Track latest move positions and prepare a map for column moves
    const latestMovePositions: { [playerID: string]: number } = {}
    const moveMap: { [column: number]: string[] } = {}

    // Process latest moves
    for (const move of moves) {
      const { playerID, move: position } = move
      const column = position % boardWidth

      // Validate move
      if (!allowedMoves[playerID].includes(position)) {
        logger.warn(
          `Connect4: Invalid move by ${playerID} to position ${position}.`,
        )
        continue
      }

      if (!moveMap[column]) moveMap[column] = []
      moveMap[column].push(playerID)
    }

    // Apply moves and handle clashes
    for (const columnStr in moveMap) {
      const column = parseInt(columnStr)
      const players = moveMap[column]

      // Determine the target position based on the player's current pieces
      let targetPosition = column
      while (
        targetPosition + boardWidth < boardWidth * boardHeight &&
        Object.values(newPlayerPieces).every(
          (pieces) => !pieces.includes(targetPosition + boardWidth),
        )
      ) {
        targetPosition += boardWidth
      }

      // Check if the target position is occupied
      if (
        Object.values(newPlayerPieces).some((pieces) =>
          pieces.includes(targetPosition),
        )
      ) {
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
        newPlayerPieces[playerID].push(targetPosition)

        // Record the latest move position for the player
        latestMovePositions[playerID] = targetPosition
      } else {
        // Handle clash at the target position
        logger.warn(
          `Connect4: Clash at position ${targetPosition} by players ${players.join(
            ", ",
          )}.`,
        )
        clashes.push({
          index: targetPosition,
          playerIDs: players,
          reason: "Multiple players attempted to drop in the same column",
        })
      }
    }

    // Update allowed moves (spaces one above the highest point in each column)
    const newAllowedMoves: { [playerID: string]: number[] } = {}
    Object.keys(newPlayerPieces).forEach((playerID) => {
      newAllowedMoves[playerID] = []
      for (let col = 0; col < boardWidth; col++) {
        let highestPosition = col
        while (
          highestPosition + boardWidth < boardWidth * boardHeight &&
          Object.values(newPlayerPieces).some((pieces) =>
            pieces.includes(highestPosition + boardWidth),
          )
        ) {
          highestPosition += boardWidth
        }
        if (
          !Object.values(newPlayerPieces).some((pieces) =>
            pieces.includes(highestPosition),
          )
        ) {
          newAllowedMoves[playerID].push(highestPosition)
        }
      }
    })

    // Create the nextTurn object
    const nextTurn: Turn = {
      ...this.currentTurn,
      playerPieces: newPlayerPieces,
      allowedMoves: newAllowedMoves,
      clashes,
      moves: latestMovePositions,
      startTime: FieldValue.serverTimestamp(),
    }

    return nextTurn
  }

  /**
   * Finds winners based on the current state of the grid.
   * @returns An array of Winner objects.
   */
  findWinners(): Winner[] {
    if (!this.currentTurn) return []
    try {
      const { boardWidth, boardHeight, gamePlayers } = this.gameState
      const grid: (string | null)[] = (this.currentTurn as any).grid
      const latestMovePositions: { [playerID: string]: number } =
        (this.currentTurn as any).latestMovePositions || {}

      if (this.currentTurn.moves.length === 0) {
        return this.currentTurn.alivePlayers.map((playerID) => ({
          playerID,
          score: 0,
          winningSquares: [],
        }))
      }

      // Map to hold winning squares for each player
      const playerWinningLines: { [playerID: string]: number[] } = {}

      // Check for winners starting from their latest move positions
      for (const player of gamePlayers) {
        const latestMovePos = latestMovePositions[player.id]
        if (latestMovePos === undefined) {
          continue
        }
        const winningSquares = this.checkWinnerAtPosition(
          grid,
          boardWidth,
          boardHeight,
          player.id,
          latestMovePos,
        )
        if (winningSquares.length >= 4) {
          playerWinningLines[player.id] = winningSquares
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
        return gamePlayers.map((player) => ({
          playerID: player.id,
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
