// @shared/types/Game.ts

export interface Move {
  gameID: string
  moveNumber: number // The turn number
  playerID: string
  move: number // The index of the square the player wants to move into
}

export interface Turn {
  turnNumber: number
  board: string[] // The board state after this turn
  hasMoved: string[] // List of player IDs who have submitted their move for this turn
  lockedSquares: number[] // Squares that are locked in this turn
  clashes: { [square: number]: string[] } // Map of square indices to player IDs who clashed
}

export interface GameState {
  gameID: string // Unique identifier for the game
  playerIDs: string[] // List of player IDs in the game
  currentRound: number // Current turn or round number
  boardWidth: number // The width of the board, to easily work with 1D array
  winner: string
}

export interface PlayerInfo {
  id: string
  nickname: string
  emoji: string
}

// Utility function to generate a 4-character lowercase string and number combo
const generateShortID = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

// Function to initialize a new game without the board
const initializeGame = (playerID: string): GameState => {
  return {
    gameID: generateShortID(),
    playerIDs: [playerID],
    currentRound: 0, // Start from 0 since no turns have occurred yet
    boardWidth: 8,
    winner: "",
  }
}

export { initializeGame }
