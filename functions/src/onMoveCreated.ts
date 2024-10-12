import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { Turn, Move, GameState, MoveStatus } from "./types/Game" // Adjust the import path as necessary
import { processTurn } from "./gameprocessors/processTurn"
import { Timestamp } from "firebase-admin/firestore"

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

      // // Get the current turn for the game based on the move's turn number
      // const gameStateRef = admin
      //   .firestore()
      //   .collection(`sessions/${sessionID}/games`)
      //   .doc(gameID)
      // const gameStateDoc = await transaction.get(gameStateRef)
      // const gameState = gameStateDoc.data() as GameState

      // Process the turn and update the game state
      await processTurn(transaction, gameID, sessionID, moveNumber)

      // Get the current turn for the game based on the move's turn number
      // const moveStatusRef = admin
      //   .firestore()
      //   .collection(`sessions/${sessionID}/games/${gameID}/moveStatuses`)
      //   .doc(`${moveData.moveNumber}`)

      // const moveStatusDoc = await transaction.update(moveStatusRef)

      // const gameState = moveStatusDoc.data() as MoveStatus
      // if (gameState.turns.length === 0) {
      //   throw "got no turns bro"
      // }
      // const currentTurn = gameState.turns[gameState.turns.length - 1]
      // const now = Timestamp.now()
      // const timesUp =
      //   now.toMillis() >
      //   (currentTurn.endTime instanceof Timestamp
      //     ? currentTurn.endTime.toMillis()
      //     : 0)
      // // Check if the move was submitted within the allowed time for this turn and that it's the current turn
      // if (timesUp) {
      //   logger.error("Move submitted after allowable time", {
      //     gameID,
      //     playerID: moveData.playerID,
      //     currentTurn: currentTurn.endTime,
      //   })
      //   return
      // }

      // // Ensure the player is still alive
      // if (!currentTurn.alivePlayers.includes(moveData.playerID)) {
      //   logger.warn(
      //     `Player ${moveData.playerID} is not alive in turn ${
      //       gameState.turns.length - 1
      //     }.`,
      //   )
      //   return
      // }

      // // Add the player to the hasMoved field without overwriting the entire object
      // const hasMoved = { ...currentTurn.hasMoved }
      // hasMoved[moveData.playerID] = { moveTime: moveData.timestamp }

      // // Check if all alive players have moved
      // const playersMoved = Object.keys(hasMoved)
      // const allPlayersMoved = currentTurn.alivePlayers.every((playerID) =>
      //   playersMoved.includes(playerID),
      // )

      // // If all alive players have moved or the time limit is reached, process the turn
      // if (allPlayersMoved || timesUp) {
      //   logger.info(
      //     `Processing turn ${currentTurn.turnNumber} for gameID: ${gameID}`,
      //   )

      //   // Process the turn and update the game state
      //   await processTurn(transaction, gameID, currentTurn)
      // } else {
      //   logger.info(
      //     "Not all alive players have moved, and time limit has not been reached yet.",
      //   )
      // }

      // transaction.update(moveStatusRef, {
      //   [`hasMoved.${moveData.playerID}`]: { moveTime: moveData.timestamp },
      // })
    })
  })
