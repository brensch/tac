// functions/src/gameprocessors/processTurn.ts

import {
  Transaction,
  QuerySnapshot,
  DocumentData,
  Timestamp,
  FieldValue,
} from "firebase-admin/firestore"
import { Move, GameState, MoveStatus } from "@shared/types/Game"
import { getGameProcessor } from "./ProcessorFactory"
import { logger } from "../logger"
import { createNewGame } from "../utils/createNewGame" // Adjust the path as necessary
import * as admin from "firebase-admin"
// import { createNextTurn } from "../utils/createNextTurn"

/**
 * Processes a single turn in the game by applying moves and determining winners.
 * @param transaction Firestore transaction object.
 * @param gameID The ID of the game.
 */
export async function processTurn(
  transaction: Transaction,
  gameID: string,
  sessionID: string,
  turnNumber: number,
): Promise<void> {
  try {
    // Get the current turn for the game based on the move's turn number
    const gameStateRef = admin
      .firestore()
      .collection(`sessions/${sessionID}/games`)
      .doc(gameID)
    const gameStateDoc = await transaction.get(gameStateRef)
    const gameState = gameStateDoc.data() as GameState

    if (gameState.turns.length === 0) {
      logger.error("got no turns in move. problem")
      return
    }

    const latestTurnNumber = gameState.turns.length - 1
    if (latestTurnNumber !== turnNumber) {
      logger.error(
        "got asked to process previous turn",
        latestTurnNumber,
        turnNumber,
      )
      return
    }
    const currentTurn = gameState.turns[turnNumber]

    // Construct the query to fetch moves for the current round
    const movesQuery = admin
      .firestore()
      .collection(`sessions/${sessionID}/games/${gameID}/privateMoves`)
      .where("moveNumber", "==", turnNumber)

    // Execute the query within the transaction
    const movesSnapshot: QuerySnapshot<DocumentData> = await transaction.get(
      movesQuery,
    )

    if (gameState.winners.length > 0) {
      logger.warn("game already finished.")
      return
    }

    // Extract move data from the snapshot
    const movesThisRound: Move[] = movesSnapshot.docs.map(
      (doc) => doc.data() as Move,
    )

    // Log moves received in this round
    logger.info(`Moves received in round ${turnNumber}`, { movesThisRound })

    // Process only the latest move for each player that was made before the end time
    const latestAllowedTime = currentTurn.endTime.toMillis()
    const latestMoves: Move[] = movesThisRound
      .filter((move) => {
        move.timestamp instanceof Timestamp
          ? move.timestamp.toMillis()
          : 0 < latestAllowedTime
      })
      .sort((a, b) => {
        // Ensure both timestamps are valid Timestamp instances
        const aTime =
          a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0
        const bTime =
          b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0
        return bTime - aTime // Sort by timestamp, newest first
      })
      .reduce((acc: Move[], move: Move) => {
        // Add only the latest move for each player
        if (!acc.find((m) => m.playerID === move.playerID)) {
          acc.push(move)
        }
        return acc
      }, [])

    // Log filtered latest moves
    logger.info(`Latest moves for round ${turnNumber}`, { latestMoves })

    if (!currentTurn) {
      logger.info("No current turn found for the game.", { gameID })
      return
    }

    // Instantiate the appropriate processor using the factory
    const processor = getGameProcessor(gameState.setup)

    if (!processor) {
      logger.error(`No processor available `, { gameID })
      throw `processor not known: ${gameState.setup.gameType}`
    }
    // Apply the latest moves to the game board
    const nextTurn = await processor.applyMoves(currentTurn, latestMoves)
    logger.info(`Moves applied for game ${gameID} in round ${turnNumber}`)

    // Determine if there are any winners
    const winners = await processor.findWinners(currentTurn)
    logger.info(`Winners found for game ${gameID} in round ${turnNumber}`, {
      winners,
    })

    transaction.update(gameStateRef, {
      winners,
      turns: FieldValue.arrayUnion(nextTurn), // Append 'nextTurn' to the 'turns' array
    })

    // create the movestatus for players to write to
    const moveStatusRef = admin
      .firestore()
      .collection(`sessions/${sessionID}/games/${gameID}/statuses`)
      .doc("0")
    const moveStatus: MoveStatus = {
      alivePlayerIDs: nextTurn.alivePlayers,
      movedPlayerIDs: [],
    }
    transaction.set(moveStatusRef, moveStatus)

    if (winners.length > 0) {
      // Create a new game after updating the current game with winners
      await createNewGame(transaction, gameID, gameState.setup)
      // set gameover so that when nextturn gets created it has the gameover state
      logger.info(
        `Winners found for game ${gameID} in round ${turnNumber}. New game created.`,
        {
          winners,
        },
      )
      // Update the game document with the winners
      logger.info(`Winners added to game ${gameID} in round ${turnNumber}.`, {
        winners,
      })
    } else {
      logger.info(`No winners yet for game ${gameID} in round ${turnNumber}`)
    }
    // // record latest moves
    // let moves: {
    //   [playerID: string]: number
    // } = {}
    // latestMoves.forEach((move) => (moves[move.playerID] = move.move))
    // currentTurn.moves = moves
    // logger.info("got turn", currentTurn)
    // await createNextTurn(transaction, gameID, currentTurn)
    // logger.info(
    //   `New turn created for game ${gameID} in round ${turnNumber + 1}`,
    // )
  } catch (error) {
    logger.error(
      `Error processing turn ${turnNumber} for game ${gameID}:`,
      error,
    )
    throw error
  }
}
