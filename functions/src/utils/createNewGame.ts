// functions/src/utils/createNewGame.ts

import { Transaction } from "firebase-admin/firestore"
import { GameState } from "@shared/types/Game"
import { logger } from "../logger"
import * as admin from "firebase-admin"

/**
 * Creates a new game after determining the winner(s).
 * @param transaction Firestore transaction object.
 * @param gameID The ID of the current game.
 */
export async function createNewGame(
  transaction: Transaction,
  gameID: string,
): Promise<void> {
  try {
    // Reference to the current game document
    const gameRef = admin.firestore().collection("games").doc(gameID)
    const gameDoc = await transaction.get(gameRef)

    if (!gameDoc.exists) {
      logger.error("Game not found for creating a new game.", { gameID })
      return
    }

    const gameData = gameDoc.data() as GameState

    // Prevent creating a new game if one is already in progress
    if (gameData.winners.length > 0 || gameData.nextGame !== "") {
      logger.warn("New game already created.", { gameID })
      return
    }

    // Generate a new unique game ID
    const newGameRef = admin.firestore().collection("games").doc()

    // Increment the session index for the new game
    const newSessionIndex = gameData.sessionIndex + 1

    // Initialize a new game state
    const newGameState: GameState = {
      sessionName: gameData.sessionName,
      sessionIndex: newSessionIndex,
      gameType: gameData.gameType,
      playerIDs: [], // New game starts with no players
      boardWidth: gameData.boardWidth,
      boardHeight: gameData.boardHeight,
      winners: [], // Initialize as empty array
      started: false, // Game has not started yet
      nextGame: "", // No next game yet
      maxTurnTime: gameData.maxTurnTime,
      playersReady: [], // Reset players ready
      startRequested: false,
    }

    // Set the new game document within the transaction
    transaction.set(newGameRef, newGameState)

    // Update the current game document's nextGame field to reference the new game
    transaction.update(gameRef, { nextGame: newGameRef.id })

    logger.info(
      `New game created with ID ${newGameRef.id} linked from game ${gameID}`,
      {
        id: newGameRef.id,
        linkedFromGameID: gameID,
      },
    )
  } catch (error) {
    logger.error(`Error creating new game for game ${gameID}:`, error)
    throw error
  }
}
