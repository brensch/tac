import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import * as logger from "firebase-functions/logger"
import { processTurn } from "./gameprocessors/processTurn"
import { GameState } from "./types/Game"

// Firestore trigger for when a client indicates that a turn might have expired
export const onTurnExpirationRequest = functions.firestore
  .document(
    "sessions/{sessionID}/games/{gameID}/expirationRequests/{expirationID}",
  )
  .onCreate(async (snap, context) => {
    const { gameID, sessionID } = context.params
    logger.info(`Processing turn expiration request for gameID: ${gameID}`)

    await admin.firestore().runTransaction(async (transaction) => {
      // Query to get the latest turn (highest turnNumber)
      const gameStateRef = admin
        .firestore()
        .doc(`sessions/${sessionID}/games/${gameID}`)

      const gameStateDoc = await transaction.get(gameStateRef)
      const gameState = gameStateDoc.data() as GameState

      const turnNumber = gameState.turns.length - 1
      const latestTurn = gameState.turns[turnNumber]

      // Check if the turn has expired
      if (latestTurn.endTime.toMillis() >= Date.now()) {
        // If the turn has not yet expired, log that information and return
        logger.warn(
          "Turn has not expired yet",
          latestTurn.endTime.toMillis(),
          Date.now(),
        )
        return
      }
      await processTurn(transaction, gameID, sessionID, turnNumber)
    })
  })
