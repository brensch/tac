// functions/src/utils/createNextTurn.ts

import { Turn } from "@shared/types/Game"
import { Timestamp, Transaction } from "firebase-admin/firestore"
import * as admin from "firebase-admin"

/**
 * Creates a new Turn document for the next round in the game.
 * @param transaction Firestore transaction object.
 * @param gameID The ID of the game.
 * @param currentTurn The current turn state of the game.
 */
export async function createNextTurn(
  transaction: Transaction,
  gameID: string,
  currentTurn: Turn,
): Promise<void> {
  // Determine the next turn number
  const nextTurnNumber = currentTurn.turnNumber + 1

  // Current timestamp for the new turn's start time
  const now = Date.now()

  // Calculate the end time based on maxTurnTime
  const endTimeMillis = now + currentTurn.turnTime * 1000

  // Initialize the new Turn object
  const newTurn: Turn = {
    turnNumber: nextTurnNumber,
    boardWidth: currentTurn.boardWidth,
    boardHeight: currentTurn.boardHeight,
    gameType: currentTurn.gameType,
    playerIDs: currentTurn.playerIDs,
    playerHealth: currentTurn.playerHealth,
    scores: currentTurn.scores,
    alivePlayers: currentTurn.alivePlayers,
    hasMoved: {}, // Reset hasMoved for the new turn
    turnTime: currentTurn.turnTime,
    startTime: Timestamp.fromMillis(now),
    endTime: Timestamp.fromMillis(endTimeMillis),
    food: currentTurn.food,
    hazards: currentTurn.hazards,
    playerPieces: currentTurn.playerPieces,
    allowedMoves: currentTurn.allowedMoves,
    walls: currentTurn.walls,
    clashes: currentTurn.clashes,
    gameOver: currentTurn.gameOver,
    moves: currentTurn.moves,
  }

  // Handle game-specific data structures
  if ((currentTurn as any).claimedPositions) {
    ;(newTurn as any).claimedPositions = (currentTurn as any).claimedPositions
  }

  if ((currentTurn as any).grid) {
    ;(newTurn as any).grid = (currentTurn as any).grid
  }

  // Construct DocumentReference for the new turn
  const newTurnRef = admin
    .firestore()
    .collection(`games/${gameID}/turns`)
    .doc(`${nextTurnNumber}`) // Document ID as the turn number

  // Set the new Turn document within the transaction
  transaction.set(newTurnRef, newTurn)
}
