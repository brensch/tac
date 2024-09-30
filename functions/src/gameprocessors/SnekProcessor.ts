// functions/src/gameprocessors/SnekProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Turn, Move, GameState, Clash } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"
import { FirstMoveTimeoutSeconds } from "../timings"

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

    // Initialize playerPieces
    const playerPieces = this.initializeSnakes(
      boardWidth,
      boardHeight,
      playerIDs,
    )

    // Initialize food positions
    const food = this.initializeFood(boardWidth, boardHeight, playerPieces)

    // Initialize walls
    const walls = this.getWallPositions(boardWidth, boardHeight)

    // Initialize allowed moves
    const allowedMoves = this.calculateAllowedMoves(
      playerPieces,
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
      startTime: Timestamp.fromMillis(now),
      endTime: Timestamp.fromMillis(now + FirstMoveTimeoutSeconds * 1000),
      scores: initialScores,
      alivePlayers: [...playerIDs], // All players are alive at the start
      food: food,
      hazards: [], // No hazards at start
      playerPieces: playerPieces, // Snakes positions as a map
      allowedMoves: allowedMoves, // Map of allowed moves per player
      walls: walls, // Positions of walls
      clashes: [], // Initialize empty array for clashes
      gameOver: false,
    }

    return firstTurn
  }

  private calculateAllowedMoves(
    playerPieces: { [playerID: string]: number[] },
    walls: number[],
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
        playerPieces,
        food,
        hazards,
        walls,
        alivePlayers,
        playerHealth,
      } = this.currentTurn

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
      const clashes: Clash[] = [] // Use the new Clash interface

      // Process latest moves
      this.latestMoves.forEach((move) => {
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

          console.log("player didn't move, got direction", direction)

          if (direction) {
            const newX = (headIndex % boardWidth) + direction.dx
            const newY = Math.floor(headIndex / boardWidth) + direction.dy
            moveIndex = newY * boardWidth + newX
            console.log("set move using direction", moveIndex)
          } else {
            // No previous direction, choose a default move
            if (allowedMoves.length > 0) {
              moveIndex = allowedMoves[0]
            } else {
              // No valid moves, eliminate the player
              moveIndex = headIndex + 1
            }
            console.log("set move using first valid move", moveIndex)
            logger.warn(
              `Snek: Player ${playerID} did not submit a move and has no previous direction.`,
            )
          }
        }

        // Now, moveIndex should be defined
        // Check for collision with walls
        if (walls.includes(moveIndex)) {
          deadPlayers.add(playerID)
          // Generate a Clash for each segment of the snake
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
          console.log("pos", playerID, pos)

          if (index === 0) {
            // Head position
            if (!headPositions[pos]) {
              headPositions[pos] = []
            }
            headPositions[pos].push(playerID)
          }
        })
      })

      console.log("heads", headPositions)

      // Detect head-to-head and head-to-neck collisions
      Object.keys(newSnakes).forEach((playerID) => {
        const snake = newSnakes[playerID]
        const headPosition = snake[0] // New head position after move
        const neckPosition = snake[1] // Neck position

        // Check if another snake's head moved into this snake's neck
        Object.keys(newSnakes).forEach((otherPlayerID) => {
          if (playerID !== otherPlayerID) {
            const otherSnake = newSnakes[otherPlayerID]
            const otherHeadPosition = otherSnake[0]
            const otherNeckPosition = otherSnake[1]

            // Check for head-to-head or head-to-neck collision
            if (
              (headPosition === otherNeckPosition &&
                otherHeadPosition === neckPosition) ||
              headPosition === otherHeadPosition
            ) {
              logger.info(
                `Snek: Head-to-head (or head-to-neck) collision between ${playerID} and ${otherPlayerID}`,
              )

              // Determine the shorter snake(s)
              let playerLength = snake.length
              let otherPlayerLength = otherSnake.length

              // Eliminate the shorter snake(s)
              if (playerLength < otherPlayerLength) {
                if (!deadPlayers.has(playerID)) {
                  deadPlayers.add(playerID)
                  snake.forEach((position) => {
                    clashes.push({
                      index: position,
                      playerIDs: [playerID, otherPlayerID],
                      reason: "Head-to-head collision (shorter snake died)",
                    })
                  })
                  logger.info(
                    `Snek: Player ${playerID} eliminated due to shorter length in head-to-head collision.`,
                  )
                }
              } else if (otherPlayerLength < playerLength) {
                if (!deadPlayers.has(otherPlayerID)) {
                  deadPlayers.add(otherPlayerID)
                  otherSnake.forEach((position) => {
                    clashes.push({
                      index: position,
                      playerIDs: [playerID, otherPlayerID],
                      reason: "Head-to-head collision (shorter snake died)",
                    })
                  })
                  logger.info(
                    `Snek: Player ${otherPlayerID} eliminated due to shorter length in head-to-head collision.`,
                  )
                }
              } else {
                // If lengths are equal, both snakes die
                if (!deadPlayers.has(playerID)) {
                  deadPlayers.add(playerID)
                  snake.forEach((position) => {
                    clashes.push({
                      index: position,
                      playerIDs: [playerID, otherPlayerID],
                      reason:
                        "Head-to-head collision (both snakes equal length)",
                    })
                  })
                  logger.info(
                    `Snek: Player ${playerID} eliminated due to equal length in head-to-head collision.`,
                  )
                }
                if (!deadPlayers.has(otherPlayerID)) {
                  deadPlayers.add(otherPlayerID)
                  otherSnake.forEach((position) => {
                    clashes.push({
                      index: position,
                      playerIDs: [playerID, otherPlayerID],
                      reason:
                        "Head-to-head collision (both snakes equal length)",
                    })
                  })
                  logger.info(
                    `Snek: Player ${otherPlayerID} eliminated due to equal length in head-to-head collision.`,
                  )
                }
              }
            }
          }
        })
      })

      // Detect collisions between heads and bodies
      Object.keys(headPositions).forEach((posStr) => {
        const position = parseInt(posStr)
        const playersAtHead: string[] | undefined = headPositions[position]
        if (!playersAtHead) return

        if (playersAtHead.length > 1) {
          // Head-on collision
          logger.info(
            `Snek: Head-on collision at position ${position} between players ${playersAtHead.join(
              ", ",
            )}.`,
          )

          // Determine the shortest snake(s)
          let minLength = Infinity
          playersAtHead.forEach((playerID) => {
            const length = newSnakes[playerID].length
            if (length < minLength) {
              minLength = length
            }
          })

          // Eliminate the shortest snake(s)
          playersAtHead.forEach((playerID) => {
            if (
              newSnakes[playerID].length === minLength &&
              !deadPlayers.has(playerID)
            ) {
              deadPlayers.add(playerID)
              newSnakes[playerID].forEach((pos) => {
                clashes.push({
                  index: pos,
                  playerIDs: playersAtHead,
                  reason: "Head-on collision (shortest snake(s) died)",
                })
              })
              logger.info(
                `Snek: Player ${playerID} eliminated due to being the shortest snake in collision.`,
              )
            }
          })
        } else {
          // Check if head collided with another snake's body or its own body
          const playerID = playersAtHead[0]
          const snake = newSnakes[playerID]

          // Self-collision check
          if (snake.slice(1).includes(position)) {
            if (snake[0] === position) {
              // Snake is on its own head (no death)
              logger.info(
                `Snek: Player ${playerID} collided with its own head at position ${position}. No elimination.`,
              )
            } else {
              // Snake collided with its own body
              if (!deadPlayers.has(playerID)) {
                deadPlayers.add(playerID)
                snake.forEach((pos) => {
                  clashes.push({
                    index: pos,
                    playerIDs: [playerID],
                    reason: "Collided with own body",
                  })
                })
                logger.info(
                  `Snek: Player ${playerID} collided with its own body at position ${position}.`,
                )
              }
            }
          } else {
            // Collision with another snake's body
            const otherPlayersAtPosition = newOccupiedPositions[
              position
            ].filter((id) => id !== playerID)

            if (otherPlayersAtPosition.length > 0) {
              if (!deadPlayers.has(playerID)) {
                deadPlayers.add(playerID)
                snake.forEach((pos) => {
                  clashes.push({
                    index: pos,
                    playerIDs: [playerID, ...otherPlayersAtPosition],
                    reason: "Collided with another snake",
                  })
                })
                logger.info(
                  `Snek: Player ${playerID} collided with another snake at position ${position}.`,
                )
              }
            }
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

      // **Food Processing (after collision detection)**:
      Object.keys(newSnakes).forEach((playerID) => {
        const snake = newSnakes[playerID]
        const headPosition = snake[0] // New head position

        // Check if they landed on a food piece
        const foodIndex = newFood.indexOf(headPosition)
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
            snake.forEach((pos) => {
              clashes.push({
                index: pos,
                playerIDs: [playerID],
                reason: "Died due to zero health",
              })
            })
            logger.info(`Snek: Player ${playerID} died due to zero health.`)
          }
        }
      })

      // Remove any players who died due to zero health in the food processing
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
        walls,
        boardWidth,
        boardHeight,
      )

      // Update the current turn with new data
      this.currentTurn.playerPieces = newSnakes
      this.currentTurn.food = newFood
      this.currentTurn.hazards = newHazards
      this.currentTurn.playerHealth = newPlayerHealth
      this.currentTurn.alivePlayers = newAlivePlayers
      this.currentTurn.allowedMoves = newAllowedMoves
      this.currentTurn.clashes = clashes // Add clashes to the turn

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

  // ... (rest of the code remains unchanged)

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
   * Helper function to get positions of walls (edges of the board), avoiding duplicates on corners.
   */
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

  /**
   * Helper function to get free positions on the board, excluding walls.
   */
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

    // Add wall positions to exclude them
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

  /**
   * Finds winners based on the updated Snek game.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const {
        alivePlayers,
        playerPieces: playerPieces,
        scores,
        playerIDs,
      } = this.currentTurn

      const winners: Winner[] = []

      if (alivePlayers.length === 1) {
        const winnerID = alivePlayers[0]
        const winningSquares = playerPieces[winnerID]
        const score = scores[winnerID]
        winners.push({ playerID: winnerID, score, winningSquares })
        logger.info(`Snek: Player ${winnerID} has won the game!`)
      } else if (alivePlayers.length === 0) {
        const drawnWinners: Winner[] = playerIDs.map((playerID) => ({
          playerID: playerID,
          score: 0,
          winningSquares: [],
        }))
        winners.push(...drawnWinners)

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
   * Initializes playerPieces at starting positions.
   * @param boardWidth The width of the board.
   * @param boardHeight The height of the board.
   * @param playerIDs Array of player IDs.
   * @returns A map of playerPieces with playerID as key and positions array as value.
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

    // Initialize playerPieces
    const playerPieces: { [playerID: string]: number[] } = {}

    playerIDs.forEach((playerID, index) => {
      const { x, y } = positions[index]
      const startIndex = y * boardWidth + x

      // Snake starts with length 3, all segments at the same position
      const snake = [startIndex, startIndex, startIndex]
      playerPieces[playerID] = snake
    })

    return playerPieces
  }

  /**
   * Generates starting positions for playerPieces, ensuring they are not placed in walls.
   */
  private generateStartingPositions(
    boardWidth: number,
    boardHeight: number,
    numPlayers: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = []

    // Calculate the inner bounds where playerPieces should be placed
    const minX = 1 // One cell away from the left wall
    const maxX = boardWidth - 2 // One cell away from the right wall
    const minY = 1 // One cell away from the top wall
    const maxY = boardHeight - 2 // One cell away from the bottom wall

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

  /**
   * Initializes food positions on the board, ensuring food is placed within 2 squares of each player and not on the walls.
   */
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

    // Add wall positions to the occupied set (no food on the walls)
    const wallPositions = this.getWallPositions(boardWidth, boardHeight)
    wallPositions.forEach((position) => occupiedPositions.add(position))

    // Function to get valid adjacent positions within 2 squares around a given position
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
}
