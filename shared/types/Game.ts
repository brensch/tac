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

// this is public so that users can see who has moved and to reduce reads of who has completed their move
// needs to get created when turn is created.
// clients should write their own id to this
export interface MoveStatus {
  moveNumber: number
  alivePlayerIDs: string[]
  movedPlayerIDs: string[]
}

export type GameType = "connect4" | "longboi" | "tactictoes" | "snek"

export interface Session {
  latestGameID: string | null

  timeCreated: Timestamp | FieldValue
}

export interface GameSetup {
  gameType: GameType
  gamePlayers: GamePlayer[]
  boardWidth: number // The width of the board
  boardHeight: number // The height of the board
  playersReady: string[]
  maxTurnTime: number // Time limit per turn in seconds
  startRequested: boolean
  started: boolean //set true when gamestate created to avoid double handling

  timeCreated: Timestamp | FieldValue
}

// Updated GameState interface with the new 'winner' structure
export interface GameState {
  setup: GameSetup
  winners: Winner[] // Updated to an array of winner objects
  turns: Turn[]

  timeCreated: Timestamp | FieldValue
  timeFinished: Timestamp | FieldValue | null
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
  playerHealth: { [playerID: string]: number } // Map of playerID to health
  startTime: Timestamp // When the turn started
  endTime: Timestamp // When the turn should end
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
  moves: { [playerID: string]: number }
}

export interface Clash {
  index: number
  playerIDs: string[]
  reason: string
}
