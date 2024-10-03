import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { Turn, Move } from "./types/Game" // Adjust the import path as necessary
import { processTurn } from "./gameprocessors/processTurn"
import { Timestamp } from "firebase-admin/firestore"

export const onMoveCreated = functions.firestore
  .document("games/{gameID}/privateMoves/{moveID}")
  .onCreate(async (snap, context) => {
    const moveData = snap.data() as Move
    const { gameID } = context.params

    logger.info(`Processing move for gameID: ${gameID}`, { moveData })

    await admin.firestore().runTransaction(async (transaction) => {
      // Get the current turn for the game based on the move's turn number
      const currentTurnRef = admin
        .firestore()
        .collection(`games/${gameID}/turns`)
        .doc(moveData.moveNumber.toString())

      const currentTurnDoc = await transaction.get(currentTurnRef)

      if (!currentTurnDoc.exists) {
        logger.error("Current Turn document does not exist.", {
          moveNumber: moveData.moveNumber,
        })
        return
      }

      const currentTurn = currentTurnDoc.data() as Turn
      const now = Timestamp.now()
      const timesUp =
        now.toMillis() >
        (currentTurn.endTime instanceof Timestamp
          ? currentTurn.endTime.toMillis()
          : 0)
      // Check if the move was submitted within the allowed time for this turn and that it's the current turn
      if (timesUp) {
        logger.error("Move submitted after allowable time", {
          gameID,
          playerID: moveData.playerID,
          currentTurn: currentTurn.endTime,
        })
        return
      }

      // Ensure the player is still alive
      if (!currentTurn.alivePlayers.includes(moveData.playerID)) {
        logger.warn(
          `Player ${moveData.playerID} is not alive in turn ${currentTurn.turnNumber}.`,
        )
        return
      }

      // Add the player to the hasMoved field without overwriting the entire object
      const hasMoved = { ...currentTurn.hasMoved }
      hasMoved[moveData.playerID] = { moveTime: moveData.timestamp }

      // Check if all alive players have moved
      const playersMoved = Object.keys(hasMoved)
      const allPlayersMoved = currentTurn.alivePlayers.every((playerID) =>
        playersMoved.includes(playerID),
      )

      // If all alive players have moved or the time limit is reached, process the turn
      if (allPlayersMoved || timesUp) {
        logger.info(
          `Processing turn ${currentTurn.turnNumber} for gameID: ${gameID}`,
        )

        // Process the turn and update the game state
        await processTurn(transaction, gameID, currentTurn)
      } else {
        logger.info(
          "Not all alive players have moved, and time limit has not been reached yet.",
        )
      }

      transaction.update(currentTurnRef, {
        [`hasMoved.${moveData.playerID}`]: { moveTime: moveData.timestamp },
      })
    })
  })
