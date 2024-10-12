import * as functions from "firebase-functions"
import * as logger from "firebase-functions/logger"
import * as admin from "firebase-admin"
import { Session } from "./types/Game" // Adjust the import path as necessary
import { createNewGame } from "./utils/createNewGame"

export const onSessionCreated = functions.firestore
  .document("sessions/{sessionID}")
  .onCreate(async (snap, context) => {
    const sessionData = snap.data() as Session
    const { sessionID } = context.params

    logger.info(`making new session: ${sessionID}`, { sessionData })

    await admin.firestore().runTransaction(async (transaction) => {
      await createNewGame(transaction, sessionID)
    })

    logger.info(`Finished creating session ${sessionID}.`)
  })
