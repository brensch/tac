// functions/src/gameprocessors/processTurn.ts

import {
  Transaction,
  QuerySnapshot,
  DocumentData,
} from "firebase-admin/firestore"
import { Turn, Move } from "@shared/types/Game"
import { getGameProcessor } from "./ProcessorFactory"
import { logger } from "../logger"
import { createNewGame } from "../utils/createNewGame" // Adjust the path as necessary
import * as admin from "firebase-admin"
import { createNextTurn } from "../utils/createNextTurn"

/**
 * Processes a single turn in the game by applying moves and determining winners.
 * @param transaction Firestore transaction object.
 * @param gameID The ID of the game.
 * @param currentTurn The current turn state of the game.
 */
export async function processTurn(
  transaction: Transaction,
  gameID: string,
  currentTurn: Turn,
): Promise<void> {
  const currentRound = currentTurn.turnNumber

  try {
    // Construct the query to fetch moves for the current round
    const movesQuery = admin
      .firestore()
      .collection(`games/${gameID}/privateMoves`)
      .where("moveNumber", "==", currentRound)

    // Execute the query within the transaction
    const movesSnapshot: QuerySnapshot<DocumentData> = await transaction.get(
      movesQuery,
    )

    if (currentTurn.gameOver) {
      logger.warn("game already finished.")
      return
    }

    // Extract move data from the snapshot
    const movesThisRound: Move[] = movesSnapshot.docs.map(
      (doc) => doc.data() as Move,
    )

    // Log moves received in this round
    logger.info(`Moves received in round ${currentRound}`, { movesThisRound })

    // Process only the latest move for each player
    const latestMoves: Move[] = movesThisRound
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()) // Sort moves by timestamp, newest first
      .reduce((acc: Move[], move: Move) => {
        if (!acc.find((m) => m.playerID === move.playerID)) {
          acc.push(move) // Add only the latest move for each player
        }
        return acc
      }, [])

    // Log filtered latest moves
    logger.info(`Latest moves for round ${currentRound}`, { latestMoves })

    if (!currentTurn) {
      logger.info("No current turn found for the game.", { gameID })
      return
    }

    // Instantiate the appropriate processor using the factory
    const processor = getGameProcessor(
      transaction,
      gameID,
      latestMoves,
      currentTurn.gameType,
      currentTurn,
    )

    if (processor) {
      // Apply the latest moves to the game board
      await processor.applyMoves()
      logger.info(`Moves applied for game ${gameID} in round ${currentRound}`)

      // Determine if there are any winners
      const winners = await processor.findWinners()
      logger.info(`Winners found for game ${gameID} in round ${currentRound}`, {
        winners,
      })

      if (winners.length > 0) {
        // Reference to the game document
        const gameRef = admin.firestore().collection("games").doc(gameID)

        // Create a new game after updating the current game with winners
        await createNewGame(transaction, gameID)
        // set gameover so that when nextturn gets created it has the gameover state
        currentTurn.gameOver = true
        logger.info(
          `Winners found for game ${gameID} in round ${currentRound}. New game created.`,
          {
            winners,
          },
        )
        // Update the game document with the winners
        await transaction.update(gameRef, { winners })
        logger.info(
          `Winners added to game ${gameID} in round ${currentRound}.`,
          { winners },
        )
      } else {
        logger.info(
          `No winners yet for game ${gameID} in round ${currentRound}`,
        )
      }
      // record latest moves
      let moves: {
        [playerID: string]: number
      } = {}
      latestMoves.forEach((move) => (moves[move.playerID] = move.move))
      currentTurn.moves = moves
      await createNextTurn(transaction, gameID, currentTurn)
      logger.info(
        `New turn created for game ${gameID} in round ${currentRound + 1}`,
      )
    } else {
      logger.error(
        `No processor available for game type: ${currentTurn.gameType}`,
        { gameID },
      )
    }
  } catch (error) {
    logger.error(
      `Error processing turn ${currentRound} for game ${gameID}:`,
      error,
    )
    throw error
  }
}
