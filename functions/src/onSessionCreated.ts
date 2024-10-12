import * as functions from "firebase-functions"
import * as logger from "firebase-functions/logger"
import * as admin from "firebase-admin"
import { GameSetup, Session } from "./types/Game" // Adjust the import path as necessary
import { createNewGame } from "./utils/createNewGame"
import { FieldValue } from "firebase-admin/firestore"

export const onSessionCreated = functions.firestore
  .document("sessions/{sessionID}")
  .onCreate(async (snap, context) => {
    const sessionData = snap.data() as Session
    const { sessionID } = context.params

    logger.info(`making new session: ${sessionID}`, { sessionData })

    await admin.firestore().runTransaction(async (transaction) => {
      const defaultSetup: GameSetup = {
        gameType: "snek",
        gamePlayers: [],
        boardWidth: 13,
        boardHeight: 13,
        playersReady: [],
        maxTurnTime: 10,
        startRequested: false,
        started: false,
        timeCreated: FieldValue.serverTimestamp(),
      }
      await createNewGame(transaction, sessionID, defaultSetup)
    })

    logger.info(`Finished creating session ${sessionID}.`)
  })
