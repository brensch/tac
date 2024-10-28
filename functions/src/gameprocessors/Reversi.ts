// functions/src/gameprocessors/ReversiProcessor.ts

import { GameState, Move, Turn } from "@shared/types/Game"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "../logger"
import { GameProcessor } from "./GameProcessor"

/**
 * Processor class for the Reversi game logic.
 */
export class ReversiProcessor extends GameProcessor {
  constructor(gameState: GameState) {
    super(gameState)
  }

  firstTurn(): Turn {
    const { gamePlayers, boardWidth, boardHeight, maxTurnTime } = this.gameSetup

    if (gamePlayers.length !== 2) {
      throw new Error("Reversi requires exactly two players.")
    }

    const player1ID = gamePlayers[0].id
    const player2ID = gamePlayers[1].id

    const playerPieces: { [playerID: string]: number[] } = {
      [player1ID]: [],
      [player2ID]: [],
    }

    // Standard initial positions in Reversi
    const centerX = Math.floor(boardWidth / 2) - 1
    const centerY = Math.floor(boardHeight / 2) - 1

    const pos1 = centerY * boardWidth + centerX // (3,3)
    const pos2 = (centerY + 1) * boardWidth + (centerX + 1) // (4,4)
    const pos3 = centerY * boardWidth + (centerX + 1) // (3,4)
    const pos4 = (centerY + 1) * boardWidth + centerX // (4,3)

    // Assign initial pieces
    playerPieces[player1ID].push(pos1, pos2)
    playerPieces[player2ID].push(pos3, pos4)

    const now = Date.now()

    // Black always moves first in Reversi
    const currentPlayerID = player1ID

    const allowedMoves = this.calculateAllowedMovesForPlayer(
      playerPieces,
      currentPlayerID,
    )

    const firstTurn: Turn = {
      playerHealth: {},
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + maxTurnTime * 1000),
      scores: {},
      alivePlayers: [currentPlayerID], // Only the current player is active
      playerPieces: playerPieces,
      allowedMoves: { [currentPlayerID]: allowedMoves },
      walls: [],
      food: [],
      hazards: [],
      clashes: [],
      moves: {},
      winners: [],
    }

