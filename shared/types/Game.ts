export interface Player {
  id: string // User ID of the player
  hasMoved: boolean // Whether the player has moved
}

// Interface for the game state with a flattened board
export interface GameState {
  board: string[] // Flattened 1D array representing the tic-tac-toe board
  boardWidth: number // The width of the board, to easily work with 1D array
  playerIDs: string[] // List of player IDs in the game
  currentRound: number // Current turn or round number
  gameID: string // Unique identifier for the game
  started: boolean // Whether the game has started
  hasMoved: string[] // List of player IDs who have submitted their move for this round
}

export interface Move {
  gameID: string
  moveNumber: number
  playerID: string
  move: number // Position on the board
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

// Function to initialize a new game with a flattened board
const initializeGame = (playerID: string): GameState => {
  const boardSize = 4 * 4 // For a 4x4 game
  const initialBoard = Array(boardSize).fill("") // Flattened board

  return {
    board: initialBoard,
    boardWidth: 4, // Store the board width for later reference
    playerIDs: [playerID],
    currentRound: 1,
    gameID: generateShortID(),
    started: false,
    hasMoved: [],
  }
}

export { initializeGame }
