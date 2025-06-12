import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import * as logger from "firebase-functions/logger"
import { processTurn } from "./gameprocessors/processTurn"

// Firestore trigger for when a client indicates that a turn might have expired
export const onTurnExpirationRequest = functions.firestore
  .document(
    "sessions/{sessionID}/games/{gameID}/expirationRequests/{expirationID}"
  )
  .onCreate(async (snap, context) => {
    const { sessionID, gameID, expirationID } = context.params

    // Cast expirationID (string) to a number
    const turnNumber = Number(expirationID)
    if (Number.isNaN(turnNumber)) {
      logger.error(
        `Invalid expirationID—expected a number but got "${expirationID}"`
      )
      return
    }

    logger.info(
      `Processing turn expiration request for game ${sessionID}/${gameID}, turn ${turnNumber}`
    )

    if (turnNumber > 1000) {
      logger.error("got a turn over 1000. cooked as.")
      return
    }

    await admin.firestore().runTransaction(async (transaction) => {
      await processTurn(transaction, gameID, sessionID, turnNumber)
    })
  })
