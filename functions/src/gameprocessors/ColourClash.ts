import { Clash, GameState, Move, Turn, Winner } from "@shared/types/Game"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "../logger"
import { GameProcessor } from "./GameProcessor"

export class ColorClashProcessor extends GameProcessor {
  constructor(gameState: GameState) {
    super(gameState)
  }

  firstTurn(): Turn {
    const { gamePlayers, boardWidth } = this.gameSetup

    const playerPieces: { [playerID: string]: number[] } = {}
    const startingPositions = this.generateStartingPositions()

    gamePlayers.forEach((player, index) => {
      const position = startingPositions[index]
      playerPieces[player.id] = [position.y * boardWidth + position.x]
    })

    const allowedMoves = this.calculateAllowedMoves(playerPieces, [])
    const { actualScores } = this.calculateProjectedScores(
      playerPieces,
      allowedMoves,
      [],
    )

    const now = Date.now()

    const firstTurn: Turn = {
      playerHealth: {},
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      scores: actualScores,
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

  private generateStartingPositions(): { x: number; y: number }[] {
    const { boardWidth, boardHeight, gamePlayers } = this.gameSetup
    const positions: { x: number; y: number }[] = []

    const edges = [
      { start: { x: 0, y: 0 }, end: { x: boardWidth - 1, y: 0 } }, // Top
      {
        start: { x: boardWidth - 1, y: 0 },
        end: { x: boardWidth - 1, y: boardHeight - 1 },
      }, // Right
      {
        start: { x: boardWidth - 1, y: boardHeight - 1 },
        end: { x: 0, y: boardHeight - 1 },
      }, // Bottom
      { start: { x: 0, y: boardHeight - 1 }, end: { x: 0, y: 0 } }, // Left
    ]

    // Add corner positions
    positions.push(
      { x: 0, y: 0 },
      { x: boardWidth - 1, y: 0 },
      { x: 0, y: boardHeight - 1 },
      { x: boardWidth - 1, y: boardHeight - 1 },
    )

    let playersPlaced = 4
    let edgeIndex = 0
    while (playersPlaced < gamePlayers.length) {
      const edge = edges[edgeIndex]
      const dx = edge.end.x - edge.start.x
      const dy = edge.end.y - edge.start.y
      const steps = Math.max(Math.abs(dx), Math.abs(dy))

      for (let i = 1; i < steps && playersPlaced < gamePlayers.length; i++) {
        const x = Math.round(edge.start.x + (dx * i) / steps)
        const y = Math.round(edge.start.y + (dy * i) / steps)
        positions.push({ x, y })
        playersPlaced++
      }

      edgeIndex = (edgeIndex + 1) % 4
    }

    return positions.slice(0, gamePlayers.length)
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

    gamePlayers.forEach((player) => {
      const playerPositions = playerPieces[player.id]
      const possibleMoves = new Set<number>()

      playerPositions.forEach((position) => {
        const x = position % boardWidth
        const y = Math.floor(position / boardWidth)

        const directions = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ]

        directions.forEach(({ dx, dy }) => {
          const newX = x + dx
          const newY = y + dy
          const newPosition = newY * boardWidth + newX

          if (
            newX >= 0 &&
            newX < boardWidth &&
            newY >= 0 &&
            newY < boardHeight &&
            !occupiedPositions.has(newPosition)
          ) {
            possibleMoves.add(newPosition)
          }
        })
      })

      allowedMoves[player.id] = Array.from(possibleMoves)
    })

    return allowedMoves
  }

  applyMoves(currentTurn: Turn, moves: Move[]): Turn {
    const { playerPieces, allowedMoves, clashes: currentClashes } = currentTurn

    const newPlayerPieces: { [playerID: string]: number[] } = {}
    Object.keys(playerPieces).forEach((playerID) => {
      newPlayerPieces[playerID] = [...playerPieces[playerID]]
    })

    const newClashes: Clash[] = [...currentClashes]
    const latestMovePositions: { [playerID: string]: number } = {}
    const moveMap: { [position: number]: string[] } = {}

    for (const move of moves) {
      const { playerID, move: position } = move

      if (!allowedMoves[playerID].includes(position)) {
        logger.warn(
          `ColorClash: Invalid move by ${playerID} to position ${position}.`,
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
          `ColorClash: Clash at position ${position} by players ${players.join(
            ", ",
          )}.`,
        )
        newClashes.push({
          index: position,
          playerIDs: players,
          reason: "Multiple players attempted to claim the same position",
        })
      }
    }

    const newAllowedMoves = this.calculateAllowedMoves(
      newPlayerPieces,
      newClashes,
    )

    const { actualScores, projectedScores, territories } =
      this.calculateProjectedScores(
        newPlayerPieces,
        newAllowedMoves,
        newClashes,
      )

    const gameEnded = this.checkGameEnded(
      projectedScores,
      newAllowedMoves,
      territories,
    )

    const now = Date.now()

    const nextTurn: Turn = {
      ...currentTurn,
      playerPieces: newPlayerPieces,
      allowedMoves: newAllowedMoves,
      clashes: newClashes,
      moves: latestMovePositions,
      alivePlayers: Object.keys(newAllowedMoves),
      scores: gameEnded ? projectedScores : actualScores,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      winners: gameEnded
        ? this.determineWinners(projectedScores, territories)
        : [],
    }

    return nextTurn
  }

  private calculateProjectedScores(
    playerPieces: { [playerID: string]: number[] },
    allowedMoves: { [playerID: string]: number[] },
    clashes: Clash[],
  ): {
    actualScores: { [playerID: string]: number }
    projectedScores: { [playerID: string]: number }
    territories: { [playerID: string]: Set<number> }
  } {
    const { boardWidth, boardHeight } = this.gameSetup
    const totalSquares = boardWidth * boardHeight
    const occupiedSquares = new Set([
      ...Object.values(playerPieces).flat(),
      ...clashes.map((clash) => clash.index),
    ])

    // Calculate actualScores
    const actualScores: { [playerID: string]: number } = {}
    Object.keys(playerPieces).forEach((playerID) => {
      actualScores[playerID] = playerPieces[playerID].length
    })

    // Initialize territories with the player's current pieces
    const territories: { [playerID: string]: Set<number> } = {}
    Object.keys(playerPieces).forEach((playerID) => {
      territories[playerID] = new Set(playerPieces[playerID])
    })

    // Prepare to flood fill
    const unclaimedSquares = new Set(
      Array.from({ length: totalSquares }, (_, i) => i).filter(
        (i) => !occupiedSquares.has(i),
      ),
    )

    // Flood fill to assign territories
    while (unclaimedSquares.size > 0) {
      const [square] = unclaimedSquares
      const owner = this.findNearestPlayer(square, playerPieces)
      if (owner) {
        this.floodFill(
          square,
          owner,
          territories,
          unclaimedSquares,
          boardWidth,
          boardHeight,
        )
      } else {
        unclaimedSquares.delete(square) // Unreachable square
      }
    }

    // Calculate projected scores
    const projectedScores: { [playerID: string]: number } = {}
    Object.keys(territories).forEach((playerID) => {
      projectedScores[playerID] = territories[playerID].size
    })

    return { actualScores, projectedScores, territories }
  }

  private findNearestPlayer(
    square: number,
    playerPieces: { [playerID: string]: number[] },
  ): string | null {
    let nearestPlayer = null
    let minDistance = Infinity

    Object.entries(playerPieces).forEach(([playerID, pieces]) => {
      const distance = Math.min(
        ...pieces.map((piece) => this.calculateDistance(square, piece)),
      )
      if (distance < minDistance) {
        minDistance = distance
        nearestPlayer = playerID
      }
    })

    return nearestPlayer
  }

  private calculateDistance(a: number, b: number): number {
    const { boardWidth } = this.gameSetup
    const ax = a % boardWidth
    const ay = Math.floor(a / boardWidth)
    const bx = b % boardWidth
    const by = Math.floor(b / boardWidth)
    return Math.abs(ax - bx) + Math.abs(ay - by) // Manhattan distance
  }

  private floodFill(
    start: number,
    playerID: string,
    territories: { [playerID: string]: Set<number> },
    unclaimedSquares: Set<number>,
    boardWidth: number,
    boardHeight: number,
  ): void {
    const stack = [start]
    while (stack.length > 0) {
      const current = stack.pop()!
      if (!unclaimedSquares.has(current)) continue

      unclaimedSquares.delete(current)
      territories[playerID].add(current)

      const x = current % boardWidth
      const y = Math.floor(current / boardWidth)

      const directions = [
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
      ]

      for (const { dx, dy } of directions) {
        const newX = x + dx
        const newY = y + dy
        const newPosition = newY * boardWidth + newX

        if (
          newX >= 0 &&
          newX < boardWidth &&
          newY >= 0 &&
          newY < boardHeight &&
          unclaimedSquares.has(newPosition)
        ) {
          stack.push(newPosition)
        }
      }
    }
  }

  private checkGameEnded(
    projectedScores: { [playerID: string]: number },
    allowedMoves: { [playerID: string]: number[] },
    territories: { [playerID: string]: Set<number> },
  ): boolean {
    // If no player has any allowed moves, the game has ended
    const anyMovesLeft = Object.values(allowedMoves).some(
      (moves) => moves.length > 0,
    )
    if (!anyMovesLeft) return true

    // For each player, check if any of their allowed moves could potentially expand their territory
    for (const playerID in allowedMoves) {
      const playerTerritory = territories[playerID]
      const playerAllowedMoves = allowedMoves[playerID]

      for (const move of playerAllowedMoves) {
        if (!playerTerritory.has(move)) {
          // The move is outside their current territory, so it could expand their territory
          // Therefore, the game is not over yet
          return false
        }
      }
    }

    // If no player can expand their territory, the game has ended
    return true
  }

  private determineWinners(
    projectedScores: { [playerID: string]: number },
    territories: { [playerID: string]: Set<number> },
  ): Winner[] {
    const maxScore = Math.max(...Object.values(projectedScores))

    return Object.entries(projectedScores).map(([playerID, score]) => {
      if (score === maxScore) {
        return {
          playerID,
          score,
          winningSquares: Array.from(territories[playerID]),
        }
      } else {
        return {
          playerID,
          score,
          winningSquares: [],
          // winningSquares left undefined
        }
      }
    })
  }
}
