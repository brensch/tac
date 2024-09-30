// // functions/src/gameprocessors/TacticToesProcessor.ts

// import { GameProcessor } from "./GameProcessor"
// import { Winner, Turn, Move, GameState } from "@shared/types/Game"
// import { logger } from "../logger"
// import * as admin from "firebase-admin"
// import { Transaction } from "firebase-admin/firestore"

// /**
//  * Processor class for the TacticToes game logic.
//  */
// export class TacticToesProcessor extends GameProcessor {
//   constructor(
//     transaction: Transaction,
//     gameID: string,
//     latestMoves: Move[],
//     currentTurn?: Turn,
//   ) {
//     super(transaction, gameID, latestMoves, currentTurn)
//   }

//   /**
//    * Initializes the TacticToes game by setting up the initial turn.
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
//         `TacticToes: Turn 1 created and game ${this.gameID} has started.`,
//       )
//     } catch (error) {
//       logger.error(`TacticToes: Error initializing game ${this.gameID}:`, error)
//       throw error
//     }
//   }

//   /**
//    * Initializes the first turn for TacticToes.
//    * @param gameState The current state of the game.
//    * @returns The initial Turn object.
//    */
//   private initializeTurn(gameState: GameState): Turn {
//     const { boardWidth, boardHeight, playerIDs } = gameState
//     const now = Date.now()

//     // Initialize claimed positions
//     const claimedPositions: { [position: number]: string } = {}

//     // Initialize snakes as occupied positions for each player
//     const snakes: { [playerID: string]: number[] } = {}
//     playerIDs.forEach((playerID) => {
//       snakes[playerID] = []
//     })

//     // Initialize allowed moves (all empty positions)
//     const allowedMoves = this.calculateAllowedMoves(
//       claimedPositions,
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
//       playerHealth: {}, // Not applicable in TacticToes
//       hasMoved: {},
//       turnTime: gameState.maxTurnTime,
//       startTime: Timestamp.fromMillis(now),
//       endTime: Timestamp.fromMillis(
//         now + gameState.maxTurnTime * 1000,
//       ),
//       scores: {}, // Not applicable at the start
//       alivePlayers: [...playerIDs],
//       claimedPositions: claimedPositions,
//       allowedMoves: allowedMoves,
//       walls: [], // No walls in TacticToes
//       playerPieces: snakes, // Players' occupied positions
//       food: [], // No food in TacticToes
//       hazards: [], // No hazards in TacticToes
//     }

//     return firstTurn
//   }

//   /**
//    * Calculates allowed moves for each player (empty positions).
//    */
//   private calculateAllowedMoves(
//     claimedPositions: { [position: number]: string },
//     boardWidth: number,
//     boardHeight: number,
//     playerIDs: string[],
//   ): { [playerID: string]: number[] } {
//     const totalCells = boardWidth * boardHeight
//     const occupiedPositions = new Set<number>()
//     Object.keys(claimedPositions).forEach((posStr) => {
//       occupiedPositions.add(parseInt(posStr))
//     })

//     const freePositions: number[] = []
//     for (let i = 0; i < totalCells; i++) {
//       if (!occupiedPositions.has(i)) {
//         freePositions.push(i)
//       }
//     }

//     // All players have the same allowed moves in TacticToes
//     const allowedMoves: { [playerID: string]: number[] } = {}
//     playerIDs.forEach((playerID) => {
//       allowedMoves[playerID] = [...freePositions]
//     })

//     return allowedMoves
//   }

//   /**
//    * Applies the latest moves to the TacticToes game.
//    */
//   async applyMoves(): Promise<void> {
//     if (!this.currentTurn) return
//     try {
//       const {
//         claimedPositions,
//         boardWidth,
//         boardHeight,
//         playerPieces: snakes,
//       } = this.currentTurn

//       // Deep copy claimedPositions and snakes
//       const newClaimedPositions = { ...claimedPositions }
//       const newSnakes = { ...snakes }
//       Object.keys(newSnakes).forEach((playerID) => {
//         newSnakes[playerID] = [...newSnakes[playerID]]
//       })

