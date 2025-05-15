// @shared/types/Game.ts

import { FieldValue, Timestamp } from "firebase-admin/firestore"

// Define the Winner interface
export interface Winner {
  playerID: string
  score: number
  winningSquares: number[]
  mmrChange?: number // Added mmrChange to include resulting MMR for the game
  newMMR?: number    // Added newMMR to include the player's new MMR
}

// Move interface
export interface Move {
  gameID: string
  moveNumber: number // The turn number
  playerID: string
  move: number // The index of the square the player wants to move into
  timestamp: FieldValue | Timestamp // Server timestamp when the move was submitted
}

// Public interface for move statuses
export interface MoveStatus {
  moveNumber: number
  alivePlayerIDs: string[]
  movedPlayerIDs: string[]
}

export type GameType =
  | "connect4"
  | "longboi"
  | "tactictoes"
  | "snek"
  | "colourclash"
  | "reversi"

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
  started: boolean // Set true when GameState is created to avoid double handling
  timeCreated: Timestamp | FieldValue
}

// Updated GameState interface with the new 'winners' structure
export interface GameState {
  setup: GameSetup
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
  public: boolean
}

export interface Turn {
  playerHealth: { [playerID: string]: number } // Map of playerID to health
  startTime: Timestamp // When the turn started
  endTime: Timestamp // When the turn should end
  scores: { [playerID: string]: number } // Map of playerID to score
  alivePlayers: string[] // List of player IDs who are still alive
  food: number[] // Positions of food on the board
  hazards: number[] // Positions of hazards on the board
  playerPieces: { [playerID: string]: number[] } // Each snake is represented by a map entry
  allowedMoves: { [playerID: string]: number[] } // Map of playerID to allowed move indexes
  walls: number[] // Positions of walls on the board
  clashes: Clash[] // Array of clashes
  moves: { [playerID: string]: number }
  winners: Winner[] // Updated to an array of winner objects
}

export interface Clash {
  index: number
  playerIDs: string[]
  reason: string
}

export interface GameResult {
  sessionID: string
  gameID: string
  timestamp: Timestamp
  previousMMR: number
  mmrChange: number
  placement: number
  opponents: OpponentInfo[]
}

export interface Ranking {
  playerID: string // ID of the player (user ID or bot ID)
  type: "human" | "bot" // Type of player
  rankings: { [gameType: string]: GameRanking } // Map of gameType to GameRanking
  lastUpdated: Timestamp | FieldValue
}

export interface GameRanking {
  currentMMR: number
  gamesPlayed: number
  wins: number
  losses: number
  gameHistory: GameResult[]
  lastUpdated: Timestamp | FieldValue
}

export interface OpponentInfo {
  playerID: string
  mmr: number
  placement: number
}
