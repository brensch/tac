// functions/src/index.ts

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { GameState, Turn } from "./types/Game" // Adjust the import path as necessary
import { processTurn } from "./helpers"

// Firestore trigger for when a client indicates that a turn might have expired
export const onTurnExpirationRequest = functions.firestore
  .document(
    "games/{gameID}/turns/{turnNumber}/expirationRequests/{expirationID}",
  )
  .onCreate(async (snap, context) => {
    const { gameID, turnNumber } = context.params

    logger.info(`Processing turn expiration request for gameID: ${gameID}`)

    const gameRef = admin.firestore().collection("games").doc(gameID)

    await admin.firestore().runTransaction(async (transaction) => {
      // Read the game document inside the transaction
      const gameDoc = await transaction.get(gameRef)
      const gameData = gameDoc.data() as GameState

      if (!gameData) {
        logger.error("Game not found", { gameID })
        return
      }

      const currentTurnRef = admin
        .firestore()
        .collection(`games/${gameID}/turns`)
        .doc(turnNumber.toString())

      // Read the current turn document inside the transaction
      const currentTurnDoc = await transaction.get(currentTurnRef)
      if (!currentTurnDoc.exists) {
        logger.error("Current Turn document does not exist.", { turnNumber })
        return
      }

      const currentTurn = currentTurnDoc.data() as Turn
      const now = admin.firestore.Timestamp.now()
      const elapsedSeconds = now.seconds - currentTurn.startTime.seconds

      // Check if the turn has expired
      if (elapsedSeconds >= gameData.maxTurnTime) {
        logger.info(`Turn ${turnNumber} has expired. Processing...`)

        // Process the expired turn inside the transaction
        await processTurn(transaction, gameID, currentTurn)
      } else {
        logger.info(
          `Turn ${turnNumber} has not expired yet. Time remaining: ${
            gameData.maxTurnTime - elapsedSeconds
          } seconds.`,
        )
      }
    })
  })
