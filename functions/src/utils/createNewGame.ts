// functions/src/utils/createNewGame.ts

import { GameSetup, GameType } from "@shared/types/Game"
import * as admin from "firebase-admin"
import { Timestamp, Transaction } from "firebase-admin/firestore"
import { logger } from "../logger"

/**
 * Creates a new game after determining the winner(s).
 * @param transaction Firestore transaction object.
//  * @param gameID The ID of the current game.
 */
export async function createNewGame(
  transaction: Transaction,
  sessionName: string,
  previousSetup: GameSetup | null,
): Promise<void> {
  try {
    let gameType: GameType = "snek"
    let boardWidth = 11
    let boardHeight = 11
    let turnTime = 10
    if (previousSetup) {
      gameType = previousSetup.gameType
      boardWidth = previousSetup.boardWidth
      boardHeight = previousSetup.boardHeight
      turnTime = previousSetup.maxTurnTime
    }

    // Initialize a new game state
    const newGameSetup: GameSetup = {
      gameType: gameType,
      gamePlayers: [], // New game starts with no players
      boardWidth: boardWidth,
      boardHeight: boardHeight,
      maxTurnTime: turnTime,
      playersReady: [], // Reset players ready
      startRequested: false,
      timeCreated: Timestamp.now(),
      started: false,
    }

    // Reference to the current session document
    const sessionRef = admin.firestore().collection("sessions").doc(sessionName)
    // Generate a new unique game ID
    const newGameSetupRef = sessionRef.collection("setups").doc()
    // Set the new game document within the transaction
    transaction.set(newGameSetupRef, newGameSetup)

    // Update the current game document's nextGame field to reference the new game
    transaction.update(sessionRef, { latestGameID: newGameSetupRef.id })

    logger.info(
      `New game created with ID ${newGameSetupRef.id} on sesh ${sessionName}`,
      {
        id: newGameSetupRef.id,
        sessionName: sessionName,
      },
    )
  } catch (error) {
    logger.error(`Error creating new game for session ${sessionName}:`, error)
    throw error
  }
}
