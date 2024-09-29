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
        endTime: admin.firestore.Timestamp.fromMillis(now + 60 * 1000),
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
          board[index].allowedPlayers = [] // No one can move into walls
        }
      }
    }

    // Generate starting positions
    const numPlayers = playerIDs.length
    const positions: { x: number; y: number }[] = []

    const numRows = Math.ceil(Math.sqrt(numPlayers))
    const numCols = Math.ceil(numPlayers / numRows)
    const rowSpacing = (boardWidth - 2) / (numRows + 1)
    const colSpacing = (boardWidth - 2) / (numCols + 1)

    let playerIndex = 0
    for (let row = 1; row <= numRows; row++) {
      const y = Math.min(
        Math.max(1, Math.round(row * rowSpacing)),
        boardWidth - 2,
      )
      for (let col = 1; col <= numCols; col++) {
        if (playerIndex >= numPlayers) break
        const x = Math.min(
          Math.max(1, Math.round(col * colSpacing)),
          boardWidth - 2,
        )
        positions.push({ x, y })
        playerIndex++
      }
    }

    // Place each snake with all body segments on the same square
    playerIDs.forEach((playerID, index) => {
      const { x, y } = positions[index]
      const startIndex = y * boardWidth + x
      const startSquare = board[startIndex]

      // Place the snake with bodyPosition [0,1,2]
      startSquare.playerID = playerID
      startSquare.bodyPosition = [0, 1, 2]
    })

    // Update allowedPlayers for squares adjacent to heads
    this.updateAllowedPlayers(board, boardWidth, playerIDs, new Set<string>())

    logger.info("Snek: Board initialized with snakes spread out.", {
      board,
    })

    return board
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
        clash: null, // Reset clashes
      })) // Deep copy

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
          this.markSnakeAsClash(newBoard, playerID, "Snake ran into a wall")
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
              delete intendedMoves[playerID]
              logger.info(
                `Snek: Player ${playerID} died in head-to-head collision at index ${index}.`,
              )
              // Mark their snake as clashes
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
              delete intendedMoves[playerID]
              logger.info(
                `Snek: Player ${playerID} died in tie head-to-head collision at index ${index}.`,
              )
              // Mark their snake as clashes
              this.markSnakeAsClash(
                newBoard,
                playerID,
                "Tie in head-to-head collision",
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
          this.markSnakeAsClash(newBoard, playerID, "Ran into another snake")
        }
      }

      // Update snakes for surviving players
      for (const playerID in intendedMoves) {
        if (deadPlayers.has(playerID)) continue

        const moveIndex = intendedMoves[playerID]
        const targetSquare = newBoard[moveIndex]
        const ateFood = targetSquare.food

        // Move the head into the new square
        if (
          targetSquare.playerID !== null &&
          targetSquare.bodyPosition.length > 0
        ) {
          // Collision with another snake's body (should have been handled earlier)
          deadPlayers.add(playerID)
          logger.info(
            `Snek: Player ${playerID} collided with another snake's body at index ${moveIndex}.`,
          )
          // Mark their snake as clashes
          this.markSnakeAsClash(
            newBoard,
            playerID,
            "Collided with another snake's body",
          )
          continue
        }

        // Update body positions
        // Increase bodyPosition of existing body parts
        for (const square of newBoard) {
          if (square.playerID === playerID) {
            square.bodyPosition = square.bodyPosition.map((pos) => pos + 1)
          }
        }

        // Move head to the new square
        targetSquare.playerID = playerID
        targetSquare.bodyPosition.push(0)
        targetSquare.allowedPlayers = []
        targetSquare.food = false

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

      // Remove dead players from allowed moves
      playerIDs.forEach((playerID) => {
        if (deadPlayers.has(playerID)) {
          // Remove player from all allowedPlayers arrays
          newBoard.forEach((square) => {
            square.allowedPlayers = square.allowedPlayers.filter(
              (id) => id !== playerID,
            )
          })
        }
      })

      // Food generation based on random chance
      if (Math.random() < this.foodSpawnChance) {
        this.generateFood(newBoard, boardWidth)
      }

      // Update allowedPlayers for squares adjacent to heads
      this.updateAllowedPlayers(newBoard, boardWidth, playerIDs, deadPlayers)

      // Update the board and playerHealth in the current turn
      this.currentTurn.board = newBoard
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

      if (alivePlayers.size === 0) {
        // All players are dead; it's a draw
        const winners: Winner[] = playerIDs.map((playerID) => ({
          playerID,
          score: 0,
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
      if (
        square.playerID === null &&
        !square.wall &&
        !square.food &&
        !square.clash
      ) {
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
