import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { GameState, Turn, Move } from "./types/Game" // Adjust the import path as necessary

export async function processTurn(
  transaction: FirebaseFirestore.Transaction,
  gameID: string,
  currentTurn: Turn,
) {
  const currentRound = currentTurn.turnNumber

  // Fetch moves for the current round within the transaction
  const movesRef = admin.firestore().collection(`games/${gameID}/privateMoves`)
  const movesSnapshot = await transaction.get(
    movesRef.where("moveNumber", "==", currentRound),
  )

  const movesThisRound = movesSnapshot.docs.map((doc) => doc.data() as Move)

  // Log moves received in this round
  logger.info(`Moves received in round ${currentRound}`, {
    movesThisRound,
  })

  // If no one moved, set winner to -1 (nobody won)
  if (movesThisRound.length === 0) {
    await createNewGame(transaction, gameID, "-1")
    logger.info("No moves this round. Winner set to -1", { gameID })
    return
  }

  // Process only the latest move for each player
  const latestMoves = movesThisRound
    .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()) // Sort moves by timestamp, newest first
    .reduce((acc, move) => {
      if (!acc.find((m) => m.playerID === move.playerID)) {
        acc.push(move) // Add only the latest move for each player
      }
      return acc
    }, [] as Move[])

  // Log filtered moves
  logger.info(`Latest moves for round ${currentRound}`, { latestMoves })

  // Process moves and update the board
  const newBoard = [...currentTurn.board]
  const clashes = { ...currentTurn.clashes }

  // Build a map of moves per square
  const moveMap: { [square: number]: string[] } = {}

  latestMoves.forEach((move) => {
    if (currentTurn.board[move.move] === "-1") {
      logger.info(`Square ${move.move} is blocked, move ignored`, { move })
      return // Ignore this move
    }

    if (moveMap[move.move]) {
      moveMap[move.move].push(move.playerID)
    } else {
      moveMap[move.move] = [move.playerID]
    }
  })

  // Apply moves to the board
  for (const squareStr in moveMap) {
    const square = parseInt(squareStr)
    const players = moveMap[square]

    if (players.length === 1) {
      const playerID = players[0]
      newBoard[square] = playerID
      logger.info(`Square ${square} captured by player ${playerID}`)
    } else if (players.length > 1) {
      newBoard[square] = "-1"
      clashes[square] = {
        players,
        reason: "Multiple players picked this square",
      }
      logger.info(`Square ${square} is blocked permanently due to conflict`, {
        players,
      })
    }
  }

  // Fetch the existing game data
  const gameRef = admin.firestore().collection("games").doc(gameID)
  const gameDoc = await transaction.get(gameRef)

  if (!gameDoc.exists) {
    logger.error("Game not found for creating a new game.", { gameID })
    return
  }

  const gameData = gameDoc.data() as GameState

  // Check for a winner
  const winLength = 4
  const playerIDs = currentTurn.playerIDs

  let winningPlayers: {
    playerID: string
    winningSquares: number[]
  }[]

  if (gameData.gameType === "connect4") {
    winningPlayers = checkWinConditionConnect4(
      newBoard,
      gameData.boardWidth,
      winLength,
      playerIDs,
    )
  } else {
    winningPlayers = checkWinConditionLongboi(
      newBoard,
      gameData.boardWidth,
      winLength,
      playerIDs,
    )
  }

  logger.info("Winning players", { winningPlayers })

  let winningSquares: number[] = []

  if (winningPlayers.length === 1) {
    const winnerID = winningPlayers[0].playerID
    winningSquares = winningPlayers[0].winningSquares
    await createNewGame(transaction, gameID, winnerID)
    logger.info(`Player ${winnerID} has won the game!`, { gameID })
  } else if (winningPlayers.length > 1) {
    const winningPlayerSet = new Set(winningPlayers.map((wp) => wp.playerID))

    latestMoves.forEach((move) => {
      if (winningPlayerSet.has(move.playerID)) {
        const square = move.move
        newBoard[square] = "-1"
        if (!clashes[square]) {
          clashes[square] = {
            players: Array.from(winningPlayerSet),
            reason: "Multiple players won at the same time",
          }
        }
        logger.info(
          `Square ${square} blocked due to simultaneous win by player ${move.playerID}`,
        )
      }
    })

    logger.info(
      `Multiple players won simultaneously. Moves are treated as clashes and squares are blocked.`,
    )
  }

  // Create the next Turn document with the new board and empty hasMoved
  const nextRound = currentRound + 1
  const nextTurnRef = admin
    .firestore()
    .collection(`games/${gameID}/turns`)
    .doc(nextRound.toString())

  const now = Date.now()
  const nextTurn: Turn = {
    turnNumber: nextRound,
    board: newBoard,
    hasMoved: {},
    clashes: clashes,
    winningSquares: winningSquares,
    startTime: admin.firestore.Timestamp.fromMillis(now),
    endTime: admin.firestore.Timestamp.fromMillis(
      now + gameData.maxTurnTime * 1000,
    ),
    playerIDs: currentTurn.playerIDs,
  }

  transaction.set(nextTurnRef, nextTurn)

  logger.info(`Round ${currentRound} completed. Moved to round ${nextRound}`, {
    gameID,
  })
}

