import { GameProcessor } from "./GameProcessor"
import { Winner, Turn, Move, GameState, Clash } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"
import { FirstMoveTimeoutSeconds } from "../timings"

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
    const { boardWidth, boardHeight, gamePlayers } = gameState
    const now = Date.now()

    // Initialize playerPieces as occupied positions for each player
    const playerPieces: { [playerID: string]: number[] } = {}
    gamePlayers.forEach((player) => {
      playerPieces[player.id] = []
    })

    // Initialize allowed moves (all positions on the board)
    const totalCells = boardWidth * boardHeight
    const allPositions = Array.from({ length: totalCells }, (_, index) => index)
    const allowedMoves: { [playerID: string]: number[] } = {}
    gamePlayers.forEach((player) => {
      allowedMoves[player.id] = [...allPositions]
    })

    const firstTurn: Turn = {
      turnNumber: 1,
      boardWidth: boardWidth,
      boardHeight: boardHeight,
      gameType: gameState.gameType,
      players: gamePlayers,
      playerHealth: {}, // Not applicable in TacticToes
      hasMoved: {},
      turnTime: gameState.maxTurnTime,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + FirstMoveTimeoutSeconds * 1000),
      scores: {}, // Not applicable at the start
      alivePlayers: [...gamePlayers.map((p) => p.id)],
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
      this.currentTurn.players.forEach((player) => {
        newAllowedMoves[player.id] = [...freePositions]
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
      const { boardWidth, boardHeight, players, playerPieces } =
        this.currentTurn

      if (this.latestMoves.length === 0) {
        return this.currentTurn.alivePlayers.map((player) => ({
          playerID: player,
          score: 0,
          winningSquares: [],
        }))
      }

      // Collect winning lines for each player
      const winningLinesMap: { [playerID: string]: number[][] } = {}
      const allWinningSquares = new Set<number>()
      const playersWithWinningLines: string[] = []

      // Winning lines (rows, columns, diagonals)
      const lines = this.getAllPossibleLines(boardWidth, boardHeight)

      for (const player of players) {
        const playerPositions = new Set(playerPieces[player.id])
        const winningLines: number[][] = []

        for (const line of lines) {
          const consecutiveCount = this.getMaxConsecutiveCount(
            line,
            playerPositions,
          )
          if (consecutiveCount >= 4) {
            winningLines.push(line)
            line.forEach((pos) => allWinningSquares.add(pos))
          }
        }

        if (winningLines.length > 0) {
          winningLinesMap[player.id] = winningLines
          playersWithWinningLines.push(player.id)
        }
      }

      if (playersWithWinningLines.length === 1) {
        // Single winner
        const winnerID = playersWithWinningLines[0]
        const winningSquares = Array.from(
          new Set(winningLinesMap[winnerID].flat()),
        )
        const winner: Winner = {
          playerID: winnerID,
          score: 1,
          winningSquares,
        }
        logger.info(`TacticToes: Player ${winnerID} has won the game.`)
        return [winner]
      } else if (playersWithWinningLines.length > 1) {
        // Multiple winners: Convert winning moves to clashes
        const clashes = this.currentTurn.clashes || []
        const involvedPlayers = playersWithWinningLines

        // For each winning square, create a clash
        this.latestMoves
          .filter((move) => playersWithWinningLines.includes(move.playerID))
          .forEach((position) => {
            // Remove the position from playerPieces
            for (const playerID of involvedPlayers) {
              if (!this.currentTurn) continue
              const index = this.currentTurn.playerPieces[playerID].indexOf(
                position.move,
              )
              if (index !== -1) {
                this.currentTurn.playerPieces[playerID].splice(index, 1)
              }
            }

            // Add to clashes if not already present
            if (!clashes.some((clash) => clash.index === position.move)) {
              clashes.push({
                index: position.move,
                playerIDs: involvedPlayers,
                reason: `Clash due to multiple players achieving a winning line`,
              })
            }
          })

        // Update the turn's clashes
        this.currentTurn.clashes = clashes

        // No winners, game continues or ends in a draw if no moves left
        logger.info(
          `TacticToes: Multiple players achieved a winning line simultaneously. Winning moves have become clashes.`,
        )
        return []
      }

      // Check for draw (no more moves)
      const totalCells = boardWidth * boardHeight
      const totalOccupied =
        Object.values(this.currentTurn.playerPieces).reduce(
          (sum, positions) => sum + positions.length,
          0,
        ) + (this.currentTurn.clashes?.length || 0)
      if (totalOccupied >= totalCells) {
        logger.info(`TacticToes: Game ended in a draw.`)
        return players.map((player) => ({
          playerID: player.id,
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
   * Helper method to get all possible lines (rows, columns, diagonals) of length 4 or more.
   */
  private getAllPossibleLines(
    boardWidth: number,
    boardHeight: number,
  ): number[][] {
    const lines: number[][] = []

    // Directions: horizontal, vertical, diagonal /
    const directions = [
      { dx: 1, dy: 0 }, // Horizontal
      { dx: 0, dy: 1 }, // Vertical
      { dx: 1, dy: 1 }, // Diagonal down-right
      { dx: 1, dy: -1 }, // Diagonal up-right
    ]

    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        for (const { dx, dy } of directions) {
          const line: number[] = []
          let nx = x
          let ny = y

          while (
            nx >= 0 &&
            nx < boardWidth &&
            ny >= 0 &&
            ny < boardHeight &&
            line.length < 4
          ) {
            line.push(ny * boardWidth + nx)
            nx += dx
            ny += dy
          }

          if (line.length >= 4) {
            lines.push(line)
          }
        }
      }
    }

    return lines
  }

  /**
   * Helper method to get the maximum consecutive count in a line for a player's positions.
   */
  private getMaxConsecutiveCount(
    line: number[],
    playerPositions: Set<number>,
  ): number {
    let maxCount = 0
    let currentCount = 0

    for (const pos of line) {
      if (playerPositions.has(pos)) {
        currentCount++
        if (currentCount > maxCount) {
          maxCount = currentCount
        }
      } else {
        currentCount = 0
      }
    }

    return maxCount
  }
}
