// functions/src/triggers/onGameStarted.ts

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { GameSetup, GameState, MoveStatus } from "@shared/types/Game" // Adjust the path as necessary
import { getGameProcessor } from "./gameprocessors/ProcessorFactory"
import { logger } from "./logger" // Adjust the path as necessary
import { FieldValue, Timestamp } from "firebase-admin/firestore"

/**
 * Firestore Trigger to start the game when all players are ready.
 */
export const onGameStarted = functions.firestore
  .document("sessions/{sessionID}/setups/{gameID}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() as GameSetup
    const afterData = change.after.data() as GameSetup
    const { gameID, sessionID } = context.params

    logger.debug(`Checking update on game: ${gameID}`)

    if (beforeData.started) {
      logger.warn("game already started")
      return
    }

    // Check if all playerIDs are in playersReady
    const allPlayersReady = afterData.gamePlayers
      .filter((gamePlayer) => gamePlayer.type === "human")
      .every((player) => afterData.playersReady.includes(player.id))

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

    // gameprocessor needs gamestate due to needing all turns.
    // construct a new object with empty fields
    const gameState: GameState = {
      turns: [],
      setup: afterData,
      // these are not used, don't want to change to optional fields though
      timeCreated: Timestamp.fromMillis(0),
      timeFinished: Timestamp.fromMillis(0),

    }

    // Instantiate the appropriate processor using the factory
    const processor = getGameProcessor(gameState)

    if (!processor) {
      logger.error(
        `No processor found for gameType: ${afterData.gameType} in game ${gameID}`,
      )
      return
    }

    // Use a transaction to ensure consistency
    await admin.firestore().runTransaction(async (transaction) => {
      // If not all players are ready, exit early

      // Initialize the game using the processor's method
      const firstTurn = processor.firstTurn()
      const now = Date.now() // Current time in milliseconds
      const startTurnDurationMillis = 60 * 1000 // Convert maxTurnTime from seconds to milliseconds
      const endTime = new Date(now + startTurnDurationMillis) // Add turn time to current time
      firstTurn.startTime = Timestamp.fromMillis(now)
      firstTurn.endTime = Timestamp.fromDate(endTime)

      afterData.started = true

      // set the game
      const gameStateRef = admin
        .firestore()
        .collection(`sessions/${sessionID}/games`)
        .doc(gameID)
      const newGame: GameState = {
        setup: afterData,
        turns: [firstTurn],
        timeCreated: FieldValue.serverTimestamp(),
        timeFinished: null,
      }
      transaction.set(gameStateRef, newGame)

      // set started to true
      const gameSetupRef = admin
        .firestore()
        .collection(`sessions/${sessionID}/setups`)
        .doc(gameID)
      transaction.update(gameSetupRef, { started: true })

      // set the movestatus for players to write to
      const moveStatusRef = admin
        .firestore()
        .collection(`sessions/${sessionID}/games/${gameID}/moveStatuses`)
        .doc("0")
      const moveStatus: MoveStatus = {
        moveNumber: 0,
        alivePlayerIDs: firstTurn.alivePlayers,
        movedPlayerIDs: [],
      }
      transaction.set(moveStatusRef, moveStatus)

      logger.info(`Game ${gameID} has been initialized.`)
    })
  })
