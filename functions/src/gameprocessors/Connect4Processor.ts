import { Clash, GameSetup, Move, Turn, Winner } from "@shared/types/Game"
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

  firstTurn(): Turn {
    const { gamePlayers } = this.gameSetup

    const playerPieces: { [playerID: string]: number[] } = {}
    gamePlayers.forEach((player) => {
      playerPieces[player.id] = []
    })

    const allowedMoves = this.calculateAllowedMoves(playerPieces, [])

    const now = Date.now()

    const firstTurn: Turn = {
      playerHealth: {},
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      scores: {},
      alivePlayers: gamePlayers.map((player) => player.id),
      allowedMoves: allowedMoves,
      walls: [],
      playerPieces: playerPieces,
      food: [],
      hazards: [],
      clashes: [],
      moves: {},
      winners: [],
    }

    return firstTurn
  }

  private calculateAllowedMoves(
    playerPieces: { [playerID: string]: number[] },
    clashes: Clash[],
  ): { [playerID: string]: number[] } {
    const { boardWidth, boardHeight, gamePlayers } = this.gameSetup
    const allowedMoves: { [playerID: string]: number[] } = {}
    const occupiedPositions = new Set([
      ...Object.values(playerPieces).flat(),
      ...clashes.map((clash) => clash.index),
    ])

    const topPositions: number[] = []

    for (let col = 0; col < boardWidth; col++) {
      for (let row = boardHeight - 1; row >= 0; row--) {
        const position = row * boardWidth + col
        if (!occupiedPositions.has(position)) {
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

  applyMoves(currentTurn: Turn, moves: Move[]): Turn {
    const { playerPieces, allowedMoves, clashes } = currentTurn

    const newPlayerPieces: { [playerID: string]: number[] } = {}
    Object.keys(playerPieces).forEach((playerID) => {
      newPlayerPieces[playerID] = [...playerPieces[playerID]]
    })
    const newClashes = [...clashes]

    const latestMovePositions: { [playerID: string]: number } = {}
    const moveMap: { [position: number]: string[] } = {}

    for (const move of moves) {
      const { playerID, move: position } = move

      if (!allowedMoves[playerID].includes(position)) {
        logger.warn(
          `Connect4: Invalid move by ${playerID} to position ${position}.`,
        )
        continue
      }

      if (!moveMap[position]) moveMap[position] = []
      moveMap[position].push(playerID)
    }

    for (const positionStr in moveMap) {
      const position = parseInt(positionStr)
      const players = moveMap[position]

      if (players.length === 1) {
        const playerID = players[0]
        newPlayerPieces[playerID].push(position)
        latestMovePositions[playerID] = position
      } else {
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

    const newAllowedMoves = this.calculateAllowedMoves(
      newPlayerPieces,
      newClashes,
    )

    const now = Date.now()

    const nextTurn: Turn = {
      ...currentTurn,
      playerPieces: newPlayerPieces,
      allowedMoves: newAllowedMoves,
      clashes: newClashes,
      moves: latestMovePositions,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      winners: [],
    }

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
      const { playerPieces, moves } = nextTurn

      if (Object.keys(moves).length === 0) {
        return []
      }

      // Map to hold winning squares for each player
      const playerWinningLines: { [playerID: string]: number[] } = {}

      // Check for winners starting from their latest move positions
      for (const player of gamePlayers) {
        const latestMovePos = moves[player.id]
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
          )}. Converting latest moves to clashes.`,
        )

        // Convert only the latest moves to clashes
        const newClashes = winners.map((playerID) => ({
          index: moves[playerID],
          playerIDs: winners,
          reason: "Multiple players achieved a winning line simultaneously",
        }))

        // Add new clashes to the turn
        nextTurn.clashes.push(...newClashes)

        // Remove the clashing pieces from playerPieces
        winners.forEach((playerID) => {
          const playerPiecePositions = nextTurn.playerPieces[playerID]
          const idx = playerPiecePositions.indexOf(moves[playerID])
          if (idx !== -1) {
            playerPiecePositions.splice(idx, 1)
          }
        })

        // No winner declared in case of simultaneous wins
        return []
      }

      // Check for draw (no more allowed moves)
      const occupiedPositions = Object.values(playerPieces).flat()
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
