// functions/src/utils/createNewGame.ts

import { Timestamp, Transaction } from "firebase-admin/firestore"
import { GameState, GameType, Session } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"

/**
 * Creates a new game after determining the winner(s).
 * @param transaction Firestore transaction object.
//  * @param gameID The ID of the current game.
 */
export async function createNewGame(
  transaction: Transaction,
  sessionName: string,
): Promise<void> {
  try {
    // Reference to the current game document
    const sessionRef = admin.firestore().collection("sessions").doc(sessionName)
    const sessionDoc = await transaction.get(sessionRef)
    const sessionData = sessionDoc.data() as Session

    let gameType: GameType = "snek"
    let boardWidth = 11
    let boardHeight = 11
    let turnTime = 10
    if (sessionData.latestGameID) {
      const gameRef = sessionRef
        .collection("games")
        .doc(sessionData.latestGameID)
      const gameDoc = await transaction.get(gameRef)
      const gameData = gameDoc.data() as GameState
      gameType = gameData.gameType
      boardWidth = gameData.boardWidth
      boardHeight = gameData.boardHeight
      turnTime = gameData.maxTurnTime
    }

    // Generate a new unique game ID
    const newGameRef = sessionRef.collection("games").doc()

    // Initialize a new game state
    const newGameState: GameState = {
      gameType: gameType,
      gamePlayers: [], // New game starts with no players
      boardWidth: boardWidth,
      boardHeight: boardHeight,
      winners: [], // Initialize as empty array
      started: false, // Game has not started yet
      maxTurnTime: turnTime,
      playersReady: [], // Reset players ready
      startRequested: false,
      timeCreated: Timestamp.now(),
      timeFinished: null,
    }

    // Set the new game document within the transaction
    transaction.set(newGameRef, newGameState)

    // Update the current game document's nextGame field to reference the new game
    transaction.update(sessionRef, { latestGameID: newGameRef.id })

    logger.info(
      `New game created with ID ${newGameRef.id} on sesh ${sessionName}`,
      {
        id: newGameRef.id,
        sessionName: sessionName,
      },
    )
  } catch (error) {
    logger.error(`Error creating new game for session ${sessionName}:`, error)
    throw error
  }
}