//       // Process latest moves
//       this.latestMoves.forEach((move) => {
//         const { playerID, move: position } = move

//         // Validate move
//         if (newClaimedPositions[position]) {
//           logger.warn(
//             `TacticToes: Invalid move by ${playerID} to position ${position}. Already claimed.`,
//           )
//           return
//         }

//         // Check if position is within the board
//         if (position < 0 || position >= boardWidth * boardHeight) {
//           logger.warn(
//             `TacticToes: Invalid move by ${playerID} to position ${position}. Out of bounds.`,
//           )
//           return
//         }

//         // Claim the position
//         newClaimedPositions[position] = playerID

//         // Update the player's occupied positions in snakes
//         newSnakes[playerID].push(position)
//       })

//       // Update allowed moves
//       const newAllowedMoves = this.calculateAllowedMoves(
//         newClaimedPositions,
//         boardWidth,
//         boardHeight,
//         this.currentTurn.playerIDs,
//       )

//       // Update the current turn
//       this.currentTurn.claimedPositions = newClaimedPositions
//       this.currentTurn.allowedMoves = newAllowedMoves
//       this.currentTurn.playerPieces = newSnakes
//     } catch (error) {
//       logger.error(
//         `TacticToes: Error applying moves for game ${this.gameID}:`,
//         error,
//       )
//       throw error
//     }
//   }

//   /**
//    * Finds winners based on the current state of the board.
//    * @returns An array of Winner objects.
//    */
//   async findWinners(): Promise<Winner[]> {
//     if (!this.currentTurn) return []
//     try {
//       const { claimedPositions, boardWidth, boardHeight, playerIDs } =
//         this.currentTurn

//       // Implement game-specific logic to determine a winner
//       // For TacticToes, let's assume a player wins by occupying all positions in a row, column, or diagonal.

//       // Example winning conditions (rows, columns, diagonals)
//       const lines = this.getWinningLines(boardWidth, boardHeight)

//       for (const playerID of playerIDs) {
//         for (const line of lines) {
//           if (line.every((pos) => claimedPositions![pos] === playerID)) {
//             // Player has won
//             const winner: Winner = {
//               playerID,
//               score: 1,
//               winningSquares: line,
//             }
//             logger.info(`TacticToes: Player ${playerID} has won the game.`)
//             return [winner]
//           }
//         }
//       }

//       // Check for draw (no more moves)
//       const totalCells = boardWidth * boardHeight
//       if (Object.keys(claimedPositions!).length >= totalCells) {
//         logger.info(`TacticToes: Game ended in a draw.`)
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
//         `TacticToes: Error finding winners for game ${this.gameID}:`,
//         error,
//       )
//       throw error
//     }
//   }

//   /**
//    * Helper method to get all winning lines (rows, columns, diagonals).
//    */
//   private getWinningLines(boardWidth: number, boardHeight: number): number[][] {
//     const lines: number[][] = []

//     // Rows
//     for (let y = 0; y < boardHeight; y++) {
//       const row: number[] = []
//       for (let x = 0; x < boardWidth; x++) {
//         row.push(y * boardWidth + x)
//       }
//       lines.push(row)
//     }

//     // Columns
//     for (let x = 0; x < boardWidth; x++) {
//       const column: number[] = []
//       for (let y = 0; y < boardHeight; y++) {
//         column.push(y * boardWidth + x)
//       }
//       lines.push(column)
//     }

//     // Diagonals (if square board)
//     if (boardWidth === boardHeight) {
//       const diag1: number[] = []
//       const diag2: number[] = []
//       for (let i = 0; i < boardWidth; i++) {
//         diag1.push(i * boardWidth + i)
//         diag2.push(i * boardWidth + (boardWidth - i - 1))
//       }
//       lines.push(diag1)
//       lines.push(diag2)
//     }

//     return lines
//   }
// }
