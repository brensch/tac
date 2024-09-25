// @shared/types/Game.ts

import * as admin from "firebase-admin"

export interface Move {
  gameID: string
  moveNumber: number // The turn number
  playerID: string
  move: number // The index of the square the player wants to move into
  timestamp: admin.firestore.Timestamp // Server timestamp when the move was submitted
}

export interface Turn {
  turnNumber: number
  board: string[] // The board state after this turn
  playerIDs: string[] // this is to avoid a lookup of game for every move serverside
  hasMoved: {
    [playerID: string]: { moveTime: admin.firestore.Timestamp }
  } // Map of playerID to moveTime
  clashes: { [square: string]: { players: string[]; reason: string } } // Map of square indices to clash details
  winningSquares?: number[] // The list of squares involved in a winning condition
  startTime: admin.firestore.Timestamp // When the turn started
  turnTimeLimitSeconds: number
  latestTurn: boolean // ensures if an old move comes in on the last player's move that we don't create two new turns
}

export interface GameState {
  sessionName: string
  sessionIndex: number
  gameType: string
  playerIDs: string[] // List of player IDs in the game
  boardWidth: number // The width of the board, to easily work with 1D array
  winner: string
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

// Function to initialize a new game without the board
const initializeGame = (sessionName: string): GameState => {
  return {
    sessionName: sessionName,
    gameType: "connect4",
    sessionIndex: 0,
    playerIDs: [],
    playersReady: [],
    boardWidth: 8,
    winner: "",
    started: false,
    nextGame: "",
    maxTurnTime: 10, // Default time limit per turn in seconds
  }
}

export { initializeGame }
