import { Clash, GameState, Move, Turn, Winner } from "@shared/types/Game"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "../logger"
import { GameProcessor } from "./GameProcessor"

/**
 * Processor class for Longboi game logic.
 */
export class LongboiProcessor extends GameProcessor {
  constructor(gameState: GameState) {
    super(gameState)
  }

  /**
   * Initializes the first turn for Longboi.
   * @returns The initial Turn object.
   */
  firstTurn(): Turn {
    try {
      const initialTurn = this.initializeTurn()
      logger.info(`Longboi: First turn created for game.`)
      return initialTurn
    } catch (error) {
      logger.error(`Longboi: Error initializing first turn:`, error)
      throw error
    }
  }

  /**
   * Initializes the turn for Longboi.
   * @returns The initial Turn object.
   */
  private initializeTurn(): Turn {
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
      playerHealth: {}, // Not used in Longboi
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + maxTurnTime * 1000),
      scores: {}, // Initialize scores as empty map
      alivePlayers: gamePlayers.map((player) => player.id), // All players are alive
      food: [], // Not used in Longboi
      hazards: [], // Not used in Longboi
      playerPieces: playerPieces, // Players' occupied positions
      allowedMoves: allowedMoves,
      walls: [], // No walls in Longboi
      clashes: [], // Initialize empty array for clashes
      moves: {},
      winners: [], // Initialize empty winners array
    }

    return firstTurn
  }

  /**
   * Applies the latest moves to the Longboi game and updates scores.
   */
  applyMoves(currentTurn: Turn, moves: Move[]): Turn {
    try {
      const { playerPieces, allowedMoves } = currentTurn

      // Deep copy playerPieces
      const newPlayerPieces: { [playerID: string]: number[] } = {}
      Object.keys(playerPieces).forEach((playerID) => {
        newPlayerPieces[playerID] = [...playerPieces[playerID]]
      })

      // Map to keep track of moves for each player
      const playerMoves: { [playerID: string]: number } = {}

      // Clashes array
      const clashes: Clash[] = [...currentTurn.clashes]

      // Process latest moves
      moves.forEach((move) => {
        const position = move.move
        const playerID = move.playerID

        // Check if position is allowed for the player
        if (!allowedMoves[playerID]?.includes(position)) {
          logger.warn(
            `Longboi: Invalid move by player ${playerID} to position ${position}. Move ignored.`,
          )
          return
        }

        playerMoves[playerID] = position
      })

      // Process moves and handle clashes
      const positionMap: { [position: number]: string[] } = {}
      Object.entries(playerMoves).forEach(([playerID, position]) => {
        if (!positionMap[position]) {
          positionMap[position] = []
        }
        positionMap[position].push(playerID)
      })

      for (const [positionStr, playersAtPosition] of Object.entries(
        positionMap,
      )) {
        const position = parseInt(positionStr)

        if (playersAtPosition.length === 1) {
          // Valid move
          const playerID = playersAtPosition[0]
          newPlayerPieces[playerID].push(position)
          logger.info(
            `Longboi: Position ${position} claimed by player ${playerID}.`,
          )
        } else {
          // Clash: Multiple players attempted to claim the same position
          logger.warn(
            `Longboi: Clash at position ${position} by players ${playersAtPosition.join(
              ", ",
            )}.`,
          )
          // Record the clash
          clashes.push({
            index: position,
            playerIDs: playersAtPosition,
            reason: "Multiple players attempted to claim the same position",
          })
        }
      }

      // Update allowed moves (exclude claimed positions and clashes)
      const { boardWidth, boardHeight } = this.gameSetup
      const totalCells = boardWidth * boardHeight
      const allPositions = Array.from(
        { length: totalCells },
        (_, index) => index,
      )
      const claimedPositions = new Set<number>()
      Object.values(newPlayerPieces).forEach((positions) => {
        positions.forEach((pos) => claimedPositions.add(pos))
      })
      clashes.forEach((clash) => {
        claimedPositions.add(clash.index)
      })

      const newAllowedMoves: { [playerID: string]: number[] } = {}
      this.gameSetup.gamePlayers.forEach((player) => {
        newAllowedMoves[player.id] = allPositions.filter(
          (pos) => !claimedPositions.has(pos),
        )
      })

      // Calculate scores
      const newScores = this.calculateScores(newPlayerPieces)

      // Determine winners
      const winners = this.determineWinners(newPlayerPieces, newScores)

      // Create the new turn
      const now = Date.now()
      const newTurn: Turn = {
        ...currentTurn,
        playerPieces: newPlayerPieces,
        allowedMoves: newAllowedMoves,
        clashes: clashes,
        scores: newScores,
        moves: playerMoves, // This now correctly maps playerID to their move position
        winners: winners,
        startTime: Timestamp.fromMillis(now),
        endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
      }

      return newTurn
    } catch (error) {
      logger.error(`Longboi: Error applying moves:`, error)
      throw error
    }
  }

  /**
   * Calculates scores for all players based on their longest paths.
   */
  private calculateScores(playerPieces: { [playerID: string]: number[] }): {
    [playerID: string]: number
  } {
    const { boardWidth, boardHeight } = this.gameSetup
    const scores: { [playerID: string]: number } = {}

    for (const [playerID, positions] of Object.entries(playerPieces)) {
      const result = this.calculateLongestPath(
        positions,
        boardWidth,
        boardHeight,
      )
      scores[playerID] = result.length
    }

    return scores
  }

  /**
   * Determines winners based on the current game state.
   */
  private determineWinners(
    playerPieces: { [playerID: string]: number[] },
    scores: { [playerID: string]: number },
  ): Winner[] {
    const { boardWidth, boardHeight } = this.gameSetup
    const totalPositions = boardWidth * boardHeight

    // Check if all positions are claimed
    const claimedPositionsCount = Object.values(playerPieces).reduce(
      (sum, positions) => sum + positions.length,
      0,
    )

    if (claimedPositionsCount < totalPositions) {
      // Game continues
      return []
    }

    // Find the highest score
    const maxScore = Math.max(...Object.values(scores))

    // Determine the winner(s)
    const winners: Winner[] = []
    for (const [playerID, score] of Object.entries(scores)) {
      if (score === maxScore) {
        const winningPath = this.calculateLongestPath(
          playerPieces[playerID],
          boardWidth,
          boardHeight,
        ).path
        winners.push({
          playerID,
          score,
          winningSquares: winningPath,
        })
      }
    }

    return winners
  }

  /**
   * Calculates the longest single path (no branches) for a player.
   * @param positions The positions claimed by the player.
   * @param boardWidth The width of the board.
   * @param boardHeight The height of the board.
   * @returns An object containing the length and the path.
   */
  private calculateLongestPath(
    positions: number[],
    boardWidth: number,
    boardHeight: number,
  ): { length: number; path: number[] } {
    if (positions.length === 0) return { length: 0, path: [] }

    // Convert positions to a set for faster lookup
    const positionSet = new Set(positions)

    let maxLength = 0
    let longestPath: number[] = []

    // For each position, perform DFS to find the longest path
    for (const startPos of positions) {
      const visited = new Set<number>()
      const stack: { pos: number; path: number[] }[] = []
      stack.push({ pos: startPos, path: [startPos] })

      while (stack.length > 0) {
        const { pos, path } = stack.pop()!

        if (path.length > maxLength) {
          maxLength = path.length
          longestPath = [...path]
        }

        visited.add(pos)

        const neighbors = this.getNeighborPositions(
          pos,
          boardWidth,
          boardHeight,
        )

        for (const neighbor of neighbors) {
          if (
            positionSet.has(neighbor) &&
            !path.includes(neighbor) // prevent cycles
          ) {
            stack.push({ pos: neighbor, path: [...path, neighbor] })
          }
        }
      }
    }

    return { length: maxLength, path: longestPath }
  }

  /**
   * Get the neighboring positions (up, down, left, right) of a given position.
   */
  private getNeighborPositions(
    pos: number,
    boardWidth: number,
    boardHeight: number,
  ): number[] {
    const x = pos % boardWidth
    const y = Math.floor(pos / boardWidth)

    const neighbors: number[] = []

    // Up
    if (y > 0) {
      neighbors.push((y - 1) * boardWidth + x)
    }
    // Down
    if (y < boardHeight - 1) {
      neighbors.push((y + 1) * boardWidth + x)
    }
    // Left
    if (x > 0) {
      neighbors.push(y * boardWidth + (x - 1))
    }
    // Right
    if (x < boardWidth - 1) {
      neighbors.push(y * boardWidth + (x + 1))
    }

    return neighbors
  }
}
