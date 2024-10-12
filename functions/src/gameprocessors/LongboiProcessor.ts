// import { GameProcessor } from "./GameProcessor"
// import { Winner, Turn, Move, GameState, Clash } from "@shared/types/Game"
// import { logger } from "../logger"
// import * as admin from "firebase-admin"
// import { Transaction } from "firebase-admin/firestore"
// import { Timestamp } from "firebase-admin/firestore"
// import { FirstMoveTimeoutSeconds } from "../timings"

// /**
//  * Processor class for Longboi game logic.
//  */
// export class LongboiProcessor extends GameProcessor {
//   constructor(
//     transaction: Transaction,
//     gameID: string,
//     latestMoves: Move[],
//     currentTurn?: Turn,
//   ) {
//     super(transaction, gameID, latestMoves, currentTurn)
//   }

//   /**
//    * Initializes the Longboi game by setting up the initial turn.
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
//         `Longboi: Turn 1 created and game ${this.gameID} has started.`,
//       )
//     } catch (error) {
//       logger.error(`Longboi: Error initializing game ${this.gameID}:`, error)
//       throw error
//     }
//   }

//   /**
//    * Initializes the first turn for Longboi.
//    * @param gameState The current state of the game.
//    * @returns The initial Turn object.
//    */
//   private initializeTurn(gameState: GameState): Turn {
//     const { boardWidth, boardHeight, gamePlayers } = gameState
//     const now = Date.now()

//     // Initialize playerPieces as occupied positions for each player
//     const playerPieces: { [playerID: string]: number[] } = {}
//     gamePlayers.forEach((player) => {
//       playerPieces[player.id] = []
//     })

//     // Initialize allowed moves (all positions on the board)
//     const totalCells = boardWidth * boardHeight
//     const allPositions = Array.from({ length: totalCells }, (_, index) => index)
//     const allowedMoves: { [playerID: string]: number[] } = {}
//     gamePlayers.forEach((player) => {
//       allowedMoves[player.id] = [...allPositions]
//     })

//     const firstTurn: Turn = {
//       turnNumber: 1,
//       boardWidth: boardWidth,
//       boardHeight: boardHeight,
//       gameType: gameState.gameType,
//       players: gamePlayers, // Use gamePlayers instead of playerIDs
//       playerHealth: {}, // Not used in Longboi
//       hasMoved: {},
//       turnTime: gameState.maxTurnTime,
//       startTime: Timestamp.fromMillis(now),
//       endTime: Timestamp.fromMillis(now + FirstMoveTimeoutSeconds * 1000),
//       scores: {}, // Initialize scores as empty map
//       alivePlayers: gamePlayers.map((player) => player.id), // All players are alive

//       // New fields
//       food: [], // Not used in Longboi
//       hazards: [], // Not used in Longboi
//       playerPieces: playerPieces, // Players' occupied positions
//       allowedMoves: allowedMoves,
//       walls: [], // No walls in Longboi
//       clashes: [], // Initialize empty array for clashes
//       gameOver: false,
//       moves: {},
//     }

//     return firstTurn
//   }

//   /**
//    * Applies the latest moves to the Longboi game and updates scores.
//    */
//   async applyMoves(): Promise<void> {
//     if (!this.currentTurn) return
//     try {
//       const { players, boardWidth, boardHeight, playerPieces, allowedMoves } =
//         this.currentTurn

//       // Deep copy playerPieces
//       const newPlayerPieces: { [playerID: string]: number[] } = {}
//       Object.keys(playerPieces).forEach((playerID) => {
//         newPlayerPieces[playerID] = [...playerPieces[playerID]]
//       })

//       // Map to keep track of moves to positions
//       const moveMap: { [position: number]: string[] } = {}

//       // Clashes array
//       const clashes: Clash[] = this.currentTurn.clashes
//         ? [...this.currentTurn.clashes]
//         : []

//       // Process latest moves
//       this.latestMoves.forEach((move) => {
//         const position = move.move
//         const playerID = move.playerID