// Function to create a new game
async function createNewGame(
  transaction: FirebaseFirestore.Transaction,
  gameID: string,
  winnerID: string,
) {
  // Fetch the existing game data
  const gameRef = admin.firestore().collection("games").doc(gameID)
  const gameDoc = await transaction.get(gameRef)

  if (!gameDoc.exists) {
    logger.error("Game not found for creating a new game.", { gameID })
    return
  }

  const gameData = gameDoc.data() as GameState

  // if someone already cooked, abort
  if (gameData.winner !== "" || gameData.nextGame !== "") {
    logger.warn("new game already cooked.", { gameID })
    return
  }

  // Generate a new game
  const newGameData: GameState = {
    sessionName: gameData.sessionName,
    sessionIndex: gameData.sessionIndex + 1,
    gameType: gameData.gameType,
    playerIDs: [], // Reset for the next game
    playersReady: [],
    boardWidth: gameData.boardWidth,
    winner: "",
    started: false,
    nextGame: "",
    maxTurnTime: gameData.maxTurnTime,
  }

  const newGameRef = admin.firestore().collection("games").doc()

  // Update the current game with the winner and reference to the new game
  transaction.update(gameRef, {
    winner: winnerID,
    nextGame: newGameRef.id,
  })

  // Create the new game document
  transaction.create(newGameRef, newGameData)

  logger.info(
    `New game created with ID ${newGameRef.id} after round completion.`,
    {
      gameID,
      winnerID,
    },
  )
}

// Function to check for a win condition
function checkWinConditionConnect4(
  board: string[],
  boardWidth: number,
  winLength: number,
  playerIDs: string[],
): { playerID: string; winningSquares: number[] }[] {
  const winningPlayers: { playerID: string; winningSquares: number[] }[] = []

  playerIDs.forEach((playerID) => {
    const result = hasPlayerWon(board, boardWidth, winLength, playerID)
    if (result.hasWon) {
      winningPlayers.push({ playerID, winningSquares: result.winningSquares })
    }
  })

  return winningPlayers
}

// Helper function to check if a player has won
function hasPlayerWon(
  board: string[],
  boardWidth: number,
  winLength: number,
  playerID: string,
): { hasWon: boolean; winningSquares: number[] } {
  const size = boardWidth

  // Direction vectors: right, down, down-right, down-left
  const directions = [
    { x: 1, y: 0 }, // Horizontal
    { x: 0, y: 1 }, // Vertical
    { x: 1, y: 1 }, // Diagonal down-right
    { x: -1, y: 1 }, // Diagonal down-left
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const dir of directions) {
        let count = 0
        let winningSquares: number[] = []
        let dx = x
        let dy = y

        while (
          dx >= 0 &&
          dx < size &&
          dy >= 0 &&
          dy < size &&
          board[dy * size + dx] === playerID
        ) {
          winningSquares.push(dy * size + dx)
          count++
          if (count === winLength) {
            return { hasWon: true, winningSquares }
          }
          dx += dir.x
          dy += dir.y
        }
      }
    }
  }

  return { hasWon: false, winningSquares: [] }
}

// Function to check for a win condition based on the longest continuous connected path
export function checkWinConditionLongboi(
  board: string[],
  boardWidth: number,
  winLength: number,
  playerIDs: string[],
): { playerID: string; winningSquares: number[] }[] {
  // Ensure no player wins unless all squares are filled
  if (board.some((square) => square === "")) {
    return [] // No winner if there are empty squares
  }

  const longestPaths: { playerID: string; winningSquares: number[] }[] = []

  playerIDs.forEach((playerID) => {
    const result = findLongestConnectedPathForPlayer(
      board,
      boardWidth,
      playerID,
    )
    longestPaths.push({ playerID, winningSquares: result })
  })

  // Return the player(s) with the longest path
  const longestPathLength = Math.max(
    ...longestPaths.map((p) => p.winningSquares.length),
  )

  return longestPaths.filter(
    (p) => p.winningSquares.length === longestPathLength,
  )
}

// Helper function to find the longest connected path for a player
function findLongestConnectedPathForPlayer(
  board: string[],
  boardWidth: number,
  playerID: string,
): number[] {
  const size = boardWidth
  let longestPath: number[] = []
  const visited: Set<number> = new Set()

  // Direction vectors: right, down, left, up
  const directions = [
    { x: 1, y: 0 }, // Right
    { x: 0, y: 1 }, // Down
    { x: -1, y: 0 }, // Left
    { x: 0, y: -1 }, // Up
  ]

  // Helper to convert (x, y) to a single index in the board array
  const index = (x: number, y: number) => y * size + x

  // Depth-first search (DFS) to find the longest connected path
  const dfs = (
    x: number,
    y: number,
    path: number[],
    visitedInPath: Set<number>,
  ): number[] => {
    const currentIdx = index(x, y)
    const currentPath = [...path, currentIdx]
    visitedInPath.add(currentIdx)

    let maxPath = currentPath

    directions.forEach((dir) => {
      const newX = x + dir.x
      const newY = y + dir.y
      const newIdx = index(newX, newY)

      if (
        newX >= 0 &&
        newX < size &&
        newY >= 0 &&
        newY < size &&
        board[newIdx] === playerID &&
        !visitedInPath.has(newIdx) // Check if it's part of a potential loop
      ) {
        const newPath = dfs(newX, newY, currentPath, new Set(visitedInPath))
        if (newPath.length > maxPath.length) {
          maxPath = newPath
        }
      }
    })

    return maxPath
  }

  // Iterate over all squares in the board and initiate DFS for each unvisited square of the player
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[index(x, y)] === playerID && !visited.has(index(x, y))) {
        const path = dfs(x, y, [], new Set())
        if (path.length > longestPath.length) {
          longestPath = path
        }
      }
    }
  }

  return longestPath
}
