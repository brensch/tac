import * as admin from "firebase-admin"
import * as functions from "firebase-functions"
import * as logger from "firebase-functions/logger"
import { processTurn } from "./gameprocessors/processTurn"
import { MoveStatus } from "./types/Game" // Adjust the import path as necessary

export const onMoveCreated = functions.firestore
  .document("sessions/{sessionID}/games/{gameID}/moveStatuses/{moveNumber}")
  .onCreate(async (snap, context) => {
    const moveData = snap.data() as MoveStatus
    const { gameID, sessionID, moveNumber } = context.params

    logger.info(`Processing move for gameID: ${gameID}`, { moveData })

    await admin.firestore().runTransaction(async (transaction) => {
      // Check if all alive players have moved
      const allPlayersMoved = moveData.alivePlayerIDs.every((playerID) =>
        moveData.movedPlayerIDs.includes(playerID),
      )

      if (!allPlayersMoved) {
        return
      }

      // Process the turn and update the game state
      await processTurn(transaction, gameID, sessionID, Number(moveNumber))
    })
  })
