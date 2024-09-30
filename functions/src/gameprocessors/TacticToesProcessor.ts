// functions/src/gameprocessors/TacticToesProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Turn, Move, GameState, Clash } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"

/**
 * Processor class for the TacticToes game logic.
 */
export class TacticToesProcessor extends GameProcessor {
  constructor(
    transaction: Transaction,
    gameID: string,
    latestMoves: Move[],
    currentTurn?: Turn,
  ) {
    super(transaction, gameID, latestMoves, currentTurn)
  }

  /**
   * Initializes the TacticToes game by setting up the initial turn.
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
        `TacticToes: Turn 1 created and game ${this.gameID} has started.`,
      )
    } catch (error) {
      logger.error(`TacticToes: Error initializing game ${this.gameID}:`, error)
      throw error
    }
  }

  /**
   * Initializes the first turn for TacticToes.
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
      playerHealth: {}, // Not applicable in TacticToes
      hasMoved: {},
      turnTime: gameState.maxTurnTime,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + gameState.maxTurnTime * 1000),
      scores: {}, // Not applicable at the start
      alivePlayers: [...playerIDs],
      allowedMoves: allowedMoves,
      walls: [], // No walls in TacticToes
      playerPieces: playerPieces, // Players' occupied positions
      food: [], // No food in TacticToes
      hazards: [], // No hazards in TacticToes
      clashes: [], // Initialize empty array for clashes
      gameOver: false,
      moves: {},
    }

    return firstTurn
  }

  /**
   * Applies the latest moves to the TacticToes game.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const {
        boardWidth,
        boardHeight,
        playerPieces,
        allowedMoves,
        clashes: existingClashes,
      } = this.currentTurn

      // Deep copy playerPieces
      const newPlayerPieces: { [playerID: string]: number[] } = {}
      Object.keys(playerPieces).forEach((playerID) => {
        newPlayerPieces[playerID] = [...playerPieces[playerID]]
      })

      // Clashes array, start with existing clashes
      const clashes: Clash[] = existingClashes ? [...existingClashes] : []

      // Set of occupied positions (claimed positions and clashes)
      const occupiedPositions = new Set<number>()
      Object.values(newPlayerPieces).forEach((positions) => {
        positions.forEach((pos) => occupiedPositions.add(pos))
      })
      clashes.forEach((clash) => {
        occupiedPositions.add(clash.index)
      })

      // Map to track moves to positions
      const moveMap: { [position: number]: string[] } = {}

      // Process latest moves
      for (const move of this.latestMoves) {
        const { playerID, move: position } = move

        // Validate move
        const allowedMovesForPlayer = allowedMoves[playerID]
        if (!allowedMovesForPlayer.includes(position)) {
          logger.warn(
            `TacticToes: Invalid move by ${playerID} to position ${position}.`,
          )
          continue
        }

        if (!moveMap[position]) {
          moveMap[position] = []
        }
        moveMap[position].push(playerID)
      }

      // Process moves and handle clashes
      for (const positionStr in moveMap) {
        const position = parseInt(positionStr)
        const players = moveMap[position]

        if (occupiedPositions.has(position)) {
          // Position already occupied
          logger.warn(
            `TacticToes: Position ${position} already occupied. Moves by players ${players.join(
              ", ",
            )} ignored.`,
          )
          continue
        }

        if (players.length === 1) {
          const playerID = players[0]

          // Claim the position
          newPlayerPieces[playerID].push(position)

          // Add to occupied positions
          occupiedPositions.add(position)
        } else {
          // Clash occurs at position
          logger.warn(
            `TacticToes: Clash at position ${position} by players ${players.join(
              ", ",
            )}.`,
          )

          // Record the clash
          clashes.push({
            index: position,
            playerIDs: players,
            reason: "Multiple players attempted to claim the same position",
          })

          // Add to occupied positions
          occupiedPositions.add(position)
        }
      }

      // Update allowed moves
      const totalCells = boardWidth * boardHeight
      const allPositions = Array.from(
        { length: totalCells },
        (_, index) => index,
      )
      const freePositions = allPositions.filter(
        (pos) => !occupiedPositions.has(pos),
      )
      const newAllowedMoves: { [playerID: string]: number[] } = {}
      this.currentTurn.playerIDs.forEach((playerID) => {
        newAllowedMoves[playerID] = [...freePositions]
      })

      // Update the current turn
      this.currentTurn.allowedMoves = newAllowedMoves
      this.currentTurn.playerPieces = newPlayerPieces
      this.currentTurn.clashes = clashes
    } catch (error) {
      logger.error(
        `TacticToes: Error applying moves for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Finds winners based on the current state of the board.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const { boardWidth, boardHeight, playerIDs, playerPieces } =
        this.currentTurn

      if (this.latestMoves.length === 0) {
        return this.currentTurn.alivePlayers.map((player) => ({
          playerID: player,
          score: 0,
          winningSquares: [],
        }))
      }

      // Implement game-specific logic to determine a winner
      // For TacticToes, a player wins by occupying all positions in a row, column, or diagonal.

      // Example winning conditions (rows, columns, diagonals)
      const lines = this.getWinningLines(boardWidth, boardHeight)

      for (const playerID of playerIDs) {
        const playerPositions = new Set(playerPieces[playerID])
        for (const line of lines) {
          if (line.every((pos) => playerPositions.has(pos))) {
            // Player has won
            const winner: Winner = {
              playerID,
              score: 1,
              winningSquares: line,
            }
            logger.info(`TacticToes: Player ${playerID} has won the game.`)
            return [winner]
          }
        }
      }

      // Check for draw (no more moves)
      const totalCells = boardWidth * boardHeight
      const totalOccupied =
        Object.values(playerPieces).reduce(
          (sum, positions) => sum + positions.length,
          0,
        ) + (this.currentTurn.clashes?.length || 0)
      if (totalOccupied >= totalCells) {
        logger.info(`TacticToes: Game ended in a draw.`)
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
        `TacticToes: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Helper method to get all winning lines (rows, columns, diagonals).
   */
  private getWinningLines(boardWidth: number, boardHeight: number): number[][] {
    const lines: number[][] = []

    // Rows
    for (let y = 0; y < boardHeight; y++) {
      const row: number[] = []
      for (let x = 0; x < boardWidth; x++) {
        row.push(y * boardWidth + x)
      }
      lines.push(row)
    }

    // Columns
    for (let x = 0; x < boardWidth; x++) {
      const column: number[] = []
      for (let y = 0; y < boardHeight; y++) {
        column.push(y * boardWidth + x)
      }
      lines.push(column)
    }

    // Diagonals (if square board)
    if (boardWidth === boardHeight) {
      const diag1: number[] = []
      const diag2: number[] = []
      for (let i = 0; i < boardWidth; i++) {
        diag1.push(i * boardWidth + i)
        diag2.push(i * boardWidth + (boardWidth - i - 1))
      }
      lines.push(diag1)
      lines.push(diag2)
    }

    return lines
  }
}
