import { Clash, GameState, Move, Turn, Winner } from "@shared/types/Game"
import { Timestamp } from "firebase-admin/firestore"
import { logger } from "../logger"
import { GameProcessor } from "./GameProcessor"

export class SnekProcessor extends GameProcessor {
  private foodSpawnChance: number = 0.5 // 50% chance to spawn food

  constructor(gameState: GameState) {
    super(gameState)
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
    const playerPieces = this.initializeSnakes()

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

      // Remove dead players from alive list and track their elimination
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

      // Update scores based on current snake lengths
      const newScores: { [playerID: string]: number } = {}
      Object.keys(newSnakes).forEach((playerID) => {
        newScores[playerID] = newSnakes[playerID].length
      })

      // Determine winners if game is over
      let winners: Winner[] = []
      if (newAlivePlayers.length <= 1) {
        // Create a map to track survival turns for each player
        const survivalTurns = new Map<string, number>()

        // Initialize all players with 0 turns
        this.gameSetup.gamePlayers.forEach(player => {
          survivalTurns.set(player.id, 0)
        })

        // Count how many turns each player survived in historical turns
        this.gameState.turns.forEach(turn => {
          turn.alivePlayers.forEach(playerId => {
            survivalTurns.set(
              playerId,
              (survivalTurns.get(playerId) || 0) + 1
            )
          })
        })

        // Add the current/final state
        newAlivePlayers.forEach(playerId => {
          survivalTurns.set(
            playerId,
            (survivalTurns.get(playerId) || 0) + 1
          )
        })

        // Create winners array with all players
        winners = this.gameSetup.gamePlayers.map(player => ({
          playerID: player.id,
          score: survivalTurns.get(player.id) || 0,
          winningSquares: newSnakes[player.id] ?? []
        }))

        // Sort winners by survival turns in descending order
        winners.sort((a, b) => b.score - a.score)
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

  private initializeSnakes(): {
    [playerID: string]: number[]
  } {
    const { boardWidth, gamePlayers } = this.gameSetup

    const positions = this.generateStartingPositions()

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

  private generateStartingPositions(): { x: number; y: number }[] {
    const { boardWidth, boardHeight, gamePlayers } = this.gameSetup
    const positions: { x: number; y: number }[] = []

    // Calculate the outermost position that allows odd spacing
    const startX = (boardWidth - 1) % 4 === 0 ? 2 : 1
    const startY = (boardHeight - 1) % 4 === 0 ? 2 : 1
    const endX = boardWidth - startX - 1
    const endY = boardHeight - startY - 1

    // Define edges
    const edges = [
      { start: { x: startX, y: startY }, end: { x: endX, y: startY } }, // Top
      { start: { x: endX, y: startY }, end: { x: endX, y: endY } }, // Right
      { start: { x: endX, y: endY }, end: { x: startX, y: endY } }, // Bottom
      { start: { x: startX, y: endY }, end: { x: startX, y: startY } }, // Left
    ]

    // Add corner positions
    positions.push(
      { x: startX, y: startY },
      { x: endX, y: startY },
      { x: startX, y: endY },
      { x: endX, y: endY },
    )

    let depth = 0
    while (positions.length < gamePlayers.length) {
      const newPositions: { x: number; y: number }[] = []
      for (const edge of edges) {
        const midpoints = this.getMidpoints(edge.start, edge.end, depth)
        newPositions.push(...midpoints)
      }

      // Filter out duplicates and add new positions
      newPositions.forEach((pos) => {
        if (!positions.some((p) => p.x === pos.x && p.y === pos.y)) {
          positions.push(pos)
        }
      })

      depth++

      // If we can't add more positions on the edges, break the loop
      if (newPositions.length === 0) break
    }

    // If we still need more positions, fill the inner part
    if (positions.length < gamePlayers.length) {
      this.fillInnerPositions(positions)
    }

    return positions.slice(0, gamePlayers.length)
  }

  private getMidpoints(
    start: { x: number; y: number },
    end: { x: number; y: number },
    depth: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = []
    const segments = Math.pow(2, depth + 1)
    for (let i = 1; i < segments; i += 2) {
      const x = Math.round(start.x + ((end.x - start.x) * i) / segments)
      const y = Math.round(start.y + ((end.y - start.y) * i) / segments)
      positions.push({ x, y })
    }
    return positions
  }

  private fillInnerPositions(positions: { x: number; y: number }[]): void {
    const { boardWidth, boardHeight, gamePlayers } = this.gameSetup
    let innerStartX = 3
    let innerStartY = 3
    let innerEndX = boardWidth - 4
    let innerEndY = boardHeight - 4

    while (
      positions.length < gamePlayers.length &&
      innerStartX < innerEndX &&
      innerStartY < innerEndY
    ) {
      // Add corner positions for this inner layer
      const innerPositions = [
        { x: innerStartX, y: innerStartY },
        { x: innerEndX, y: innerStartY },
        { x: innerStartX, y: innerEndY },
        { x: innerEndX, y: innerEndY },
      ]

      // Add midpoints for this inner layer
      if (innerEndX - innerStartX > 2) {
        innerPositions.push({
          x: Math.floor((innerStartX + innerEndX) / 2),
          y: innerStartY,
        })
        innerPositions.push({
          x: Math.floor((innerStartX + innerEndX) / 2),
          y: innerEndY,
        })
      }
      if (innerEndY - innerStartY > 2) {
        innerPositions.push({
          x: innerStartX,
          y: Math.floor((innerStartY + innerEndY) / 2),
        })
        innerPositions.push({
          x: innerEndX,
          y: Math.floor((innerStartY + innerEndY) / 2),
        })
      }

      // Add new positions if they don't already exist
      innerPositions.forEach((pos) => {
        if (!positions.some((p) => p.x === pos.x && p.y === pos.y)) {
          positions.push(pos)
        }
      })

      // Move to the next inner layer
      innerStartX += 2
      innerStartY += 2
      innerEndX -= 2
      innerEndY -= 2
    }
  }

  public visualizeBoard(turn: Turn): string {
    const { boardWidth, boardHeight } = this.gameSetup

    const board = Array(boardHeight)
      .fill(null)
      .map(() => Array(boardWidth).fill("."))

    // Add walls
    for (let i = 0; i < boardWidth; i++) {
      board[0][i] = "#"
      board[boardHeight - 1][i] = "#"
    }
    for (let i = 0; i < boardHeight; i++) {
      board[i][0] = "#"
      board[i][boardWidth - 1] = "#"
    }

    // Add snakes
    Object.entries(turn.playerPieces).forEach(([playerId, snake], index) => {
      const headPos = snake[0]
      const x = headPos % boardWidth
      const y = Math.floor(headPos / boardWidth)
      board[y][x] = (index + 1).toString()
    })

    // Convert to string
    return board.map((row) => row.join(" ")).join("\n")
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

    const foodPositions: number[] = []

    // Place food in the center of the board
    const centerX = Math.floor(boardWidth / 2)
    const centerY = Math.floor(boardHeight / 2)
    const centerPosition = centerY * boardWidth + centerX
    foodPositions.push(centerPosition)
    occupiedPositions.add(centerPosition)

    // Place additional food for each snake
    Object.values(playerPieces).forEach((snake) => {
      const snakeHead = snake[0]
      const headX = snakeHead % boardWidth
      const headY = Math.floor(snakeHead / boardWidth)

      const diagonalDirections = [
        { dx: 1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: -1 },
      ]

      for (const { dx, dy } of diagonalDirections) {
        const foodX = headX + dx
        const foodY = headY + dy

        if (
          foodX >= 1 &&
          foodX < boardWidth - 1 &&
          foodY >= 1 &&
          foodY < boardHeight - 1
        ) {
          const foodPosition = foodY * boardWidth + foodX
          if (!occupiedPositions.has(foodPosition)) {
            foodPositions.push(foodPosition)
            occupiedPositions.add(foodPosition)
            break
          }
        }
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
