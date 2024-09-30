import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { Timestamp } from "firebase-admin/firestore"

import * as logger from "firebase-functions/logger"
import { Turn } from "./types/Game"
import { processTurn } from "./gameprocessors/processTurn"

// Firestore trigger for when a client indicates that a turn might have expired
export const onTurnExpirationRequest = functions.firestore
  .document(
    "games/{gameID}/turns/{turnNumber}/expirationRequests/{expirationID}",
  )
  .onCreate(async (snap, context) => {
    const { gameID, turnNumber } = context.params

    logger.info(
      `Processing turn expiration request for gameID: ${gameID}, turnNumber: ${turnNumber}`,
    )

    await admin.firestore().runTransaction(async (transaction) => {
      // Query to get the latest turn (highest turnNumber)
      const latestTurnQuery = admin
        .firestore()
        .collection(`games/${gameID}/turns`)
        .orderBy("turnNumber", "desc")
        .limit(1)

      const latestTurnSnapshot = await transaction.get(latestTurnQuery)

      if (latestTurnSnapshot.empty) {
        logger.error("No turns found for the game.")
        return
      }

      const latestTurnDoc = latestTurnSnapshot.docs[0]
      const latestTurn = latestTurnDoc.data() as Turn

      // Check if the current turnNumber matches the latest turnNumber
      if (Number(turnNumber) !== latestTurn.turnNumber) {
        logger.warn(
          `Turn ${turnNumber} is not the latest turn. Latest turn is ${latestTurn.turnNumber}.`,
        )
        return
      }

      const currentTurnRef = admin
        .firestore()
        .collection(`games/${gameID}/turns`)
        .doc(turnNumber.toString())

      const currentTurnDoc = await transaction.get(currentTurnRef)
      if (!currentTurnDoc.exists) {
        logger.error("Current Turn document does not exist.", { turnNumber })
        return
      }

      const currentTurn = currentTurnDoc.data() as Turn
      const now = Timestamp.now()

      // Check if the turn has expired
      if (now.toMillis() > currentTurn.endTime.toMillis()) {
        logger.info(`Client reported ${turnNumber} has expired. Processing...`)

        // Process the expired turn inside the transaction
        await processTurn(transaction, gameID, currentTurn)
      } else {
        logger.info(`Turn ${turnNumber} has not expired yet.`, {
          now: now.toMillis(),
          end: currentTurn.endTime.toMillis(),
        })
      }
    })
  })
