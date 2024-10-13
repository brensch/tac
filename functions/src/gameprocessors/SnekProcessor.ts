import { GameProcessor } from "./GameProcessor"
import {
  Winner,
  Turn,
  Move,
  Clash,
  GamePlayer,
  GameSetup,
} from "@shared/types/Game"
import { logger } from "../logger"
import { Timestamp } from "firebase-admin/firestore"

export class SnekProcessor extends GameProcessor {
  private foodSpawnChance: number = 0.5 // 50% chance to spawn food

  constructor(gameSetup: GameSetup) {
    super(gameSetup)
  }

  firstTurn(): Turn {
    try {
      const initialTurn = this.initializeTurn()
      logger.info(`Snek: First turn created for game.`)
      return initialTurn
    } catch (error) {
      logger.error(`Snek: Error initializing first turn:`, error)
      throw error
    }
  }

  initializeGame(): Turn {
    try {
      const initialTurn = this.initializeTurn()
      logger.info(`Snek: Turn 1 created for game.`)
      return initialTurn
    } catch (error) {
      logger.error(`Snek: Error initializing game:`, error)
      throw error
    }
  }

  private initializeTurn(): Turn {
    const { boardWidth, boardHeight, gamePlayers, maxTurnTime } = this.gameSetup
    const now = Date.now()

    // Initialize playerPieces
    const playerPieces = this.initializeSnakes(
      boardWidth,
      boardHeight,
      gamePlayers,
    )

    // Initialize food positions
    const food = this.initializeFood(boardWidth, boardHeight, playerPieces)

    // Initialize walls
    const walls = this.getWallPositions(boardWidth, boardHeight)

    // Initialize allowed moves
    const allowedMoves = this.calculateAllowedMoves(
      playerPieces,
      boardWidth,
      boardHeight,
    )

    // Initialize player health
    const initialHealth: { [playerID: string]: number } = {}
    gamePlayers.forEach((player) => {
      initialHealth[player.id] = 100
    })

    // Initialize scores
    const initialScores: { [playerID: string]: number } = {}
    gamePlayers.forEach((player) => {
      initialScores[player.id] = 3 // Initial snake length is 3
    })

    const firstTurn: Turn = {
      playerHealth: initialHealth,
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + maxTurnTime * 1000),
      scores: initialScores,
      alivePlayers: gamePlayers.map((player) => player.id),
      food: food,
      hazards: [],
      playerPieces: playerPieces,
      allowedMoves: allowedMoves,
      walls: walls,
      clashes: [],
      moves: {},
      winners: [],
    }

