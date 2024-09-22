import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import * as logger from "firebase-functions/logger"
import { GameState, Move } from "@shared/types/Game"

admin.initializeApp()

export const onMoveCreated = functions.firestore
  .document("games/{gameID}/privateMoves/{moveID}")
  .onCreate(async (snap, context) => {
    const moveData = snap.data() as Move
    const { gameID } = context.params

    // Log the game ID and move data
    logger.info(`Processing move for gameID: ${gameID}`, { moveData })

    const gameRef = admin.firestore().collection("games").doc(gameID)
    const gameDoc = await gameRef.get()
    const gameData = gameDoc.data() as GameState

    if (!gameData) {
      logger.error("Game not found", { gameID })
      return
    }

    // Log current game state
    logger.info("Game data retrieved", { gameData })

    // Update the hasMoved array in the game document
    await gameRef.update({
      hasMoved: admin.firestore.FieldValue.arrayUnion(moveData.playerID),
    })

    // Log player move
    logger.info(`Player ${moveData.playerID} has moved`, { gameID })

    // Check if all players have moved
    const allPlayersMoved = gameData.playerIDs.every((playerID) =>
      gameData.hasMoved.includes(playerID),
    )

    if (allPlayersMoved) {
      const playerMovesRef = admin
        .firestore()
        .collection(`games/${gameID}/privateMoves`)
      const playerMovesSnapshot = await playerMovesRef
        .where("moveNumber", "==", gameData.currentRound)
        .get()

      const newBoard = [...gameData.board]

      // Apply moves to the board
      playerMovesSnapshot.docs.forEach((doc) => {
        const move = doc.data() as Move
        newBoard[move.move] = move.playerID // Put the player's ID in the board position
      })

      // Log board update
      logger.info("All players moved, updating the board", { newBoard })

      // Update the game board and increment the round number
      await gameRef.update({
        board: newBoard,
        currentRound: gameData.currentRound + 1,
        hasMoved: [], // Reset hasMoved for the next round
      })

      // Log round update
      logger.info(`Round ${gameData.currentRound} completed`, { gameID })
    }
  })
