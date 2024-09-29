// functions/src/gameprocessors/SnekProcessor.ts

import { GameProcessor } from "./GameProcessor"
import { Winner, Square, Turn, Move, GameState } from "@shared/types/Game"
import { logger } from "../logger" // Adjust the path as necessary
import * as admin from "firebase-admin"
import { Transaction } from "firebase-admin/firestore"

/**
 * Processor class for the Snek game logic.
 */
export class SnekProcessor extends GameProcessor {
  // Variables to tune food generation
  private foodGenerationRate: number = 0.1 // Probability of generating food per empty square per turn

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
        clashes: {},
        turnTime: gameState.maxTurnTime,
        startTime: admin.firestore.Timestamp.fromMillis(now),
        endTime: admin.firestore.Timestamp.fromMillis(
          now + gameState.maxTurnTime * 1000,
        ),
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
          board[index].allowedPlayers = [] // No one can move into walls
        }
      }
    }

    // Place snakes on the board evenly spread out
    const startingPositions = this.getStartingPositionsAndDirections(
      boardWidth,
      playerIDs.length,
    )

    playerIDs.forEach((playerID, idx) => {
      const { x: headX, y: headY, dx, dy } = startingPositions[idx]

      for (let i = 0; i < 3; i++) {
        // Length 3 snake
        const x = headX - dx * i
        const y = headY - dy * i
        const index = y * boardWidth + x

        // Adjusted condition to include positions at edges (excluding walls)
        if (x < 1 || x > boardWidth - 2 || y < 1 || y > boardWidth - 2) {
          throw new Error(
            `Cannot place snake for player ${playerID}, out of bounds.`,
          )
        }

        const square = board[index]

        if (square.playerID !== null) {
          throw new Error(
            `Cannot place snake for player ${playerID}, square already occupied.`,
          )
        }

        square.playerID = playerID
        square.bodyPosition = [i] // i = 0 for head, 1, 2 for body
        square.allowedPlayers = [] // No one can move into this square

        // Set allowed moves for the head
        if (i === 0) {
          const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 0, dy: 1 }, // Down
            { dx: -1, dy: 0 }, // Left
            { dx: 1, dy: 0 }, // Right
          ]

          directions.forEach(({ dx, dy }) => {
            const adjX = headX + dx
            const adjY = headY + dy
            if (
              adjX >= 1 &&
              adjX <= boardWidth - 2 &&
              adjY >= 1 &&
              adjY <= boardWidth - 2
            ) {
              const adjIndex = adjY * boardWidth + adjX
              const adjSquare = board[adjIndex]
              if (!adjSquare.allowedPlayers.includes(playerID)) {
                adjSquare.allowedPlayers.push(playerID)
              }
            }
          })
        }
      }
    })

    logger.info("Snek: Board initialized with snakes and walls.", {
      board,
    })

    return board
  }

  /**
   * Generates starting positions and directions for snakes.
   */
  private getStartingPositionsAndDirections(
    boardWidth: number,
    playerCount: number,
  ): { x: number; y: number; dx: number; dy: number }[] {
    const positions: { x: number; y: number; dx: number; dy: number }[] = []

    const positionsPool = [
      { x: 1, y: 1, dx: -1, dy: 0 }, // Top-left corner, moving left
      { x: boardWidth - 2, y: 1, dx: 1, dy: 0 }, // Top-right corner, moving right
      { x: 1, y: boardWidth - 2, dx: -1, dy: 0 }, // Bottom-left corner, moving left
      { x: boardWidth - 2, y: boardWidth - 2, dx: 1, dy: 0 }, // Bottom-right corner, moving right
      { x: Math.floor(boardWidth / 2), y: 1, dx: 0, dy: -1 }, // Top-center, moving up
      { x: Math.floor(boardWidth / 2), y: boardWidth - 2, dx: 0, dy: 1 }, // Bottom-center, moving down
      { x: 1, y: Math.floor(boardWidth / 2), dx: -1, dy: 0 }, // Left-center, moving left
      { x: boardWidth - 2, y: Math.floor(boardWidth / 2), dx: 1, dy: 0 }, // Right-center, moving right
    ]

    for (let i = 0; i < playerCount; i++) {
      positions.push(positionsPool[i % positionsPool.length])
    }

    return positions
  }

  /**
   * Applies the latest moves to the Snek board.
   */
  async applyMoves(): Promise<void> {
    if (!this.currentTurn) return
    try {
      const newBoard = this.currentTurn.board.map((square) => ({
        ...square,
        bodyPosition: [...square.bodyPosition],
        allowedPlayers: [],
      })) // Deep copy
      const clashes: Record<string, any> = {}
      const playerIDs = this.currentTurn.playerIDs
      const boardWidth = this.currentTurn.boardWidth
      const playerMoves: { [playerID: string]: number } = {}
      const deadPlayers: Set<string> = new Set()

      // Copy playerHealth and decrease by 1
      const playerHealth = [...this.currentTurn.playerHealth]
      playerIDs.forEach((playerID, index) => {
        if (!deadPlayers.has(playerID)) {
          playerHealth[index] -= 1
          if (playerHealth[index] <= 0) {
            deadPlayers.add(playerID)
            logger.info(`Snek: Player ${playerID} died due to zero health.`)
            // Mark their snake as clashes
            this.markSnakeAsClash(
              newBoard,
              playerID,
              "Snake died due to zero health",
              clashes,
            )
          }
        }
      })

      // Process latest moves
      this.latestMoves.forEach((move) => {
        playerMoves[move.playerID] = move.move
      })

      // Handle players who didn't submit a move
      playerIDs.forEach((playerID) => {
        if (!playerMoves[playerID] && !deadPlayers.has(playerID)) {
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
            logger.warn(
              `Snek: Player ${playerID} did not submit a move and has no previous direction.`,
            )
            // Mark their snake as clashes
            this.markSnakeAsClash(
              newBoard,
              playerID,
              "Snake did not submit a move",
              clashes,
            )
          }
        }
      })

      // Collect intended moves
      const intendedMoves: { [playerID: string]: number } = {}
      for (const playerID of playerIDs) {
        if (deadPlayers.has(playerID)) continue
        const moveIndex = playerMoves[playerID]
        const moveX = moveIndex % boardWidth
        const moveY = Math.floor(moveIndex / boardWidth)

        // Check for walls and out-of-bounds
        if (
          moveX < 0 ||
          moveX >= boardWidth ||
          moveY < 0 ||
          moveY >= boardWidth ||
          newBoard[moveIndex].wall
        ) {
          deadPlayers.add(playerID)
          logger.info(`Snek: Player ${playerID} ran into a wall and died.`)
          // Mark their snake as clashes
          this.markSnakeAsClash(
            newBoard,
            playerID,
            "Snake ran into a wall",
            clashes,
          )
          continue
        }

        intendedMoves[playerID] = moveIndex
      }

      // Map of squares to players who intend to move there
      const moveCollisions: { [index: number]: string[] } = {}
      for (const playerID in intendedMoves) {
        const moveIndex = intendedMoves[playerID]
        if (!moveCollisions[moveIndex]) {
          moveCollisions[moveIndex] = []
        }
        moveCollisions[moveIndex].push(playerID)
      }

      // Handle head-to-head collisions
      for (const indexStr in moveCollisions) {
        const index = parseInt(indexStr)
        const players = moveCollisions[index]

        if (players.length > 1) {
          // Collision
          let minLength = Infinity
          let survivors: string[] = []
          let lengths: { [playerID: string]: number } = {}

          players.forEach((playerID) => {
            const snakeLength = this.getSnakeLength(newBoard, playerID)
            lengths[playerID] = snakeLength
            if (snakeLength < minLength) {
              minLength = snakeLength
              survivors = [playerID]
            } else if (snakeLength === minLength) {
              survivors.push(playerID)
            }
          })

          // Eliminate non-survivors
          players.forEach((playerID) => {
            if (!survivors.includes(playerID)) {
              deadPlayers.add(playerID)
              delete intendedMoves[playerID]
              logger.info(
                `Snek: Player ${playerID} died in head-to-head collision at index ${index}.`,
              )
              // Mark their snake as clashes
              this.markSnakeAsClash(
                newBoard,
                playerID,
                "Head-to-head collision",
                clashes,
              )
            }
          })

          // If tie, all die
          if (survivors.length > 1) {
            survivors.forEach((playerID) => {
              deadPlayers.add(playerID)
              delete intendedMoves[playerID]
              logger.info(
                `Snek: Player ${playerID} died in tie head-to-head collision at index ${index}.`,
              )
              // Mark their snake as clashes
              this.markSnakeAsClash(
                newBoard,
                playerID,
                "Tie in head-to-head collision",
                clashes,
              )
            })
          }
        }
      }

      // Check for collisions with other snakes' bodies
      for (const playerID in intendedMoves) {
        if (deadPlayers.has(playerID)) continue

        const moveIndex = intendedMoves[playerID]
        const targetSquare = newBoard[moveIndex]

        if (
          targetSquare.playerID !== null &&
          targetSquare.bodyPosition.length > 0
        ) {
          deadPlayers.add(playerID)
          delete intendedMoves[playerID]
          logger.info(
            `Snek: Player ${playerID} ran into a snake and died at index ${moveIndex}.`,
          )
          // Mark their snake as clashes
          this.markSnakeAsClash(
            newBoard,
            playerID,
            "Ran into another snake",
            clashes,
          )
        }
      }

      // Update snakes for surviving players
      for (const playerID in intendedMoves) {
        if (deadPlayers.has(playerID)) continue

        const moveIndex = intendedMoves[playerID]
        const targetSquare = newBoard[moveIndex]
        const ateFood = targetSquare.food

        // Move the head into the new square
        targetSquare.playerID = playerID
        targetSquare.bodyPosition = [0]
        targetSquare.allowedPlayers = []
        targetSquare.food = false

        // Increase bodyPosition of existing body parts
        for (const square of newBoard) {
          if (square.playerID === playerID && square !== targetSquare) {
            square.bodyPosition = square.bodyPosition.map((pos) => pos + 1)
          }
        }

        // Remove the tail unless ate food
        if (!ateFood) {
          let tailIndex = -1
          let maxPosition = -1
          newBoard.forEach((square, idx) => {
            if (square.playerID === playerID) {
              const maxPosInSquare = Math.max(...square.bodyPosition)
              if (maxPosInSquare > maxPosition) {
                maxPosition = maxPosInSquare
                tailIndex = idx
              }
            }
          })
          if (tailIndex >= 0) {
            const tailSquare = newBoard[tailIndex]
            tailSquare.bodyPosition = tailSquare.bodyPosition.filter(
              (pos) => pos !== maxPosition,
            )
            if (tailSquare.bodyPosition.length === 0) {
              tailSquare.playerID = null
            }
          }
        } else {
          // Restore health to 100
          playerHealth[playerIDs.indexOf(playerID)] = 100
          logger.info(`Snek: Player ${playerID} ate food and restored health.`)
        }
      }

      // Remove dead snakes from the board and mark as clashes
      deadPlayers.forEach((playerID) => {
        this.markSnakeAsClash(newBoard, playerID, "Snake died", clashes)
      })

      // Generate new food
      this.generateFood(newBoard, boardWidth)

      // Update allowedPlayers for squares adjacent to heads
      this.updateAllowedPlayers(newBoard, boardWidth, playerIDs, deadPlayers)

      // Update the board, clashes, and playerHealth in the current turn
      this.currentTurn.board = newBoard
      this.currentTurn.clashes = clashes
      this.currentTurn.playerHealth = playerHealth
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
    clashes: Record<string, any>,
  ): void {
    for (let i = 0; i < board.length; i++) {
      const square = board[i]
      if (square.playerID === playerID) {
        square.playerID = null
        square.bodyPosition = []
        square.allowedPlayers = []

        // Mark the square as a clash
        clashes[i] = {
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

      const alivePlayers = new Set<string>()

      playerIDs.forEach((playerID) => {
        const isAlive = board.some(
          (square) =>
            square.playerID === playerID && square.bodyPosition.length > 0,
        )
        if (isAlive) {
          alivePlayers.add(playerID)
        }
      })

      if (alivePlayers.size <= 1) {
        // Game over
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
   * Generates food on the board based on the food generation rate.
   */
  private generateFood(board: Square[], boardWidth: number): void {
    for (let i = 0; i < board.length; i++) {
      const square = board[i]
      if (square.playerID === null && !square.wall && !square.food) {
        if (Math.random() < this.foodGenerationRate) {
          square.food = true
        }
      }
    }
  }

  /**
   * Updates allowedPlayers for squares adjacent to the heads of snakes.
   */
  private updateAllowedPlayers(
    board: Square[],
    boardWidth: number,
    playerIDs: string[],
    deadPlayers: Set<string>,
  ): void {
    playerIDs.forEach((playerID) => {
      if (deadPlayers.has(playerID)) return

      const headIndex = this.getHeadIndex(board, playerID)
      const headX = headIndex % boardWidth
      const headY = Math.floor(headIndex / boardWidth)

      const directions = [
        { dx: 0, dy: -1 }, // Up
        { dx: 0, dy: 1 }, // Down
        { dx: -1, dy: 0 }, // Left
        { dx: 1, dy: 0 }, // Right
      ]

      directions.forEach(({ dx, dy }) => {
        const x = headX + dx
        const y = headY + dy
        if (x >= 0 && x < boardWidth && y >= 0 && y < boardWidth) {
          const index = y * boardWidth + x
          const square = board[index]
          if (!square.allowedPlayers.includes(playerID)) {
            square.allowedPlayers.push(playerID)
          }
        }
      })
    })
  }
}