//         // Check if position is allowed for the player
//         if (!allowedMoves[playerID]?.includes(position)) {
//           logger.warn(
//             `Longboi: Invalid move by player ${playerID} to position ${position}. Move ignored.`,
//           )
//           return
//         }

//         if (!moveMap[position]) {
//           moveMap[position] = []
//         }
//         moveMap[position].push(playerID)
//       })

//       // Process moves and handle clashes
//       for (const positionStr in moveMap) {
//         const position = parseInt(positionStr)
//         const playersAtPosition = moveMap[position]

//         if (playersAtPosition.length === 1) {
//           // Valid move
//           const playerID = playersAtPosition[0]
//           newPlayerPieces[playerID].push(position)
//           logger.info(
//             `Longboi: Position ${position} claimed by player ${playerID}.`,
//           )
//         } else {
//           // Clash: Multiple players attempted to claim the same position
//           logger.warn(
//             `Longboi: Clash at position ${position} by players ${playersAtPosition.join(
//               ", ",
//             )}.`,
//           )
//           // Record the clash
//           clashes.push({
//             index: position,
//             playerIDs: playersAtPosition,
//             reason: "Multiple players attempted to claim the same position",
//           })
//         }
//       }

//       // Update allowed moves (exclude claimed positions and clashes)
//       const totalCells = boardWidth * boardHeight
//       const allPositions = Array.from(
//         { length: totalCells },
//         (_, index) => index,
//       )
//       const claimedPositions = new Set<number>()
//       Object.values(newPlayerPieces).forEach((positions) => {
//         positions.forEach((pos) => claimedPositions.add(pos))
//       })
//       clashes.forEach((clash) => {
//         claimedPositions.add(clash.index)
//       })

//       const newAllowedMoves: { [playerID: string]: number[] } = {}
//       players.forEach((player) => {
//         newAllowedMoves[player.id] = allPositions.filter(
//           (pos) => !claimedPositions.has(pos),
//         )
//       })

//       // Update the current turn
//       this.currentTurn.playerPieces = newPlayerPieces
//       this.currentTurn.allowedMoves = newAllowedMoves
//       this.currentTurn.clashes = clashes

//       // Calculate scores after moves have been applied
//       this.updateScores()
//     } catch (error) {
//       logger.error(
//         `Longboi: Error applying moves for game ${this.gameID}:`,
//         error,
//       )
//       throw error
//     }
//   }

//   /**
//    * Updates the scores for all players based on the current board state.
//    */
//   private updateScores(): void {
//     const { boardWidth, boardHeight, players, playerPieces } = this.currentTurn!
//     const scores: { [playerID: string]: number } = {}

//     for (const player of players) {
//       const result = this.calculateLongestPath(
//         playerPieces[player.id],
//         boardWidth,
//         boardHeight,
//       )
//       scores[player.id] = result.length
//     }

//     this.currentTurn!.scores = scores
//   }

//   /**
//    * Finds winners based on the updated Longboi game.
//    * @returns An array of Winner objects.
//    */
//   async findWinners(): Promise<Winner[]> {
//     if (!this.currentTurn) return []
//     try {
//       const { boardWidth, boardHeight, players, playerPieces } =
//         this.currentTurn
//       const totalPositions = boardWidth * boardHeight

//       // Check if all positions are claimed or no one moved
//       const claimedPositionsCount =
//         Object.values(playerPieces).reduce(
//           (sum, positions) => sum + positions.length,
//           0,
//         ) + (this.currentTurn.clashes?.length || 0)

//       const isBoardFull = claimedPositionsCount >= totalPositions

//       // If no one moved, also end the game
//       if (!isBoardFull && this.latestMoves.length !== 0) {
//         // Game continues
//         return []
//       }

//       // Calculate longest paths for each player
//       const longestPaths: {
//         [playerID: string]: { length: number; path: number[] }
//       } = {}

//       let maxLength = 0

