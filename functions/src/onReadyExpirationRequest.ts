// functions/src/index.ts

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { GameState } from "./types/Game"
import { getGameProcessor } from "./gameprocessors/ProcessorFactory"

export const onReadyExpirationRequest = functions.firestore
  .document("games/{gameID}/readyExpirationRequests/{requestID}")
  .onCreate(async (snap, context) => {
    const { gameID } = context.params

    logger.info(`Processing ready expiration request for gameID: ${gameID}`)

    const gameRef = admin.firestore().collection("games").doc(gameID)
    const gameDoc = await gameRef.get()
    const gameData = gameDoc.data() as GameState

    if (!gameData) {
      logger.error("Game not found", { gameID })
      return
    }

    if (gameData.started) {
      logger.info(`Ready expiration requested, but game already started.`)
      return
    }

    if (!gameData.firstPlayerReadyTime) {
      return
    }
    const now = admin.firestore.Timestamp.now()
    const firstPlayerReadyTime = gameData.firstPlayerReadyTime
    const elapsedSeconds = now.seconds - firstPlayerReadyTime.seconds

    if (elapsedSeconds >= 60) {
      logger.info(`Ready expiration passed, starting game ${gameID}`)
      await admin.firestore().runTransaction(async (transaction) => {
        const processor = getGameProcessor(
          transaction,
          gameID,
          [],
          gameData.gameType,
        )

        if (processor) {
          // Initialize the game using the processor's method
          await processor.initializeGame(gameData)

          logger.info(`Game ${gameID} has been initialized.`)
        } else {
          logger.error(
            `No processor found for gameType when starting: ${gameData.gameType} in game ${gameID}`,
          )
        }
      })
    } else {
      logger.info(`Not enough time has passed since first player was ready.`)
    }
  })
