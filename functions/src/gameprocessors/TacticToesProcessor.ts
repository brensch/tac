import { Clash, GameState, Move, Turn, Winner } from "@shared/types/Game"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "../logger"
import { GameProcessor } from "./GameProcessor"

/**
 * Processor class for the TacticToes game logic.
 */
export class TacticToesProcessor extends GameProcessor {
  constructor(gameState: GameState) {
    super(gameState)
  }

  /**
   * Initializes the first turn for TacticToes.
   * @returns The initial Turn object.
   */
  firstTurn(): Turn {
    const { boardWidth, boardHeight, gamePlayers, maxTurnTime } = this.gameSetup
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
      playerHealth: {}, // Not applicable in TacticToes
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + maxTurnTime * 1000),
      scores: {}, // Not applicable at the start
      alivePlayers: gamePlayers.map((p) => p.id),
      allowedMoves: allowedMoves,
      walls: [], // No walls in TacticToes
      playerPieces: playerPieces,
      food: [], // No food in TacticToes
      hazards: [], // No hazards in TacticToes
      clashes: [],
      moves: {},
      winners: [],
    }

    return firstTurn
  }

  /**
   * Applies the latest moves to the TacticToes game.
   */
  applyMoves(currentTurn: Turn, moves: Move[]): Turn {
    try {
      const { boardWidth, boardHeight } = this.gameSetup
      const {
        playerPieces,
        allowedMoves,
        clashes: existingClashes,
      } = currentTurn

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
      for (const move of moves) {
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
      const newMoves: { [playerID: string]: number } = {}
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
          newMoves[playerID] = position

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
      this.gameSetup.gamePlayers.forEach((player) => {
        newAllowedMoves[player.id] = [...freePositions]
      })

      // Calculate winners
      const winners = this.findWinners(newPlayerPieces, newMoves)

      // Handle simultaneous wins
      if (winners.length > 1) {
        winners.forEach((winner) => {
          const lastMove = newMoves[winner.playerID]
          if (lastMove !== undefined) {
            // Remove the last move from playerPieces
            const index = newPlayerPieces[winner.playerID].indexOf(lastMove)
            if (index !== -1) {
              newPlayerPieces[winner.playerID].splice(index, 1)
            }
            // Add clash for the last move
            clashes.push({
              index: lastMove,
              playerIDs: winners.map((w) => w.playerID),
              reason: "Multiple players achieved a winning line simultaneously",
            })
          }
        })
      }

      // Create the new turn
      const now = Date.now()
      const newTurn: Turn = {
        ...currentTurn,
        playerPieces: newPlayerPieces,
        allowedMoves: newAllowedMoves,
        clashes: clashes,
        moves: newMoves,
        winners: winners.length === 1 ? winners : [],
        startTime: Timestamp.fromMillis(now),
        endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      }

      return newTurn
    } catch (error) {
      logger.error(`TacticToes: Error applying moves:`, error)
      throw error
    }
  }

  /**
   * Finds winners based on the current state of the board.
   * @returns An array of Winner objects.
   */
  private findWinners(
    playerPieces: { [playerID: string]: number[] },
    lastMoves: { [playerID: string]: number },
  ): Winner[] {
    const { boardWidth, boardHeight, gamePlayers } = this.gameSetup

    // Collect winning lines for each player
    const winningLinesMap: { [playerID: string]: number[][] } = {}
    const playersWithWinningLines: string[] = []

    // Winning lines (rows, columns, diagonals)
    const lines = this.getAllPossibleLines(boardWidth, boardHeight)

    for (const player of gamePlayers) {
      const playerPositions = new Set(playerPieces[player.id])
      const winningLines: number[][] = []

      for (const line of lines) {
        const consecutiveCount = this.getMaxConsecutiveCount(
          line,
          playerPositions,
        )
        if (consecutiveCount >= 4) {
          winningLines.push(line)
        }
      }

      if (winningLines.length > 0) {
        winningLinesMap[player.id] = winningLines
        playersWithWinningLines.push(player.id)
      }
    }

    if (playersWithWinningLines.length >= 1) {
      return playersWithWinningLines.map((playerID) => ({
        playerID: playerID,
        score: 1,
        winningSquares: [lastMoves[playerID]], // Only include the last move
      }))
    }

    // Check for draw (no more moves)
    const totalCells = boardWidth * boardHeight
    const totalOccupied = Object.values(playerPieces).reduce(
      (sum, positions) => sum + positions.length,
      0,
    )
    if (totalOccupied >= totalCells) {
      logger.info(`TacticToes: Game ended in a draw.`)
      return gamePlayers.map((player) => ({
        playerID: player.id,
        score: 0,
        winningSquares: [],
      }))
    }

    // Game continues
    return []
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
