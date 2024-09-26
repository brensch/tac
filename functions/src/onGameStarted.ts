import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { GameState, Turn } from "./types/Game"

// Reusable function to start the game
export async function startGame(
  transaction: FirebaseFirestore.Transaction,
  gameID: string,
  gameData: GameState,
) {
  const boardWidth = gameData.boardWidth
  const boardSize = boardWidth * boardWidth

  // Initialize an empty board
  const initialBoard = Array(boardSize).fill("")

  // Create the Turn 1 document
  const turnRef = admin.firestore().collection(`games/${gameID}/turns`).doc("1")
  const now = Date.now()

  const firstTurn: Turn = {
    turnNumber: 1,
    board: initialBoard,
    hasMoved: {},
    clashes: {},
    startTime: admin.firestore.Timestamp.fromMillis(now),
    endTime: admin.firestore.Timestamp.fromMillis(now + 60 * 1000), // make first move 60 seconds
    playerIDs: gameData.playerIDs,
  }

  // Set the currentRound to 1 and mark the game as started in the game document
  const gameRef = admin.firestore().collection("games").doc(gameID)

  // Set turn and update game within transaction
  transaction.set(turnRef, firstTurn)
  transaction.update(gameRef, { started: true })

  logger.info(`Turn 1 created and game ${gameID} has started.`)
}

export const onGameStarted = functions.firestore
  .document("games/{gameID}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() as GameState
    const afterData = change.after.data() as GameState
    const { gameID } = context.params

    logger.debug(`checking update on game: ${gameID}`)

    // Check if all playerIDs are in playersReady
    const allPlayersReady = afterData.playerIDs.every((playerID) =>
      afterData.playersReady.includes(playerID),
    )

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
          firstPlayerReadyTime: admin.firestore.Timestamp.now(),
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

      // If the game hasn't started yet, start the game
      if (!afterData.started) {
        await startGame(transaction, gameID, afterData)
      }
    })
  })
