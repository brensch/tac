// functions/src/gameprocessors/SnekProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Square, Turn, Move, GameState } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"

/**
 * Processor class for the Snek game logic.
 */
export class SnekProcessor extends GameProcessor {
  // Variable to control the percentage likelihood of food generation
  private foodSpawnChance: number = 0.5 // 50% chance to spawn food

  constructor(
    transaction: Transaction,
    gameID: string,
    latestMoves: Move[],
    currentTurn?: Turn,
  ) {
    super(transaction, gameID, latestMoves, currentTurn)
  }

  /**
   * Initializes the Snek game by setting up the board and creating the first turn.
   * @param gameState The current state of the game.
   */
  async initializeGame(gameState: GameState): Promise<void> {
    try {
      const initialBoard = this.initializeBoard(
        gameState.boardWidth,
        gameState.playerIDs,
      )

      // Initialize player health
      const initialHealth: number[] = gameState.playerIDs.map(() => 100)

      // Construct DocumentReference for the first turn
      const turnRef = admin
        .firestore()
        .collection(`games/${this.gameID}/turns`)
        .doc("1")

      const now = Date.now()

      const firstTurn: Turn = {
        turnNumber: 1,
        board: initialBoard,
        boardWidth: gameState.boardWidth,
        gameType: gameState.gameType,
        playerIDs: gameState.playerIDs,
        playerHealth: initialHealth,
        hasMoved: {},
        turnTime: gameState.maxTurnTime,
        startTime: admin.firestore.Timestamp.fromMillis(now),
        endTime: admin.firestore.Timestamp.fromMillis(now + 60 * 1000), // 60 seconds timeout for initial turn
        scores: gameState.playerIDs.map(() => 3), // Initial snake length is 3
        alivePlayers: [...gameState.playerIDs], // All players are alive at the start
      }

      // Set turn and update game within transaction
      this.transaction.set(turnRef, firstTurn)

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

  /**
   * Initializes the board for Snek.
   * @param boardWidth The width of the board.
   * @param playerIDs Array of player IDs.
   * @returns An array representing the initialized board.
   */
  private initializeBoard(boardWidth: number, playerIDs: string[]): Square[] {
    const boardSize = boardWidth * boardWidth
    const board: Square[] = Array(boardSize)
      .fill(null)
      .map(() => ({
        playerID: null,
        food: false,
        wall: false,
        bodyPosition: [],
        allowedPlayers: [],
        clash: null, // Initialize clash as null
      }))

    // Set walls around the edges
    for (let x = 0; x < boardWidth; x++) {
      for (let y = 0; y < boardWidth; y++) {
        const index = y * boardWidth + x
        if (
          x === 0 ||
          x === boardWidth - 1 ||
          y === 0 ||
          y === boardWidth - 1
        ) {
          board[index].wall = true
          board[index].allowedPlayers = []
        }
      }
    }

    // Generate starting positions with equal board access
    const positions = this.generateStartingPositions(
      boardWidth,
      playerIDs.length,
    )

    // Place each snake with all body segments on the same square
    playerIDs.forEach((playerID, index) => {
      const { x, y } = positions[index]
      const startIndex = y * boardWidth + x
      const startSquare = board[startIndex]

      // Place the snake with bodyPosition [0,1,2]
      startSquare.playerID = playerID
      startSquare.bodyPosition = [0, 1, 2]
    })

    // Place initial food two spaces towards the center from each snake
    this.placeInitialFood(board, boardWidth, positions)

    // Update allowedPlayers for squares adjacent to heads
    this.updateAllowedPlayers(board, boardWidth, new Set(playerIDs))

    logger.info("Snek: Board initialized with snakes spread out.", {
      board,
    })

    return board
  }

  /**
   * Generates starting positions that aim to give each snake equal access to the board.
   */
  private generateStartingPositions(
    boardWidth: number,
    numPlayers: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = []

    // Calculate positions around the perimeter, equally spaced
    const perimeterPositions = [
      { x: 1, y: 1 },
      { x: boardWidth - 2, y: 1 },
      { x: boardWidth - 2, y: boardWidth - 2 },
      { x: 1, y: boardWidth - 2 },
    ]

    // For more than 4 players, add positions along the edges
    if (numPlayers > 4) {
      const additionalPositions: { x: number; y: number }[] = []
      const numAdditional = numPlayers - 4
      const spacing = Math.floor((boardWidth - 4) / (numAdditional + 1))

      for (let i = 1; i <= numAdditional; i++) {
        additionalPositions.push({ x: 1 + i * spacing, y: 1 })
        additionalPositions.push({
          x: boardWidth - 2 - i * spacing,
          y: boardWidth - 2,
        })
      }
      positions.push(...perimeterPositions, ...additionalPositions)
    } else {
      positions.push(...perimeterPositions.slice(0, numPlayers))
    }

    return positions.slice(0, numPlayers)
  }

  /**
   * Places initial food two spaces towards the center from each snake's starting position.
   */
  private placeInitialFood(
    board: Square[],
    boardWidth: number,
    positions: { x: number; y: number }[],
  ): void {
    positions.forEach(({ x, y }) => {
      // Move two steps towards the center
      const centerX = Math.floor(boardWidth / 2)
      const centerY = Math.floor(boardWidth / 2)
      let deltaX = centerX - x
      let deltaY = centerY - y

      // Normalize deltas to move two steps
      const steps = 2
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      if (distance === 0) return // Already at center

      deltaX = Math.round((deltaX / distance) * steps)
      deltaY = Math.round((deltaY / distance) * steps)

      const foodX = x + deltaX
      const foodY = y + deltaY

      if (
        foodX >= 1 &&
        foodX < boardWidth - 1 &&
        foodY >= 1 &&
        foodY < boardWidth - 1
      ) {
        const foodIndex = foodY * boardWidth + foodX
        board[foodIndex].food = true
      }
    })
  }

  /**
   * Applies the latest moves to the Snek board and updates scores and alivePlayers.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const newBoard: Square[] = this.currentTurn.board.map((square) => ({
        ...square,
        bodyPosition: [...square.bodyPosition],
        allowedPlayers: [],
        clash: null, // Reset clashes
      })) // Deep copy

      const playerIDs = this.currentTurn.playerIDs
      const boardWidth = this.currentTurn.boardWidth
      const playerMoves: { [playerID: string]: number } = {}
      const deadPlayers: Set<string> = new Set()
      const alivePlayers: Set<string> = new Set(this.currentTurn.alivePlayers)

      // Copy playerHealth and decrease by 1
      const playerHealth = [...this.currentTurn.playerHealth]
      playerIDs.forEach((playerID, index) => {
        if (alivePlayers.has(playerID)) {
          playerHealth[index] -= 1
          if (playerHealth[index] <= 0) {
            deadPlayers.add(playerID)
            alivePlayers.delete(playerID)
            logger.info(`Snek: Player ${playerID} died due to zero health.`)
            // Mark their snake as clashes
            this.markSnakeAsClash(
              newBoard,
              playerID,
              "Snake died due to zero health",
            )
          }
        }
      })

      // Process latest moves
      this.latestMoves.forEach((move) => {
        playerMoves[move.playerID] = move.move
      })

      // Handle players who didn't submit a move
      alivePlayers.forEach((playerID) => {
        if (!playerMoves[playerID]) {
          // Player didn't submit a move
          const direction = this.getLastDirection(
            newBoard,
            playerID,
            boardWidth,
          )
          const headIndex = this.getHeadIndex(newBoard, playerID)
          if (direction) {
            const newX = (headIndex % boardWidth) + direction.dx
            const newY = Math.floor(headIndex / boardWidth) + direction.dy
            const newIndex = newY * boardWidth + newX
            playerMoves[playerID] = newIndex
          } else {
            // No previous direction, eliminate player
            deadPlayers.add(playerID)
            alivePlayers.delete(playerID)
            logger.warn(
              `Snek: Player ${playerID} did not submit a move and has no previous direction.`,
            )
            // Mark their snake as clashes
            this.markSnakeAsClash(
              newBoard,
              playerID,
              "Snake did not submit a move",
            )
          }
        }
      })

      // Validate that the move is to an adjacent square
      for (const playerID in playerMoves) {
        if (!alivePlayers.has(playerID)) continue

        const moveIndex = playerMoves[playerID]
        const headIndex = this.getHeadIndex(newBoard, playerID)
        const validMoves = this.getAdjacentIndices(headIndex, boardWidth)

        if (!validMoves.includes(moveIndex)) {
          // Invalid move, handle accordingly (e.g., eliminate player)
          deadPlayers.add(playerID)
          alivePlayers.delete(playerID)
          delete playerMoves[playerID]
          logger.warn(
            `Snek: Player ${playerID} submitted an invalid move to index ${moveIndex}, which is not adjacent. Player eliminated.`,
          )
          this.markSnakeAsClash(
            newBoard,
            playerID,
            "Invalid move: Not adjacent",
          )
        }
      }

      // Collect intended moves
      const intendedMoves: { [playerID: string]: number } = {}
      alivePlayers.forEach((playerID) => {
        const moveIndex = playerMoves[playerID]
        intendedMoves[playerID] = moveIndex
      })

      // Apply moves and update snakes
      const updatedSnakes: {
        [playerID: string]: { positions: number[]; ateFood: boolean }
      } = {}
      const squareOccupants: {
        [index: number]: { heads: string[]; bodies: string[] }
      } = {}

      // First, move snakes and record their new positions
      alivePlayers.forEach((playerID) => {
        const moveIndex = intendedMoves[playerID]
        let snakeSquares: { index: number; bodyPosition: number[] }[] = []

        // Get current positions and update body positions
        for (let i = 0; i < newBoard.length; i++) {
          const square = newBoard[i]
          if (square.playerID === playerID) {
            snakeSquares.push({
              index: i,
              bodyPosition: square.bodyPosition.map((pos) => pos + 1),
            })
          }
        }

        // Add new head
        snakeSquares.push({ index: moveIndex, bodyPosition: [0] })

        // Check if the snake ate food
        const ateFood = newBoard[moveIndex].food

        if (ateFood) {
          // Restore health to 100
          playerHealth[playerIDs.indexOf(playerID)] = 100
          logger.info(`Snek: Player ${playerID} ate food and restored health.`)
        } else {
          // Remove tail
          let maxPosition = -1
          let tailIndex = -1
          snakeSquares.forEach((part) => {
            const maxPosInPart = Math.max(...part.bodyPosition)
            if (maxPosInPart > maxPosition) {
              maxPosition = maxPosInPart
              tailIndex = part.index
            }
          })

          // Remove the tail segment
          snakeSquares.forEach((part) => {
            if (part.index === tailIndex) {
              part.bodyPosition = part.bodyPosition.filter(
                (pos) => pos !== maxPosition,
              )
            }
          })
          // Remove parts with empty bodyPosition
          snakeSquares = snakeSquares.filter(
            (part) => part.bodyPosition.length > 0,
          )
        }

        updatedSnakes[playerID] = {
          positions: snakeSquares.map((part) => part.index),
          ateFood,
        }

        // Update squareOccupants
        snakeSquares.forEach((part) => {
          const index = part.index
          if (!squareOccupants[index]) {
            squareOccupants[index] = { heads: [], bodies: [] }
          }
          if (part.bodyPosition.includes(0)) {
            squareOccupants[index].heads.push(playerID)
          } else {
            squareOccupants[index].bodies.push(playerID)
          }
        })
      })

      // Process collisions
      for (const indexStr in squareOccupants) {
        const index = parseInt(indexStr)
        const info = squareOccupants[index]

        // Head-to-head collisions
        if (info.heads.length > 1) {
          const players = info.heads
          // Determine the longest snake(s)
          let maxLength = -Infinity
          let survivors: string[] = []
          const lengths: { [playerID: string]: number } = {}

          players.forEach((playerID) => {
            const snakeLength = this.getSnakeLength(newBoard, playerID)
            lengths[playerID] = snakeLength
            if (snakeLength > maxLength) {
              maxLength = snakeLength
              survivors = [playerID]
            } else if (snakeLength === maxLength) {
              survivors.push(playerID)
            }
          })

          // Eliminate non-survivors
          players.forEach((playerID) => {
            if (!survivors.includes(playerID)) {
              deadPlayers.add(playerID)
              alivePlayers.delete(playerID)
              logger.info(
                `Snek: Player ${playerID} died in head-to-head collision at index ${index}.`,
              )
              this.markSnakeAsClash(
                newBoard,
                playerID,
                "Head-to-head collision",
              )
            }
          })

          // If tie, all die
          if (survivors.length > 1) {
            survivors.forEach((playerID) => {
              deadPlayers.add(playerID)
              alivePlayers.delete(playerID)
              logger.info(
                `Snek: Player ${playerID} died in tie head-to-head collision at index ${index}.`,
              )
              this.markSnakeAsClash(
                newBoard,
                playerID,
                "Tie in head-to-head collision",
              )
            })
          }
        }

        // Head-to-body collisions
        if (info.heads.length > 0 && info.bodies.length > 0) {
          info.heads.forEach((headPlayerID) => {
            info.bodies.forEach((bodyPlayerID) => {
              if (headPlayerID !== bodyPlayerID) {
                // Head collided with another snake's body
                deadPlayers.add(headPlayerID)
                alivePlayers.delete(headPlayerID)
                logger.info(
                  `Snek: Player ${headPlayerID} collided with another snake's body at index ${index}.`,
                )
                this.markSnakeAsClash(
                  newBoard,
                  headPlayerID,
                  "Collided with another snake's body",
                )
              }
            })
          })
        }
      }

      // Update the board with the new positions
      // Clear previous snake positions
      newBoard.forEach((square) => {
        if (square.playerID && !alivePlayers.has(square.playerID)) {
          square.playerID = null
          square.bodyPosition = []
        }
      })

      // Update alive snakes
      alivePlayers.forEach((playerID) => {
        const snakePositions = updatedSnakes[playerID]?.positions || []
        snakePositions.forEach((index) => {
          const square = newBoard[index]
          square.playerID = playerID
          square.bodyPosition = [0] // Simplify bodyPosition for now
          square.food = false // Remove food if any
        })
      })

      // Food generation based on random chance
      if (Math.random() < this.foodSpawnChance) {
        this.generateFood(newBoard, boardWidth)
      }

      // Update allowedPlayers for squares adjacent to heads
      this.updateAllowedPlayers(newBoard, boardWidth, alivePlayers)

      // Update the board, playerHealth, scores, and alivePlayers in the current turn
      this.currentTurn.board = newBoard
      this.currentTurn.playerHealth = playerHealth

      // Update scores and alivePlayers
      const scores = playerIDs.map((playerID) =>
        this.getSnakeLength(newBoard, playerID),
      )
      this.currentTurn.scores = scores
      this.currentTurn.alivePlayers = Array.from(alivePlayers)
    } catch (error) {
      logger.error(`Snek: Error applying moves for game ${this.gameID}:`, error)
      throw error
    }
  }

  /**
   * Marks the snake's body squares as clashes for one turn with the given reason.
   */
  private markSnakeAsClash(
    board: Square[],
    playerID: string,
    reason: string,
  ): void {
    for (let i = 0; i < board.length; i++) {
      const square = board[i]
      if (square.playerID === playerID) {
        square.playerID = null
        square.bodyPosition = []
        square.allowedPlayers = []

        // Mark the square as a clash
        square.clash = {
          players: [playerID],
          reason: reason,
        }
      }
    }
  }

  /**
   * Finds winners based on the updated Snek board.
   * @returns An array of Winner objects.
   */
  async findWinners(): Promise<Winner[]> {
    if (!this.currentTurn) return []
    try {
      const board = this.currentTurn.board
      const playerIDs = this.currentTurn.playerIDs

      const alivePlayers = new Set<string>(this.currentTurn.alivePlayers)

      if (alivePlayers.size === 0) {
        // All players are dead; it's a draw
        const winners: Winner[] = playerIDs.map((playerID) => ({
          playerID,
          score: this.getSnakeLength(board, playerID),
          winningSquares: [],
        }))
        logger.info(`Snek: Game ended in a draw.`)
        return winners
      } else if (alivePlayers.size === 1) {
        // Single winner
        const winners: Winner[] = []
        alivePlayers.forEach((playerID) => {
          const score = this.getSnakeLength(board, playerID)
          const winningSquares = board
            .map((square, index) => (square.playerID === playerID ? index : -1))
            .filter((index) => index !== -1)

          winners.push({
            playerID,
            score,
            winningSquares,
          })

          logger.info(`Snek: Player ${playerID} has won the game.`)
        })

        return winners
      } else {
        // Game continues
        return []
      }
    } catch (error) {
      logger.error(
        `Snek: Error finding winners for game ${this.gameID}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Helper method to get the head index of a snake.
   */
  private getHeadIndex(board: Square[], playerID: string): number {
    for (let i = 0; i < board.length; i++) {
      const square = board[i]
      if (square.playerID === playerID && square.bodyPosition.includes(0)) {
        return i
      }
    }
    throw new Error(`Head not found for player ${playerID}`)
  }

  /**
   * Helper method to get the last direction of a snake.
   */
  private getLastDirection(
    board: Square[],
    playerID: string,
    boardWidth: number,
  ): { dx: number; dy: number } | null {
    let headIndex = -1
    let secondIndex = -1
    for (let i = 0; i < board.length; i++) {
      const square = board[i]
      if (square.playerID === playerID) {
        if (square.bodyPosition.includes(0)) {
          headIndex = i
        } else if (square.bodyPosition.includes(1)) {
          secondIndex = i
        }
      }
    }
    if (headIndex >= 0 && secondIndex >= 0) {
      const headX = headIndex % boardWidth
      const headY = Math.floor(headIndex / boardWidth)
      const secondX = secondIndex % boardWidth
      const secondY = Math.floor(secondIndex / boardWidth)
      const dx = headX - secondX
      const dy = headY - secondY
      return { dx, dy }
    }
    return null
  }

  /**
   * Helper method to get the length of a snake.
   */
  private getSnakeLength(board: Square[], playerID: string): number {
    let length = 0
    for (const square of board) {
      if (square.playerID === playerID) {
        length += square.bodyPosition.length
      }
    }
    return length
  }

  /**
   * Generates food on the board based on random chance.
   */
  private generateFood(board: Square[], boardWidth: number): void {
    // Find all free squares
    const freeIndices: number[] = []
    for (let i = 0; i < board.length; i++) {
      const square = board[i]
      if (square.playerID === null && !square.food && !square.clash) {
        freeIndices.push(i)
      }
    }

    if (freeIndices.length === 0) {
      logger.warn("Snek: No free squares to place food.")
      return
    }

    // Randomly select one free square to place food
    const randomIndex =
      freeIndices[Math.floor(Math.random() * freeIndices.length)]
    board[randomIndex].food = true
    logger.info(`Snek: Placed food at index ${randomIndex}.`)
  }

  /**
   * Updates allowedPlayers for squares adjacent to the heads of snakes.
   */
  private updateAllowedPlayers(
    board: Square[],
    boardWidth: number,
    alivePlayers: Set<string>,
  ): void {
    alivePlayers.forEach((playerID) => {
      const headIndex = this.getHeadIndex(board, playerID)
      const adjacentSquares = this.getAdjacentIndices(headIndex, boardWidth)
      adjacentSquares.forEach((squareIndex) => {
        if (!board[squareIndex].allowedPlayers.includes(playerID)) {
          board[squareIndex].allowedPlayers.push(playerID)
        }
      })
    })
  }

  /**
   * Helper method to get adjacent indices (up, down, left, right) from a given index.
   */
  private getAdjacentIndices(index: number, boardWidth: number): number[] {
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
      if (newX >= 0 && newX < boardWidth && newY >= 0 && newY < boardWidth) {
        indices.push(newY * boardWidth + newX)
      }
    })

    return indices
  }
}