//       for (const player of players) {
//         const result = this.calculateLongestPath(
//           playerPieces[player.id],
//           boardWidth,
//           boardHeight,
//         )
//         longestPaths[player.id] = result
//         if (result.length > maxLength) {
//           maxLength = result.length
//         }
//       }

//       // Determine the player(s) with the longest path
//       const potentialWinners: string[] = []

//       for (const player of players) {
//         if (longestPaths[player.id].length === maxLength && maxLength > 0) {
//           potentialWinners.push(player.id)
//         }
//       }

//       if (potentialWinners.length === 1) {
//         const winnerID = potentialWinners[0]
//         const winningSquares = longestPaths[winnerID].path
//         const winner: Winner = {
//           playerID: winnerID,
//           score: maxLength,
//           winningSquares: winningSquares,
//         }
//         logger.info(
//           `Longboi: Player ${winnerID} has won the game with a longest path of ${maxLength}.`,
//         )
//         return [winner]
//       } else if (potentialWinners.length > 1) {
//         // Tie among players with the same longest path length
//         logger.info(
//           `Longboi: Game ended in a tie among players: ${potentialWinners.join(
//             ", ",
//           )}.`,
//         )
//         return potentialWinners.map((playerID) => ({
//           playerID,
//           score: longestPaths[playerID].length,
//           winningSquares: longestPaths[playerID].path,
//         }))
//       } else {
//         // No winner
//         logger.info(`Longboi: Game ended with no winner.`)
//         return []
//       }
//     } catch (error) {
//       logger.error(
//         `Longboi: Error finding winners for game ${this.gameID}:`,
//         error,
//       )
//       throw error
//     }
//   }

//   /**
//    * Calculates the longest single path (no branches) for a player.
//    * @param positions The positions claimed by the player.
//    * @param boardWidth The width of the board.
//    * @param boardHeight The height of the board.
//    * @returns An object containing the length and the path.
//    */
//   private calculateLongestPath(
//     positions: number[],
//     boardWidth: number,
//     boardHeight: number,
//   ): { length: number; path: number[] } {
//     if (positions.length === 0) return { length: 0, path: [] }

//     // Convert positions to a set for faster lookup
//     const positionSet = new Set(positions)

//     let maxLength = 0
//     let longestPath: number[] = []

//     // For each position, perform DFS to find the longest path
//     for (const startPos of positions) {
//       const visited = new Set<number>()
//       const stack: { pos: number; path: number[] }[] = []
//       stack.push({ pos: startPos, path: [startPos] })

//       while (stack.length > 0) {
//         const { pos, path } = stack.pop()!

//         if (path.length > maxLength) {
//           maxLength = path.length
//           longestPath = [...path]
//         }

//         visited.add(pos)

//         const neighbors = this.getNeighborPositions(
//           pos,
//           boardWidth,
//           boardHeight,
//         )

//         for (const neighbor of neighbors) {
//           if (
//             positionSet.has(neighbor) &&
//             !path.includes(neighbor) // prevent cycles
//           ) {
//             stack.push({ pos: neighbor, path: [...path, neighbor] })
//           }
//         }
//       }
//     }

//     return { length: maxLength, path: longestPath }
//   }

//   /**
//    * Get the neighboring positions (up, down, left, right) of a given position.
//    */
//   private getNeighborPositions(
//     pos: number,
//     boardWidth: number,
//     boardHeight: number,
//   ): number[] {
//     const x = pos % boardWidth
//     const y = Math.floor(pos / boardWidth)

//     const neighbors: number[] = []

//     // Up
//     if (y > 0) {
//       neighbors.push((y - 1) * boardWidth + x)
//     }
//     // Down
//     if (y < boardHeight - 1) {
//       neighbors.push((y + 1) * boardWidth + x)
//     }
//     // Left
//     if (x > 0) {
//       neighbors.push(y * boardWidth + (x - 1))
//     }
//     // Right
//     if (x < boardWidth - 1) {
//       neighbors.push(y * boardWidth + (x + 1))
//     }

//     return neighbors
//   }
// }
