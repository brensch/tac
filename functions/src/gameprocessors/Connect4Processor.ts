// // functions/src/gameprocessors/Connect4Processor.ts

// import { GameProcessor } from "./GameProcessor"
// import { Winner, Turn, Move, GameState } from "@shared/types/Game"
// import { logger } from "../logger"
// import * as admin from "firebase-admin"
// import { Transaction } from "firebase-admin/firestore"

// /**
//  * Processor class for the Connect4 game logic.
//  */
// export class Connect4Processor extends GameProcessor {
//   constructor(
//     transaction: Transaction,
//     gameID: string,
//     latestMoves: Move[],
//     currentTurn?: Turn,
//   ) {
//     super(transaction, gameID, latestMoves, currentTurn)
//   }

//   /**
//    * Initializes the Connect4 game by setting up the initial turn.
//    * @param gameState The current state of the game.
//    */
//   async initializeGame(gameState: GameState): Promise<void> {
//     try {
//       const initialTurn = this.initializeTurn(gameState)

//       // Construct DocumentReference for the first turn
//       const turnRef = admin
//         .firestore()
//         .collection(`games/${this.gameID}/turns`)
//         .doc("1")

//       // Set turn and update game within transaction
//       this.transaction.set(turnRef, initialTurn)

//       // Reference to the game document
//       const gameRef = admin.firestore().collection("games").doc(this.gameID)

//       // Update the game document to mark it as started
//       this.transaction.update(gameRef, { started: true })

//       logger.info(
//         `Connect4: Turn 1 created and game ${this.gameID} has started.`,
//       )
//     } catch (error) {
//       logger.error(`Connect4: Error initializing game ${this.gameID}:`, error)
//       throw error
//     }
//   }

//   /**
//    * Initializes the first turn for Connect4.
//    * @param gameState The current state of the game.
//    * @returns The initial Turn object.
//    */
//   private initializeTurn(gameState: GameState): Turn {
//     const { boardWidth, boardHeight, playerIDs } = gameState
//     const now = Date.now()

//     // Initialize grid
//     const grid: { [position: number]: string | null } = {}
//     for (let i = 0; i < boardWidth * boardHeight; i++) {
//       grid[i] = null
//     }

//     // Initialize playerPieces as occupied positions for each player
//     const playerPieces: { [playerID: string]: number[] } = {}
//     playerIDs.forEach((playerID) => {
//       playerPieces[playerID] = []
//     })

//     // Initialize allowed moves (top row)
//     const allowedMoves = this.calculateAllowedMoves(
//       grid,
//       boardWidth,
//       boardHeight,
//       playerIDs,
//     )

//     const firstTurn: Turn = {
//       turnNumber: 1,
//       boardWidth: boardWidth,
//       boardHeight: boardHeight,
//       gameType: gameState.gameType,
//       playerIDs: playerIDs,
//       playerHealth: {}, // Not used in Connect4
//       hasMoved: {},
//       turnTime: gameState.maxTurnTime,
//       startTime: Timestamp.fromMillis(now),
//       endTime: Timestamp.fromMillis(
//         now + gameState.maxTurnTime * 1000,
//       ),
//       scores: {}, // Not used at the start
//       alivePlayers: [...playerIDs],
//       allowedMoves: allowedMoves,
//       walls: [], // No walls in Connect4
//       playerPieces: playerPieces, // Players' occupied positions
//       food: [], // No food in Connect4
//       hazards: [], // No hazards in Connect4
//     }

//     return firstTurn
//   }

//   /**
//    * Calculates allowed moves (columns that are not full).
//    */
//   private calculateAllowedMoves(
//     grid: { [position: number]: string | null },
//     boardWidth: number,
//     boardHeight: number,
//     playerIDs: string[],
//   ): { [playerID: string]: number[] } {
//     const allowedMoves: { [playerID: string]: number[] } = {}
//     const topRowIndices: number[] = []

//     for (let x = 0; x < boardWidth; x++) {
//       const index = x
//       if (grid[index] === null) {
//         topRowIndices.push(index)
//       }
//     }

//     // All players have the same allowed moves in Connect4
//     playerIDs.forEach((playerID) => {
//       allowedMoves[playerID] = [...topRowIndices]
//     })

//     return allowedMoves
//   }