    return firstTurn
  }

  applyMoves(currentTurn: Turn, moves: Move[]): Turn {
    try {
      const { playerPieces, food, hazards, walls, alivePlayers, playerHealth } =
        currentTurn

      const { boardWidth, boardHeight } = this.gameSetup

      // Deep copy playerPieces and other mutable objects
      const newSnakes: { [playerID: string]: number[] } = {}
      Object.keys(playerPieces).forEach((playerID) => {
        newSnakes[playerID] = [...playerPieces[playerID]]
      })

      const newFood = [...food]
      const newHazards = [...hazards]
      const newPlayerHealth = { ...playerHealth }
      const newAlivePlayers = [...alivePlayers]

      const playerMoves: { [playerID: string]: number } = {}
      const deadPlayers: Set<string> = new Set()
      const clashes: Clash[] = []

      // Process latest moves
      moves.forEach((move) => {
        playerMoves[move.playerID] = move.move
      })

      // Apply moves
      newAlivePlayers.forEach((playerID) => {
        let moveIndex = playerMoves[playerID]
        const snake = newSnakes[playerID]
        const headIndex = snake[0]
        const allowedMoves = this.getAdjacentIndices(
          headIndex,
          boardWidth,
          boardHeight,
        )

        // Player didn't submit a valid move or move is invalid
        if (!moveIndex || !allowedMoves.includes(moveIndex)) {
          const direction = this.getLastDirection(snake, boardWidth)

          if (direction) {
            const newX = (headIndex % boardWidth) + direction.dx
            const newY = Math.floor(headIndex / boardWidth) + direction.dy
            moveIndex = newY * boardWidth + newX
          } else {
            // No previous direction, choose a default move
            if (allowedMoves.length > 0) {
              moveIndex = allowedMoves[0]
            } else {
              // No valid moves, eliminate the player
              moveIndex = headIndex + 1
            }
            logger.warn(
              `Snek: Player ${playerID} did not submit a move and has no previous direction.`,
            )
          }
        }

        // Check for collision with walls
        if (walls.includes(moveIndex)) {
          deadPlayers.add(playerID)
          snake.forEach((position) => {
            clashes.push({
              index: position,
              playerIDs: [playerID],
              reason: "Collided with wall",
            })
          })
          logger.info(
            `Snek: Player ${playerID} collided with a wall at position ${moveIndex}.`,
          )
          return
        }

        // Remove the last element of the snake (tail)
        snake.pop()

        // Self-collision check (before applying the move)
        if (snake.includes(moveIndex)) {
          // Snake collides with its own body
          deadPlayers.add(playerID)
          snake.forEach((position) => {
            clashes.push({
              index: position,
              playerIDs: [playerID],
              reason: "Collided with own body",
            })
          })
          logger.info(
            `Snek: Player ${playerID} collided with its own body at position ${moveIndex}.`,
          )
          return
        }

        // Add the latest move index to the start of the snake (new head position)
        snake.unshift(moveIndex)
      })

      // After all moves, check for collisions between snakes
      const newOccupiedPositions: { [position: number]: string[] } = {}
      const headPositions: { [position: number]: string[] } = {}

      // Build occupied positions and head positions
      Object.keys(newSnakes).forEach((playerID) => {
        const snake = newSnakes[playerID]
        snake.forEach((pos, index) => {
          if (!newOccupiedPositions[pos]) {
            newOccupiedPositions[pos] = []
          }
          newOccupiedPositions[pos].push(playerID)

          if (index === 0) {
            // Head position
            if (!headPositions[pos]) {
              headPositions[pos] = []
            }
            headPositions[pos].push(playerID)
          }
        })
      })

      // Detect head-to-head and head-to-body collisions
      Object.keys(headPositions).forEach((posStr) => {
        const position = parseInt(posStr)
        const playersAtHead = headPositions[position]

        if (playersAtHead.length > 1) {
          // Head-on collision
          let minLength = Infinity
          playersAtHead.forEach((playerID) => {
            minLength = Math.min(minLength, newSnakes[playerID].length)
          })

          playersAtHead.forEach((playerID) => {
            if (newSnakes[playerID].length === minLength) {
              deadPlayers.add(playerID)
              newSnakes[playerID].forEach((pos) => {
                clashes.push({
                  index: pos,
                  playerIDs: playersAtHead,
                  reason: "Head-on collision (shortest snake(s) died)",
                })
              })
            }
          })
        } else {
          const playerID = playersAtHead[0]
          const otherPlayersAtPosition = newOccupiedPositions[position].filter(
            (id) => id !== playerID,
          )

          if (otherPlayersAtPosition.length > 0) {
            deadPlayers.add(playerID)
            newSnakes[playerID].forEach((pos) => {
              clashes.push({
                index: pos,
                playerIDs: [playerID, ...otherPlayersAtPosition],
                reason: "Collided with another snake's body",
              })
            })
          }
        }
      })

      // Remove dead players
      deadPlayers.forEach((playerID) => {
        const index = newAlivePlayers.indexOf(playerID)
        if (index !== -1) {
          newAlivePlayers.splice(index, 1)
        }
        delete newSnakes[playerID]
        delete newPlayerHealth[playerID]
      })

      // Food Processing
      Object.keys(newSnakes).forEach((playerID) => {
        const snake = newSnakes[playerID]
        const headPosition = snake[0]

        const foodIndex = newFood.indexOf(headPosition)
        if (foodIndex !== -1) {
          newFood.splice(foodIndex, 1)
          snake.push(snake[snake.length - 1])
          newPlayerHealth[playerID] = 100
        } else {
          newPlayerHealth[playerID] -= 1
          if (newPlayerHealth[playerID] <= 0) {
            deadPlayers.add(playerID)
            snake.forEach((pos) => {
              clashes.push({
                index: pos,
                playerIDs: [playerID],
                reason: "Died due to zero health",
              })
            })
          }
        }
      })

      // Remove players who died due to zero health
      deadPlayers.forEach((playerID) => {
        const index = newAlivePlayers.indexOf(playerID)
        if (index !== -1) {
          newAlivePlayers.splice(index, 1)
        }
        delete newSnakes[playerID]
        delete newPlayerHealth[playerID]
      })

      // Generate new food
      if (Math.random() < this.foodSpawnChance) {
        const freePositions = this.getFreePositions(
          this.gameSetup.boardWidth,
          this.gameSetup.boardHeight,
          newSnakes,
          newFood,
          newHazards,
        )
        if (freePositions.length > 0) {
          const randomIndex = Math.floor(Math.random() * freePositions.length)
          newFood.push(freePositions[randomIndex])
        }
      }

      // Update allowed moves
      const newAllowedMoves = this.calculateAllowedMoves(
        newSnakes,
        this.gameSetup.boardWidth,
        this.gameSetup.boardHeight,
      )

      // Update scores
      const newScores: { [playerID: string]: number } = {}
      Object.keys(newSnakes).forEach((playerID) => {
        newScores[playerID] = newSnakes[playerID].length
      })

      // Determine winner if game is over
      const winners: Winner[] = []
      if (newAlivePlayers.length === 1) {
        const winnerID = newAlivePlayers[0]
        winners.push({
          playerID: winnerID,
          score: newScores[winnerID],
          winningSquares: newSnakes[winnerID],
        })
      }

      // Create the new turn
      const now = Date.now()
      const newTurn: Turn = {
        ...currentTurn,
        playerHealth: newPlayerHealth,
        startTime: Timestamp.fromMillis(now),
        endTime: Timestamp.fromMillis(now + this.gameSetup.maxTurnTime * 1000),
        scores: newScores,
        alivePlayers: newAlivePlayers,
        food: newFood,
        hazards: newHazards,
        playerPieces: newSnakes,
        allowedMoves: newAllowedMoves,
        clashes: clashes,
        moves: playerMoves,
        winners: winners,
      }

      return newTurn
    } catch (error) {
      logger.error(`Snek: Error applying moves:`, error)
      throw error
    }
  }

  private initializeSnakes(
    boardWidth: number,
    boardHeight: number,
    gamePlayers: GamePlayer[],
  ): { [playerID: string]: number[] } {
    const positions = this.generateStartingPositions(
      boardWidth,
      boardHeight,
      gamePlayers.length,
    )

    const playerPieces: { [playerID: string]: number[] } = {}

    gamePlayers.forEach((player, index) => {
      const { x, y } = positions[index]
      const startIndex = y * boardWidth + x

      // Snake starts with length 3, all segments at the same position
      const snake = [startIndex, startIndex, startIndex]
      playerPieces[player.id] = snake
    })

    return playerPieces
  }

  private generateStartingPositions(
    boardWidth: number,
    boardHeight: number,
    numPlayers: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = []

    // Calculate the inner bounds where snakes should be placed
    const minX = 1
    const maxX = boardWidth - 2
    const minY = 1
    const maxY = boardHeight - 2

    // Spread players evenly around the board inside the walls
    for (let i = 0; i < numPlayers; i++) {
      const angle = (2 * Math.PI * i) / numPlayers
      const x = Math.floor(
        (minX + maxX) / 2 + ((maxX - minX) / 2) * Math.cos(angle),
      )
      const y = Math.floor(
        (minY + maxY) / 2 + ((maxY - minY) / 2) * Math.sin(angle),
      )

      positions.push({ x, y })
    }

    return positions
  }

  private initializeFood(
    boardWidth: number,
    boardHeight: number,
    playerPieces: { [playerID: string]: number[] },
  ): number[] {
    const occupiedPositions = new Set<number>()

    // Add snake positions to occupied positions
    Object.values(playerPieces).forEach((snake) => {
      snake.forEach((position) => occupiedPositions.add(position))
    })

    // Add wall positions to the occupied set
    const wallPositions = this.getWallPositions(boardWidth, boardHeight)
    wallPositions.forEach((position) => occupiedPositions.add(position))

    const getValidAdjacentPositions = (x: number, y: number): number[] => {
      const positions: number[] = []
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const newX = x + dx
          const newY = y + dy
          if (
            newX >= 1 &&
            newX < boardWidth - 1 &&
            newY >= 1 &&
            newY < boardHeight - 1
          ) {
            const newPosition = newY * boardWidth + newX
            if (!occupiedPositions.has(newPosition)) {
              positions.push(newPosition)
            }
          }
        }
      }
      return positions
    }

    const foodPositions: number[] = []

    // Place food near each snake's head within 2 squares
    Object.values(playerPieces).forEach((snake) => {
      const snakeHead = snake[0]
      const headX = snakeHead % boardWidth
      const headY = Math.floor(snakeHead / boardWidth)

      const validPositions = getValidAdjacentPositions(headX, headY)

      if (validPositions.length > 0) {
        const randomIndex = Math.floor(Math.random() * validPositions.length)
        const foodPosition = validPositions[randomIndex]
        foodPositions.push(foodPosition)
        occupiedPositions.add(foodPosition)
      }
    })

    return foodPositions
  }

  private getWallPositions(boardWidth: number, boardHeight: number): number[] {
    const wallPositions: Set<number> = new Set()

    // Top and bottom walls
    for (let x = 0; x < boardWidth; x++) {
      wallPositions.add(x) // Top wall
      wallPositions.add((boardHeight - 1) * boardWidth + x) // Bottom wall
    }

    // Left and right walls
    for (let y = 0; y < boardHeight; y++) {
      wallPositions.add(y * boardWidth) // Left wall
      wallPositions.add(y * boardWidth + (boardWidth - 1)) // Right wall
    }

    return Array.from(wallPositions)
  }

  private calculateAllowedMoves(
    playerPieces: { [playerID: string]: number[] },
    boardWidth: number,
    boardHeight: number,
  ): { [playerID: string]: number[] } {
    const allowedMoves: { [playerID: string]: number[] } = {}

    Object.keys(playerPieces).forEach((playerID) => {
      const snake = playerPieces[playerID]
      const headIndex = snake[0]
      const adjacentIndices = this.getAdjacentIndices(
        headIndex,
        boardWidth,
        boardHeight,
      )

      // Allow all adjacent moves, including potentially unsafe ones
      allowedMoves[playerID] = adjacentIndices
    })

    return allowedMoves
  }

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

  private getFreePositions(
    boardWidth: number,
    boardHeight: number,
    playerPieces: { [playerID: string]: number[] },
    food: number[],
    hazards: number[],
  ): number[] {
    const totalCells = boardWidth * boardHeight
    const occupied = new Set<number>()

    // Add snake positions
    Object.values(playerPieces).forEach((snake) => {
      snake.forEach((pos) => occupied.add(pos))
    })

    // Add food positions
    food.forEach((pos) => occupied.add(pos))

    // Add hazard positions
    hazards.forEach((pos) => occupied.add(pos))

    // Add wall positions
    const wallPositions = this.getWallPositions(boardWidth, boardHeight)
    wallPositions.forEach((pos) => occupied.add(pos))

    const freePositions: number[] = []
    for (let i = 0; i < totalCells; i++) {
      if (!occupied.has(i)) {
        freePositions.push(i)
      }
    }

    return freePositions
  }

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
}
