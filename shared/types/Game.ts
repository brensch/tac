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
  clashes: { [square: string]: { players: string[]; reason: string } } // Map of square indices to clash details
  winningSquares?: number[] // The list of squares involved in a winning condition
}

export interface GameState {
  sessionName: string
  sessionIndex: number
  playerIDs: string[] // List of player IDs in the game
  currentRound: number // Current turn or round number
  boardWidth: number // The width of the board, to easily work with 1D array
  winner: string
  started: boolean
  nextGame: string // New field for the ID of the next game
}

export interface PlayerInfo {
  id: string
  nickname: string
  emoji: string
}

// Function to initialize a new game without the board
const initializeGame = (sessionName: string): GameState => {
  return {
    sessionName: sessionName,
    sessionIndex: 0,
    playerIDs: [],
    currentRound: 0, // Start from 0 since no turns have occurred yet
    boardWidth: 8,
    winner: "",
    started: false,
    nextGame: "",
  }
}

export { initializeGame }