    return firstTurn
  }

  applyMoves(currentTurn: Turn, moves: Move[]): Turn {
    const { gamePlayers, maxTurnTime } = this.gameSetup
    const { playerPieces } = currentTurn

    const currentPlayerID = currentTurn.alivePlayers[0]
    const opponentID = this.getOpponentID(currentPlayerID)

    const move = moves.find((m) => m.playerID === currentPlayerID)

    if (!move) {
      // Player has timed out
      logger.warn(`Reversi: Player ${currentPlayerID} timed out.`)

      // Declare opponent as winner due to timeout
      const opponentPieces = playerPieces[opponentID]
      const opponentScore = opponentPieces.length

      const nextTurn: Turn = {
        ...currentTurn,
        winners: [
          {
            playerID: opponentID,
            score: opponentScore,
            winningSquares: opponentPieces,
          },
        ],
        alivePlayers: [],
        startTime: Timestamp.fromMillis(Date.now()),
        endTime: Timestamp.fromMillis(Date.now()),
      }

      logger.info(
        `Reversi: Player ${opponentID} wins due to opponent's timeout.`,
      )
      return nextTurn
    } else {
      const position = move.move
      const allowedMoves = currentTurn.allowedMoves[currentPlayerID]

      if (!allowedMoves.includes(position)) {
        logger.warn(
          `Reversi: Invalid move by player ${currentPlayerID} at position ${position}.`,
        )

        // Declare opponent as winner due to invalid move
        const opponentPieces = playerPieces[opponentID]
        const opponentScore = opponentPieces.length

        const nextTurn: Turn = {
          ...currentTurn,
          winners: [
            {
              playerID: opponentID,
              score: opponentScore,
              winningSquares: opponentPieces,
            },
          ],
          alivePlayers: [],
          startTime: Timestamp.fromMillis(Date.now()),
          endTime: Timestamp.fromMillis(Date.now()),
        }

        logger.info(
          `Reversi: Player ${opponentID} wins due to opponent's invalid move.`,
        )
        return nextTurn
      } else {
        playerPieces[currentPlayerID].push(position)
        const flippedPositions = this.flipOpponentPieces(
          playerPieces,
          currentPlayerID,
          position,
        )
        logger.info(
          `Reversi: Player ${currentPlayerID} placed at position ${position}, flipping ${flippedPositions.length} pieces.`,
        )
      }
    }

    // Check for next player's possible moves
    const nextPlayerID = opponentID
    const nextPlayerAllowedMoves = this.calculateAllowedMovesForPlayer(
      playerPieces,
      nextPlayerID,
    )

    const now = Date.now()

    const nextTurn: Turn = {
      ...currentTurn,
      playerPieces: playerPieces,
      allowedMoves: {},
      walls: [],
      food: [],
      hazards: [],
      clashes: [],
      moves: {},
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + maxTurnTime * 1000),
      alivePlayers: [],
      winners: [],
    }

    nextTurn.scores = {
      [gamePlayers[0].id]: playerPieces[gamePlayers[0].id].length,
      [gamePlayers[1].id]: playerPieces[gamePlayers[1].id].length,
    }

    if (nextPlayerAllowedMoves.length > 0) {
      // Next player has valid moves
      nextTurn.alivePlayers = [nextPlayerID]
      nextTurn.allowedMoves[nextPlayerID] = nextPlayerAllowedMoves
    } else {
      // Check if current player has any moves
      const currentPlayerAllowedMoves = this.calculateAllowedMovesForPlayer(
        playerPieces,
        currentPlayerID,
      )

      if (currentPlayerAllowedMoves.length > 0) {
        // Current player gets another turn
        nextTurn.alivePlayers = [currentPlayerID]
        nextTurn.allowedMoves[currentPlayerID] = currentPlayerAllowedMoves
      } else {
        // No moves left for either player, determine winner
        const player1Score = nextTurn.scores[gamePlayers[0].id]
        const player2Score = nextTurn.scores[gamePlayers[1].id]

        if (player1Score > player2Score) {
          nextTurn.winners = [
            {
              playerID: gamePlayers[0].id,
              score: player1Score,
              winningSquares: playerPieces[gamePlayers[0].id],
            },
          ]
        } else if (player2Score > player1Score) {
          nextTurn.winners = [
            {
              playerID: gamePlayers[1].id,
              score: player2Score,
              winningSquares: playerPieces[gamePlayers[1].id],
            },
          ]
        } else {
          // It's a draw
          nextTurn.winners = []
        }
        nextTurn.alivePlayers = []
        nextTurn.endTime = Timestamp.fromMillis(now)
        logger.info(
          `Reversi: Game over. Final scores - ${JSON.stringify(
            nextTurn.scores,
          )}`,
        )
      }
    }

    return nextTurn
  }

  private calculateAllowedMovesForPlayer(
    playerPieces: { [playerID: string]: number[] },
    playerID: string,
  ): number[] {
    const { boardWidth, boardHeight } = this.gameSetup
    const opponentID = this.getOpponentID(playerID)
    const opponentPieces = playerPieces[opponentID]
    const ownPieces = playerPieces[playerID]
    const occupiedPositions = new Set([...ownPieces, ...opponentPieces])
    const allowedMoves: number[] = []

    const directions = [
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ]

    for (let y = 0; y < boardHeight; y++) {
      for (let x = 0; x < boardWidth; x++) {
        const index = y * boardWidth + x
        if (occupiedPositions.has(index)) continue

        let validMove = false
        for (const { dx, dy } of directions) {
          let nx = x + dx
          let ny = y + dy
          let hasOpponentBetween = false

          while (nx >= 0 && nx < boardWidth && ny >= 0 && ny < boardHeight) {
            const neighborIndex = ny * boardWidth + nx
            if (opponentPieces.includes(neighborIndex)) {
              hasOpponentBetween = true
              nx += dx
              ny += dy
              continue
            } else if (ownPieces.includes(neighborIndex)) {
              if (hasOpponentBetween) {
                validMove = true
              }
              break
            } else {
              break
            }
          }

          if (validMove) break
        }

        if (validMove) {
          allowedMoves.push(index)
        }
      }
    }

    return allowedMoves
  }

  private flipOpponentPieces(
    playerPieces: { [playerID: string]: number[] },
    currentPlayerID: string,
    position: number,
  ): number[] {
    const { boardWidth, boardHeight } = this.gameSetup
    const opponentID = this.getOpponentID(currentPlayerID)
    const opponentPieces = playerPieces[opponentID]
    const ownPieces = playerPieces[currentPlayerID]
    const flippedPositions: number[] = []

    const x = position % boardWidth
    const y = Math.floor(position / boardWidth)

    const directions = [
      { dx: -1, dy: -1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ]

    for (const { dx, dy } of directions) {
      let nx = x + dx
      let ny = y + dy
      const positionsToFlip: number[] = []

      while (nx >= 0 && nx < boardWidth && ny >= 0 && ny < boardHeight) {
        const neighborIndex = ny * boardWidth + nx
        if (opponentPieces.includes(neighborIndex)) {
          positionsToFlip.push(neighborIndex)
          nx += dx
          ny += dy
          continue
        } else if (ownPieces.includes(neighborIndex)) {
          if (positionsToFlip.length > 0) {
            flippedPositions.push(...positionsToFlip)
          }
          break
        } else {
          break
        }
      }
    }

    if (flippedPositions.length > 0) {
      playerPieces[opponentID] = opponentPieces.filter(
        (pos) => !flippedPositions.includes(pos),
      )
      ownPieces.push(...flippedPositions)
    }

    return flippedPositions
  }

  private getOpponentID(playerID: string): string {
    const { gamePlayers } = this.gameSetup
    const opponent = gamePlayers.find((player) => player.id !== playerID)
    if (!opponent) {
      throw new Error("Could not find opponent player ID.")
    }
    return opponent.id
  }
}
