// @shared/types/Game.ts

import * as admin from "firebase-admin"

// Define the Square interface with the required fields
export interface Square {
  playerID: string | null // The ID of the player occupying the square, null if empty
  food: boolean
  wall: boolean
  bodyPosition: number[]
  allowedPlayers: string[] // List of player IDs who can move into this square on the next turn
}

// Define the Winner interface
export interface Winner {
  playerID: string
  score: number
  winningSquares: number[]
}

// Updated Move interface remains the same
export interface Move {
  gameID: string
  moveNumber: number // The turn number
  playerID: string
  move: number // The index of the square the player wants to move into
  timestamp: admin.firestore.Timestamp // Server timestamp when the move was submitted
}

// Updated Turn interface using the Square type for the board
export interface Turn {
  turnNumber: number
  board: Square[] // The board state after this turn, represented as an array of Square objects
  boardWidth: number
  gameType: string
  playerIDs: string[] // This is to avoid a lookup of game for every move server-side
  playerHealth: number[]
  hasMoved: {
    [playerID: string]: { moveTime: admin.firestore.Timestamp }
  } // Map of playerID to moveTime
  clashes: { [square: string]: { players: string[]; reason: string } } // Map of square indices to clash details
  turnTime: number
  startTime: admin.firestore.Timestamp // When the turn started
  endTime: admin.firestore.Timestamp // When the turn ended
}

export type GameType = "connect4" | "longboi" | "tactictoes" | "snek"

// Updated GameState interface with the new 'winner' structure
export interface GameState {
  sessionName: string
  sessionIndex: number
  gameType: GameType
  playerIDs: string[] // List of player IDs in the game
  boardWidth: number // The width of the board, to easily work with 1D array
  winners: Winner[] // Updated to an array of winner objects
  started: boolean
  nextGame: string // New field for the ID of the next game
  maxTurnTime: number // Time limit per turn in seconds

  playersReady: string[]
  firstPlayerReadyTime?: admin.firestore.Timestamp
}

export interface PlayerInfo {
  id: string
  nickname: string
  emoji: string
}

// Function to initialize a new game
const initializeGame = (
  sessionName: string,
  boardWidth: number = 8,
): GameState => {
  return {
    sessionName: sessionName,
    gameType: "connect4",
    sessionIndex: 0,
    playerIDs: [],
    playersReady: [],
    boardWidth: boardWidth,
    winners: [], // Initialize as empty array
    started: false,
    nextGame: "",
    maxTurnTime: 10, // Default time limit per turn in seconds
  }
}

export { initializeGame }
