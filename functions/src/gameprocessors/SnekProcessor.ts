// functions/src/gameprocessors/SnekProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Turn, Move, GameState } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"

export class SnekProcessor extends GameProcessor {
  private foodSpawnChance: number = 0.5 // 50% chance to spawn food

  constructor(
    transaction: Transaction,
    gameID: string,
    latestMoves: Move[],
    currentTurn?: Turn,
  ) {
    super(transaction, gameID, latestMoves, currentTurn)
  }

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

      logger.info(`Snek: Turn 1 created and game ${this.gameID} has started.`)
    } catch (error) {
      logger.error(`Snek: Error initializing game ${this.gameID}:`, error)
      throw error
    }
  }

  private initializeTurn(gameState: GameState): Turn {
    const { boardWidth, boardHeight, playerIDs } = gameState
    const now = Date.now()

    // Initialize snakes
    const snakes = this.initializeSnakes(boardWidth, boardHeight, playerIDs)

    // Initialize food positions
    const food = this.initializeFood(boardWidth, boardHeight, snakes)

    // Initialize walls
    const walls = this.getWallPositions(boardWidth, boardHeight)

    // Initialize allowed moves
    const allowedMoves = this.calculateAllowedMoves(
      snakes,
      walls,
      boardWidth,
      boardHeight,
    )

    // Initialize player health
    const initialHealth: { [playerID: string]: number } = {}
    playerIDs.forEach((playerID) => {
      initialHealth[playerID] = 100
    })

    // Initialize scores
    const initialScores: { [playerID: string]: number } = {}
    playerIDs.forEach((playerID) => {
      initialScores[playerID] = 3 // Initial snake length is 3
    })

    const firstTurn: Turn = {
      turnNumber: 1,
      boardWidth: boardWidth,
      boardHeight: boardHeight,
      gameType: gameState.gameType,
      playerIDs: playerIDs,
      playerHealth: initialHealth,
      hasMoved: {},
      turnTime: gameState.maxTurnTime,
      startTime: admin.firestore.Timestamp.fromMillis(now),
      endTime: admin.firestore.Timestamp.fromMillis(
        now + gameState.maxTurnTime * 1000,
      ),
      scores: initialScores,
      alivePlayers: [...playerIDs], // All players are alive at the start
      food: food,
      hazards: [], // No hazards at start
      snakes: snakes, // Snakes positions as a map
      allowedMoves: allowedMoves, // Map of allowed moves per player
      walls: walls, // Positions of walls
    }

    return firstTurn
  }

  private calculateAllowedMoves(
    snakes: { [playerID: string]: number[] },
    walls: number[],
    boardWidth: number,
    boardHeight: number,
  ): { [playerID: string]: number[] } {
    const allowedMoves: { [playerID: string]: number[] } = {}

    Object.keys(snakes).forEach((playerID) => {
      const snake = snakes[playerID]
      const headIndex = snake[0]
      const adjacentIndices = this.getAdjacentIndices(
        headIndex,
        boardWidth,
        boardHeight,
      )

      allowedMoves[playerID] = adjacentIndices
    })

    return allowedMoves
  }

  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const {
        boardWidth,
        boardHeight,
        snakes,
        food,
        hazards,
        alivePlayers,
        playerHealth,
      } = this.currentTurn

      // Deep copy snakes and other mutable objects
      const newSnakes: { [playerID: string]: number[] } = {}
      Object.keys(snakes).forEach((playerID) => {
        newSnakes[playerID] = [...snakes[playerID]]
      })

      const newFood = [...food]
      const newHazards = [...hazards]
      const newPlayerHealth = { ...playerHealth }
      const newAlivePlayers = [...alivePlayers]

      const playerMoves: { [playerID: string]: number } = {}
      const deadPlayers: Set<string> = new Set()

      // Process latest moves
      this.latestMoves.forEach((move) => {
        playerMoves[move.playerID] = move.move
      })

      // Handle players who didn't submit a move
      newAlivePlayers.forEach((playerID) => {
        if (!playerMoves[playerID]) {
          // Player didn't submit a move
          const snake = newSnakes[playerID]
          const headIndex = snake[0]
          const direction = this.getLastDirection(snake, boardWidth)

          if (direction) {
            const newX = (headIndex % boardWidth) + direction.dx
            const newY = Math.floor(headIndex / boardWidth) + direction.dy
            const newIndex = newY * boardWidth + newX
            playerMoves[playerID] = newIndex
          } else {
            // No previous direction, eliminate player
            deadPlayers.add(playerID)
            logger.warn(
              `Snek: Player ${playerID} did not submit a move and has no previous direction.`,
            )
          }
        }
      })

      // Apply moves
      newAlivePlayers.forEach((playerID) => {
        if (deadPlayers.has(playerID)) return
        const moveIndex = playerMoves[playerID]
        const snake = newSnakes[playerID]

        // Validate that the move is allowed
        const allowedMoves = this.currentTurn?.allowedMoves[playerID]
        if (!allowedMoves || !allowedMoves.includes(moveIndex)) {
          // Invalid move, eliminate player
          deadPlayers.add(playerID)
          logger.warn(
            `Snek: Player ${playerID} submitted an invalid move to index ${moveIndex}. Player eliminated.`,
          )
          return
        }

        // Add the latest move index to the start of the snake
        snake.unshift(moveIndex)

        // Remove the last element of the snake (tail)
        const tail = snake.pop()

        // Check if they landed on a food piece
        const foodIndex = newFood.indexOf(moveIndex)
        if (foodIndex !== -1) {
          // Remove the food
          newFood.splice(foodIndex, 1)

          // Add an extra value to the end of the snake (extend tail)
          snake.push(snake[snake.length - 1])

          // Restore health to 100
          newPlayerHealth[playerID] = 100
          logger.info(`Snek: Player ${playerID} ate food and restored health.`)
        } else {
          // Decrease health
          newPlayerHealth[playerID] -= 1
          if (newPlayerHealth[playerID] <= 0) {
            deadPlayers.add(playerID)
            logger.info(`Snek: Player ${playerID} died due to zero health.`)
          }
        }
      })

      // After all moves, check for collisions
      // ... (collision detection code remains the same)

      // Remove dead players
      deadPlayers.forEach((playerID) => {
        const index = newAlivePlayers.indexOf(playerID)
        if (index !== -1) {
          newAlivePlayers.splice(index, 1)
        }
        delete newSnakes[playerID]
        delete newPlayerHealth[playerID]
      })

      // Generate new food based on random chance
      if (Math.random() < this.foodSpawnChance) {
        const freePositions = this.getFreePositions(
          boardWidth,
          boardHeight,
          newSnakes,
          newFood,
          newHazards,
        )
        if (freePositions.length > 0) {
          const randomIndex = Math.floor(Math.random() * freePositions.length)
          newFood.push(freePositions[randomIndex])
          logger.info(
            `Snek: Placed food at position ${freePositions[randomIndex]}.`,
          )
        }
      }

      // Update allowed moves after moves have been applied
      const newAllowedMoves = this.calculateAllowedMoves(
        newSnakes,
        this.currentTurn.walls,
        boardWidth,
        boardHeight,
      )

      // Update the current turn with new data
      this.currentTurn.snakes = newSnakes
      this.currentTurn.food = newFood
      this.currentTurn.hazards = newHazards
      this.currentTurn.playerHealth = newPlayerHealth
      this.currentTurn.alivePlayers = newAlivePlayers
      this.currentTurn.allowedMoves = newAllowedMoves

      // Update scores
      const newScores: { [playerID: string]: number } = {}
      Object.keys(newSnakes).forEach((playerID) => {
        newScores[playerID] = newSnakes[playerID].length
      })
      this.currentTurn.scores = newScores
    } catch (error) {
      logger.error(`Snek: Error applying moves for game ${this.gameID}:`, error)
      throw error
    }
  }

  // ... (rest of the class remains the same)

  /**
   * Initializes snakes at starting positions.
   * @param boardWidth The width of the board.
   * @param boardHeight The height of the board.
   * @param playerIDs Array of player IDs.
   * @returns A map of snakes with playerID as key and positions array as value.
   */
  private initializeSnakes(
    boardWidth: number,
    boardHeight: number,
    playerIDs: string[],
  ): { [playerID: string]: number[] } {
    // Generate starting positions with equal board access
    const positions = this.generateStartingPositions(
      boardWidth,
      boardHeight,
      playerIDs.length,
    )

    // Initialize snakes
    const snakes: { [playerID: string]: number[] } = {}

    playerIDs.forEach((playerID, index) => {
      const { x, y } = positions[index]
      const startIndex = y * boardWidth + x

      // Snake starts with length 3, all segments at the same position
      const snake = [startIndex, startIndex, startIndex]
      snakes[playerID] = snake
    })

    return snakes
  }

  /**
   * Generates starting positions for snakes.
   */
  private generateStartingPositions(
    boardWidth: number,
    boardHeight: number,
    numPlayers: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = []

    // Simple method: spread players evenly around the board edges
    for (let i = 0; i < numPlayers; i++) {
      const angle = (2 * Math.PI * i) / numPlayers
      const x = Math.floor(
        boardWidth / 2 + (boardWidth / 2 - 1) * Math.cos(angle),
      )
      const y = Math.floor(
        boardHeight / 2 + (boardHeight / 2 - 1) * Math.sin(angle),
      )

      positions.push({ x, y })
    }

    return positions
  }

  /**
   * Initializes food positions on the board.
   */
  private initializeFood(
    boardWidth: number,
    boardHeight: number,
    snakes: { [playerID: string]: number[] },
  ): number[] {
    const totalCells = boardWidth * boardHeight
    const occupiedPositions = new Set<number>()

    // Add snake positions to occupied positions
    Object.values(snakes).forEach((snake) => {
      snake.forEach((position) => occupiedPositions.add(position))
    })

    const freePositions = []
    for (let i = 0; i < totalCells; i++) {
      if (!occupiedPositions.has(i)) {
        freePositions.push(i)
      }
    }

    // Randomly select positions for initial food
    const foodCount = Math.max(1, Math.floor(totalCells * 0.05)) // 5% of the board
    const foodPositions: number[] = []

    for (let i = 0; i < foodCount && freePositions.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * freePositions.length)
      const position = freePositions.splice(randomIndex, 1)[0]
      foodPositions.push(position)
    }

    return foodPositions
  }

  /**
   * Finds winners based on the updated Snek game.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const { alivePlayers, snakes, scores } = this.currentTurn

      const winners: Winner[] = []

      if (alivePlayers.length === 1) {
        const winnerID = alivePlayers[0]
        const winningSquares = snakes[winnerID]
        const score = scores[winnerID]
        winners.push({ playerID: winnerID, score, winningSquares })
        logger.info(`Snek: Player ${winnerID} has won the game!`)
      } else if (alivePlayers.length === 0) {
        logger.info(`Snek: Game ended in a draw. No players are alive.`)
      }

      return winners
    } catch (error) {
      logger.error(
        `Snek: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Helper method to get the last direction of the snake.
   */
  private getLastDirection(
    snake: number[],
    boardWidth: number,
  ): { dx: number; dy: number } | null {
    if (snake.length < 2) return null
    const head = snake[0]
    const neck = snake[1]

    const headX = head % boardWidth
    const headY = Math.floor(head / boardWidth)
    const neckX = neck % boardWidth
    const neckY = Math.floor(neck / boardWidth)

    const dx = headX - neckX
    const dy = headY - neckY

    return { dx, dy }
  }

  /**
   * Helper function to get adjacent indices (up, down, left, right) from a given index.
   */
  private getAdjacentIndices(
    index: number,
    boardWidth: number,
    boardHeight: number,
  ): number[] {
    const x = index % boardWidth
    const y = Math.floor(index / boardWidth)
    const indices: number[] = []

    const directions = [
      { dx: 0, dy: -1 }, // Up
      { dx: 0, dy: 1 }, // Down
      { dx: -1, dy: 0 }, // Left
      { dx: 1, dy: 0 }, // Right
    ]

    directions.forEach(({ dx, dy }) => {
      const newX = x + dx
      const newY = y + dy
      if (newX >= 0 && newX < boardWidth && newY >= 0 && newY < boardHeight) {
        indices.push(newY * boardWidth + newX)
      }
    })

    return indices
  }

  /**
   * Helper function to get positions of walls (edges of the board).
   */
  private getWallPositions(boardWidth: number, boardHeight: number): number[] {
    const wallPositions: number[] = []

    // Top and bottom walls
    for (let x = 0; x < boardWidth; x++) {
      wallPositions.push(x) // Top wall
      wallPositions.push((boardHeight - 1) * boardWidth + x) // Bottom wall
    }

    // Left and right walls
    for (let y = 0; y < boardHeight; y++) {
      wallPositions.push(y * boardWidth) // Left wall
      wallPositions.push(y * boardWidth + (boardWidth - 1)) // Right wall
    }

    return wallPositions
  }

  /**
   * Helper function to get free positions on the board.
   */
  private getFreePositions(
    boardWidth: number,
    boardHeight: number,
    snakes: { [playerID: string]: number[] },
    food: number[],
    hazards: number[],
  ): number[] {
    const totalCells = boardWidth * boardHeight
    const occupied = new Set<number>()

    // Add snake positions
    Object.values(snakes).forEach((snake) => {
      snake.forEach((pos) => occupied.add(pos))
    })

    // Add food positions
    food.forEach((pos) => occupied.add(pos))

    // Add hazard positions
    hazards.forEach((pos) => occupied.add(pos))

    const freePositions: number[] = []
    for (let i = 0; i < totalCells; i++) {
      if (!occupied.has(i)) {
        freePositions.push(i)
      }
    }

    return freePositions
  }
}
