import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import { GameState, Move } from "@shared/types/Game"

admin.initializeApp()

exports.onMoveCreated = functions.firestore
  .document("games/{gameID}/privateMoves/{moveID}")
  .onCreate(async (snap, context) => {
    const moveData = snap.data() as Move
    const { gameID } = context.params

    const gameRef = admin.firestore().collection("games").doc(gameID)
    const gameDoc = await gameRef.get()
    const gameData = gameDoc.data() as GameState

    if (!gameData) {
      console.error("Game not found")
      return
    }

    // Update the hasMoved array in the game document
    await gameRef.update({
      hasMoved: admin.firestore.FieldValue.arrayUnion(moveData.playerID),
    })

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
        // const playerDocRef = admin
        //   .firestore()
        //   .collection("users")
        //   .doc(move.playerID)
        newBoard[move.move] = move.playerID // Put the player's ID in the board position
      })

      // Update the game board and increment the round number
      await gameRef.update({
        board: newBoard,
        currentRound: gameData.currentRound + 1,
        hasMoved: [], // Reset hasMoved for the next round
      })
    }
  })
