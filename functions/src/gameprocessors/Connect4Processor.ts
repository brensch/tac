import { GameSetup, Move, Turn, Winner } from "@shared/types/Game"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "../logger"
import { GameProcessor } from "./GameProcessor"

/**
 * Processor class for the Connect4 game logic.
 */
export class Connect4Processor extends GameProcessor {
  constructor(gameSetup: GameSetup) {
    super(gameSetup)
  }

  /**
   * Initializes the first turn for Connect4.
   * @returns The initial Turn object.
   */
  firstTurn(): Turn {
    const { gamePlayers } = this.gameSetup

    // Initialize playerPieces as occupied positions for each player
    const playerPieces: { [playerID: string]: number[] } = {}
    gamePlayers.forEach((player) => {
      playerPieces[player.id] = []
    })

    // Initialize allowed moves (positions one space above the highest existing piece in each column)
    const allowedMoves = this.calculateAllowedMoves(playerPieces)

    const now = Date.now()

    const firstTurn: Turn = {
      playerHealth: {}, // Not used in Connect4
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + 60 * 1000), // Add 60 seconds to the current time
      scores: {}, // Not used at the start
      alivePlayers: gamePlayers.map((player) => player.id), // Use player IDs
      allowedMoves: allowedMoves,
      walls: [], // No walls in Connect4
      playerPieces: playerPieces, // Players' occupied positions
      food: [], // No food in Connect4
      hazards: [], // No hazards in Connect4
      clashes: [], // Initialize empty array for clashes
      moves: {},
      winners: [], // Initialize empty winners array
    }

