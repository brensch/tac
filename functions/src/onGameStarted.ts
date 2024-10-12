// functions/src/triggers/onGameStarted.ts

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { GameSetup, GameState, MoveStatus } from "@shared/types/Game" // Adjust the path as necessary
import { getGameProcessor } from "./gameprocessors/ProcessorFactory"
import { logger } from "./logger" // Adjust the path as necessary
import { FieldValue } from "firebase-admin/firestore"

/**
 * Firestore Trigger to start the game when all players are ready.
 */
export const onGameStarted = functions.firestore
  .document("sessions/{sessionID}/setups/{gameID}")
  .onUpdate(async (change, context) => {
    const afterData = change.after.data() as GameSetup
    const { gameID, sessionID } = context.params

    logger.debug(`Checking update on game: ${gameID}`)

    // Check if all playerIDs are in playersReady
    const allPlayersReady = afterData.gamePlayers
      .filter((gamePlayer) => gamePlayer.type === "human")
      .every((player) => afterData.playersReady.includes(player.id))

    // Use a transaction to ensure consistency
    await admin.firestore().runTransaction(async (transaction) => {
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

      // If the game has started, abort
      if (afterData.started) {
        logger.info(`game has started ${gameID}.`)
        return
      }

      // Instantiate the appropriate processor using the factory
      const processor = getGameProcessor(afterData)

      if (!processor) {
        logger.error(
          `No processor found for gameType: ${afterData.gameType} in game ${gameID}`,
        )
        return
      }
      // Initialize the game using the processor's method
      const firstTurn = processor.firstTurn()

      // set the game
      const gameStateRef = admin
        .firestore()
        .collection(`sessions/${sessionID}/games`)
        .doc(gameID)
      const newGame: GameState = {
        setup: afterData,
        winners: [],
        turns: [firstTurn],
        timeCreated: FieldValue.serverTimestamp(),
        timeFinished: null,
      }
      transaction.set(gameStateRef, newGame)

      // set the movestatus for players to write to
      const moveStatusRef = admin
        .firestore()
        .collection(`sessions/${sessionID}/games/${gameID}/statuses`)
        .doc("0")
      const moveStatus: MoveStatus = {
        alivePlayerIDs: firstTurn.alivePlayers,
        movedPlayerIDs: [],
      }
      transaction.set(moveStatusRef, moveStatus)

      logger.info(`Game ${gameID} has been initialized.`)
    })
  })
