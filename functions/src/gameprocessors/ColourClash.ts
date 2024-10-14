import { Clash, GameSetup, Move, Turn, Winner } from "@shared/types/Game"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "../logger"
import { GameProcessor } from "./GameProcessor"

export class ColorClashProcessor extends GameProcessor {
  constructor(gameSetup: GameSetup) {
    super(gameSetup)
  }

  firstTurn(): Turn {
    const { gamePlayers, boardWidth, boardHeight } = this.gameSetup

    const playerPieces: { [playerID: string]: number[] } = {}
    gamePlayers.forEach((player, index) => {
      const startPosition =
        (index * (boardWidth * boardHeight - 1)) / (gamePlayers.length - 1)
      playerPieces[player.id] = [startPosition]
    })

    const allowedMoves = this.calculateAllowedMoves(playerPieces, [])
    const scores = this.calculateScores(playerPieces)

    const now = Date.now()

    const firstTurn: Turn = {
      playerHealth: {},
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      scores: scores,
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
    const newScores = this.calculateScores(newPlayerPieces)

    const newAlivePlayers = currentTurn.alivePlayers.filter(
      (playerID) =>
        newAllowedMoves[playerID] && newAllowedMoves[playerID].length > 0,
    )

    const now = Date.now()

    const nextTurn: Turn = {
      ...currentTurn,
      playerPieces: newPlayerPieces,
      allowedMoves: newAllowedMoves,
      clashes: newClashes,
      moves: latestMovePositions,
      alivePlayers: newAlivePlayers,
      scores: newScores,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      winners: [],
    }

    nextTurn.winners = this.determineWinners(nextTurn)

    return nextTurn
  }

  private calculateScores(playerPieces: { [playerID: string]: number[] }): {
    [playerID: string]: number
  } {
    const { boardWidth, boardHeight } = this.gameSetup
    const scores: { [playerID: string]: number } = {}

    for (const [playerID, pieces] of Object.entries(playerPieces)) {
      scores[playerID] = this.calculateLargestConnectedArea(
        pieces,
        boardWidth,
        boardHeight,
      )
    }

    return scores
  }

  private determineWinners(turn: Turn): Winner[] {
    const { playerPieces, alivePlayers, scores } = turn

    // Check if the game is over (no more alive players)
    const gameOver = alivePlayers.length === 0

    if (!gameOver) return []

    // Find the highest score
    const maxScore = Math.max(...Object.values(scores))

    // Create a Winner object for each player, including their score
    const allPlayerResults: Winner[] = Object.entries(scores).map(
      ([playerID, score]) => ({
        playerID,
        score,
        winningSquares: score === maxScore ? playerPieces[playerID] : [],
      }),
    )
    return allPlayerResults
  }

  private calculateLargestConnectedArea(
    pieces: number[],
    boardWidth: number,
    boardHeight: number,
  ): number {
    const visited = new Set<number>()
    let largestArea = 0

    for (const piece of pieces) {
      if (!visited.has(piece)) {
        const area = this.dfs(piece, pieces, visited, boardWidth, boardHeight)
        largestArea = Math.max(largestArea, area)
      }
    }

    return largestArea
  }

  private dfs(
    start: number,
    pieces: number[],
    visited: Set<number>,
    boardWidth: number,
    boardHeight: number,
  ): number {
    const stack = [start]
    let area = 0

    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current)) continue

      visited.add(current)
      area++

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
          pieces.includes(newPosition) &&
          !visited.has(newPosition)
        ) {
          stack.push(newPosition)
        }
      }
    }

    return area
  }
}