    return firstTurn
  }

  /**
   * Calculates allowed moves (positions one space above the highest existing piece in each column).
   */
  private calculateAllowedMoves(playerPieces: {
    [playerID: string]: number[]
  }): { [playerID: string]: number[] } {
    const { boardWidth, boardHeight, gamePlayers } = this.gameSetup
    const allowedMoves: { [playerID: string]: number[] } = {}
    const occupiedPositions = Object.values(playerPieces).flat()

    // All players have the same allowed moves in Connect4
    const topPositions: number[] = []

    for (let col = 0; col < boardWidth; col++) {
      for (let row = boardHeight - 1; row >= 0; row--) {
        const position = row * boardWidth + col
        if (!occupiedPositions.includes(position)) {
          topPositions.push(position)
          break
        }
      }
    }

    gamePlayers.forEach((player) => {
      allowedMoves[player.id] = topPositions
    })

    return allowedMoves
  }

  /**
   * Applies the latest moves to the Connect4 game and creates the nextTurn object.
   */
  applyMoves(currentTurn: Turn, moves: Move[]): Turn {
    const { playerPieces, allowedMoves, clashes } = currentTurn

    // Deep copy playerPieces and clashes
    const newPlayerPieces: { [playerID: string]: number[] } = {}
    Object.keys(playerPieces).forEach((playerID) => {
      newPlayerPieces[playerID] = [...playerPieces[playerID]]
    })
    const newClashes = [...clashes]

    // Track latest move positions and prepare a map for column moves
    const latestMovePositions: { [playerID: string]: number } = {}
    const moveMap: { [position: number]: string[] } = {}

    // Process latest moves
    for (const move of moves) {
      const { playerID, move: position } = move

      // Validate move
      if (!allowedMoves[playerID].includes(position)) {
        logger.warn(
          `Connect4: Invalid move by ${playerID} to position ${position}.`,
        )
        continue
      }

      if (!moveMap[position]) moveMap[position] = []
      moveMap[position].push(playerID)
    }

    // Apply moves and handle clashes
    for (const positionStr in moveMap) {
      const position = parseInt(positionStr)
      const players = moveMap[position]

      if (players.length === 1) {
        const playerID = players[0]

        // Place the piece at the target position
        newPlayerPieces[playerID].push(position)

        // Record the latest move position for the player
        latestMovePositions[playerID] = position
      } else {
        // Handle clash at the target position
        logger.warn(
          `Connect4: Clash at position ${position} by players ${players.join(
            ", ",
          )}.`,
        )
        newClashes.push({
          index: position,
          playerIDs: players,
          reason: "Multiple players attempted to drop in the same column",
        })
      }
    }

    // Update allowed moves (positions one above the highest existing piece in each column)
    const newAllowedMoves = this.calculateAllowedMoves(newPlayerPieces)

    const now = Date.now()

    // Create the nextTurn object
    const nextTurn: Turn = {
      ...currentTurn,
      playerPieces: newPlayerPieces,
      allowedMoves: newAllowedMoves,
      clashes: newClashes,
      moves: latestMovePositions,
      startTime: Timestamp.fromMillis(now),
      winners: [], // Will be updated after winner calculation
    }

    // Calculate winners and update nextTurn
    const winners = this.findWinners(nextTurn)
    nextTurn.winners = winners

    return nextTurn
  }

  /**
   * Finds winners based on the current state of the playerPieces.
   * @returns An array of Winner objects.
   */
  private findWinners(nextTurn: Turn): Winner[] {
    try {
      const { boardWidth, boardHeight, gamePlayers } = this.gameSetup
      const { playerPieces } = nextTurn

      let occupiedPositions = Object.values(playerPieces).flat()

      if (Object.keys(nextTurn.moves).length === 0) {
        return []
      }

      // Map to hold winning squares for each player
      const playerWinningLines: { [playerID: string]: number[] } = {}

      // Check for winners starting from their latest move positions
      for (const player of gamePlayers) {
        const latestMovePos = nextTurn.moves[player.id]
        if (latestMovePos === undefined) {
          continue
        }
        const winningSquares = this.checkWinnerAtPosition(
          playerPieces[player.id],
          boardWidth,
          boardHeight,
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
          )}. Converting winning lines to clashes.`,
        )

        // Convert the winning squares to clashes and remove them from playerPieces
        for (const playerID of winners) {
          const winningSquares = playerWinningLines[playerID]

          for (const index of winningSquares) {
            // Avoid duplicate clashes at the same position
            if (!nextTurn.clashes.some((clash) => clash.index === index)) {
              nextTurn.clashes.push({
                index: index,
                playerIDs: winners,
                reason:
                  "Multiple players achieved a winning line simultaneously",
              })
            }

            // Remove the piece from playerPieces
            const playerPiecePositions = nextTurn.playerPieces[playerID]
            const idx = playerPiecePositions.indexOf(index)
            if (idx !== -1) {
              playerPiecePositions.splice(idx, 1)
            }
          }
        }

        // Recompute occupied positions after removing pieces
        occupiedPositions = Object.values(playerPieces).flat()

        // No winner declared
        return []
      }

      // Check for draw (no more allowed moves)
      const allColumnsFull = this.checkAllColumnsFull(occupiedPositions)
      if (allColumnsFull) {
        logger.info(`Connect4: Game ended in a draw.`)
        return []
      }

      // Game continues
      return []
    } catch (error) {
      logger.error(`Connect4: Error finding winners for game `, error)
      throw error
    }
  }

  /**
   * Checks if the player has a winning line starting from a specific position.
   */
  private checkWinnerAtPosition(
    playerPositions: number[],
    boardWidth: number,
    boardHeight: number,
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
        playerPositions.includes(ny * boardWidth + nx)
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
        playerPositions.includes(ny * boardWidth + nx)
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

  /**
   * Checks if all columns are full.
   */
  private checkAllColumnsFull(occupiedPositions: number[]): boolean {
    const { boardWidth } = this.gameSetup

    for (let col = 0; col < boardWidth; col++) {
      const topPosition = col
      if (!occupiedPositions.includes(topPosition)) {
        return false
      }
    }

    return true
  }
}
