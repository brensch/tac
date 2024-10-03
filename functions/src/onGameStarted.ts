// functions/src/triggers/onGameStarted.ts

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { GameState } from "@shared/types/Game" // Adjust the path as necessary
import { getGameProcessor } from "./gameprocessors/ProcessorFactory"
import { logger } from "./logger" // Adjust the path as necessary
import { Timestamp } from "firebase-admin/firestore"

/**
 * Firestore Trigger to start the game when all players are ready.
 */
export const onGameStarted = functions.firestore
  .document("games/{gameID}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() as GameState
    const afterData = change.after.data() as GameState
    const { gameID } = context.params

    logger.debug(`Checking update on game: ${gameID}`)

    // Check if all playerIDs are in playersReady
    const allPlayersReady = afterData.gamePlayers
      .filter((gamePlayer) => gamePlayer.type === "human")
      .every((player) => afterData.playersReady.includes(player.id))

    // Use a transaction to ensure consistency
    await admin.firestore().runTransaction(async (transaction) => {
      const gameRef = admin.firestore().collection("games").doc(gameID)

      // Check if the first player became ready (playersReady length changed from 0 to 1)
      if (
        beforeData.playersReady.length === 0 &&
        afterData.playersReady.length > 0
      ) {
        // Set firstPlayerReadyTime to now if the first player is ready
        transaction.update(gameRef, {
          firstPlayerReadyTime: Timestamp.now(),
        })

        logger.info(
          `First player ready for game ${gameID}, firstPlayerReadyTime set.`,
        )
      }

      // If not all players are ready, exit early
      if (!allPlayersReady) {
        logger.info(`Not all players are ready for game ${gameID}.`)
        return
      }

      if (afterData.gamePlayers.length === 0) {
        logger.info(`no one in game. nonsense. ${gameID}.`)
        return
      }

      if (!afterData.startRequested) {
        logger.info(`start not requested yet ${gameID}.`)
        return
      }

      // If the game hasn't started yet, start the game
      if (!afterData.started) {
        // Instantiate the appropriate processor using the factory
        const processor = getGameProcessor(
          transaction,
          gameID,
          [],
          afterData.gameType,
        )

        if (processor) {
          // Initialize the game using the processor's method
          await processor.initializeGame(afterData)

          logger.info(`Game ${gameID} has been initialized.`)
        } else {
          logger.error(
            `No processor found for gameType: ${afterData.gameType} in game ${gameID}`,
          )
        }
      }
    })
  })
