// @shared/types/Game.ts

import { FieldValue, Timestamp } from "firebase-admin/firestore"

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
  timestamp: FieldValue | Timestamp // Server timestamp when the move was submitted
}

export type GameType = "connect4" | "longboi" | "tactictoes" | "snek"

// Updated GameState interface with the new 'winner' structure
export interface GameState {
  sessionName: string
  sessionIndex: number
  gameType: GameType
  gamePlayers: GamePlayer[]
  boardWidth: number // The width of the board
  boardHeight: number // The height of the board
  winners: Winner[] // Updated to an array of winner objects
  started: boolean
  nextGame: string // New field for the ID of the next game
  maxTurnTime: number // Time limit per turn in seconds
  playersReady: string[]
  startRequested: boolean
  timeCreated: Timestamp | FieldValue
}

export interface GamePlayer {
  id: string
  type: "bot" | "human"
}

export interface Player {
  id: string
  name: string
  emoji: string
  colour: string
  createdAt: Timestamp | FieldValue
}

export interface Human extends Player {
  email?: string
}

export interface Bot extends Player {
  owner: string
  url: string
  capabilities: GameType[]
}

// Updated Turn interface to include 'allowedMoves', 'walls', and 'clashes'
export interface Turn {
  turnNumber: number
  boardWidth: number
  boardHeight: number
  gameType: GameType
  players: GamePlayer[] // This is to avoid a lookup of game for every move server-side
  playerHealth: { [playerID: string]: number } // Map of playerID to health
  hasMoved: {
    [playerID: string]: { moveTime: Timestamp | FieldValue }
  } // Map of playerID to moveTime
  turnTime: number
  startTime: Timestamp | FieldValue // When the turn started
  endTime: Timestamp | FieldValue // When the turn ended
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
  gameOver: boolean
  moves: { [playerID: string]: number }
}

export interface Clash {
  index: number
  playerIDs: string[]
  reason: string
}