//   /**
//    * Applies the latest moves to the Connect4 game.
//    */
//   async applyMoves(): Promise<void> {
//     if (!this.currentTurn) return
//     try {
//       const { boardWidth, boardHeight, playerPieces } = this.currentTurn

//       // Deep copy grid and playerPieces
//       const newSnakes = { ...playerPieces }
//       Object.keys(newSnakes).forEach((playerID) => {
//         newSnakes[playerID] = [...newSnakes[playerID]]
//       })

//       // Process latest moves
//       for (const move of this.latestMoves) {
//         const { playerID, move: position } = move

//         // Validate move
//         const allowedMoves = this.currentTurn.allowedMoves[playerID]
//         if (!allowedMoves.includes(position)) {
//           logger.warn(
//             `Connect4: Invalid move by ${playerID} to position ${position}.`,
//           )
//           continue
//         }

//         // Drop the piece to the lowest available position in the column
//         let targetPosition = position
//         while (
//           targetPosition + boardWidth < boardWidth * boardHeight &&
//           newGrid[targetPosition + boardWidth] === null
//         ) {
//           targetPosition += boardWidth
//         }

//         newGrid[targetPosition] = playerID

//         // Update the player's occupied positions in playerPieces
//         newSnakes[playerID].push(targetPosition)
//       }

//       // Update allowed moves
//       const newAllowedMoves = this.calculateAllowedMoves(
//         newGrid,
//         boardWidth,
//         boardHeight,
//         this.currentTurn.playerIDs,
//       )

//       // Update the current turn
//       this.currentTurn.grid = newGrid
//       this.currentTurn.allowedMoves = newAllowedMoves
//       this.currentTurn.playerPieces = newSnakes
//     } catch (error) {
//       logger.error(
//         `Connect4: Error applying moves for game ${this.gameID}:`,
//         error,
//       )
//       throw error
//     }
//   }

//   /**
//    * Finds winners based on the current state of the grid.
//    * @returns An array of Winner objects.
//    */
//   async findWinners(): Promise<Winner[]> {
//     if (!this.currentTurn) return []
//     try {
//       const { grid, boardWidth, boardHeight, playerIDs } = this.currentTurn

//       // Check for a winner
//       for (const playerID of playerIDs) {
//         const winningSquares = this.checkWinner(
//           grid!,
//           boardWidth,
//           boardHeight,
//           playerID,
//         )
//         if (winningSquares.length >= 4) {
//           const winner: Winner = {
//             playerID,
//             score: 1,
//             winningSquares,
//           }
//           logger.info(`Connect4: Player ${playerID} has won the game.`)
//           return [winner]
//         }
//       }

//       // Check for draw (no more moves)
//       if (Object.values(grid!).every((cell) => cell !== null)) {
//         logger.info(`Connect4: Game ended in a draw.`)
//         return playerIDs.map((playerID) => ({
//           playerID,
//           score: 0,
//           winningSquares: [],
//         }))
//       }

//       // Game continues
//       return []
//     } catch (error) {
//       logger.error(
//         `Connect4: Error finding winners for game ${this.gameID}:`,
//         error,
//       )
//       throw error
//     }
//   }

//   /**
//    * Checks if the player has won.
//    */
//   private checkWinner(
//     grid: { [position: number]: string | null },
//     boardWidth: number,
//     boardHeight: number,
//     playerID: string,
//   ): number[] {
//     const directions = [
//       { dx: 1, dy: 0 }, // Horizontal
//       { dx: 0, dy: 1 }, // Vertical
//       { dx: 1, dy: 1 }, // Diagonal down-right
//       { dx: 1, dy: -1 }, // Diagonal up-right
//     ]

//     for (let y = 0; y < boardHeight; y++) {
//       for (let x = 0; x < boardWidth; x++) {
//         const index = y * boardWidth + x
//         if (grid[index] !== playerID) continue

//         for (const { dx, dy } of directions) {
//           const winningSquares = [index]
//           let nx = x + dx
//           let ny = y + dy
//           while (
//             nx >= 0 &&
//             nx < boardWidth &&
//             ny >= 0 &&
//             ny < boardHeight &&
//             grid[ny * boardWidth + nx] === playerID
//           ) {
//             winningSquares.push(ny * boardWidth + nx)
//             if (winningSquares.length >= 4) return winningSquares
//             nx += dx
//             ny += dy
//           }
//         }
//       }
//     }

//     return []
//   }
// }
