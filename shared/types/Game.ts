// @shared/types/Game.ts

import { Timestamp } from "firebase-admin/firestore"

// Define the Winner interface
export interface Winner {
  playerID: string
  score: number
  winningSquares: number[]
}

// Move interface
export interface Move {
  gameID: string
  moveNumber: number // The turn number
  playerID: string
  move: number // The index of the square the player wants to move into
  timestamp: Timestamp // Server timestamp when the move was submitted
}

export type GameType = "connect4" | "longboi" | "tactictoes" | "snek"

// Updated GameState interface with the new 'winner' structure
export interface GameState {
  sessionName: string
  sessionIndex: number
  gameType: GameType
  playerIDs: string[] // List of player IDs in the game
  boardWidth: number // The width of the board
  boardHeight: number // The height of the board
  winners: Winner[] // Updated to an array of winner objects
  started: boolean
  nextGame: string // New field for the ID of the next game
  maxTurnTime: number // Time limit per turn in seconds

  playersReady: string[]
  firstPlayerReadyTime: Timestamp | null
}

export interface PlayerInfo {
  id: string
  nickname: string
  emoji: string
  colour: string
}

// Updated Turn interface to include 'allowedMoves', 'walls', and 'clashes'
export interface Turn {
  turnNumber: number
  boardWidth: number
  boardHeight: number
  gameType: GameType
  playerIDs: string[] // This is to avoid a lookup of game for every move server-side
  playerHealth: { [playerID: string]: number } // Map of playerID to health
  hasMoved: {
    [playerID: string]: { moveTime: Timestamp }
  } // Map of playerID to moveTime
  turnTime: number
  startTime: Timestamp // When the turn started
  endTime: Timestamp // When the turn ended
  scores: { [playerID: string]: number } // Map of playerID to score
  alivePlayers: string[] // List of player IDs who are still alive

  // New fields
  food: number[] // Positions of food on the board
  hazards: number[] // Positions of hazards on the board
  playerPieces: {
    [playerID: string]: number[] // Map of playerID to array of positions
  } // Each snake is represented by a map entry
  allowedMoves: { [playerID: string]: number[] } // Map of playerID to allowed move indexes
  walls: number[] // Positions of walls on the board

  // Clashes
  clashes: Clash[] // Map of playerID to positions of their dead snake
}

export interface Clash {
  index: number
  playerIDs: number[]
  reason: string
}

// Function to initialize a new game
export const initializeGame = (
  sessionName: string,
  boardWidth: number = 8,
  boardHeight: number = 8,
): GameState => {
  return {
    sessionName: sessionName,
    gameType: "snek",
    sessionIndex: 0,
    playerIDs: [],
    playersReady: [],
    boardWidth: boardWidth,
    boardHeight: boardHeight,
    winners: [], // Initialize as empty array
    started: false,
    nextGame: "",
    maxTurnTime: 10, // Default time limit per turn in seconds
    firstPlayerReadyTime: null,
  }
}
