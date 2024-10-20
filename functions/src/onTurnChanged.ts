import axios from "axios"
import * as admin from "firebase-admin"
import { FieldValue } from "firebase-admin/firestore"
import * as functions from "firebase-functions"
import * as logger from "firebase-functions/logger"
import { Bot, GameState, Move } from "./types/Game" // Adjust the import path as necessary

const processTurn = async (
  gameData: GameState,
  gameID: string,
  sessionID: string,
) => {
  logger.info(`Processing turn for game: ${gameID}`, { gameData })

  if (gameData.turns.length === 0) return

  const turnData = gameData.turns[gameData.turns.length - 1]

  const botsInTurn = gameData.setup.gamePlayers.filter(
    (player) =>
      turnData.alivePlayers.includes(player.id) && player.type === "bot",
  )

  if (botsInTurn.length === 0) {
    logger.info(`No bots in the game, aborting.`)
    return
  }

  // Fetch all bots from the "bots" collection
  const botsSnapshot = await admin.firestore().collection("bots").get()
  const allBots: Bot[] = botsSnapshot.docs.map((doc) => doc.data() as Bot)

  // Filter to get the bots that are playing in the current game
  const botsToQuery = allBots.filter((bot) =>
    botsInTurn.find((player) => player.id === bot.id),
  )

  if (botsToQuery.length === 0) {
    logger.info(
      `No bots found in the bots collection that match the game players.`,
    )
    return
  }

  // Adjusts a position based on the new reduced board and flips the y-axis
  const adjustPosition = (x: number, y: number): { x: number; y: number } => {
    return { x: x - 1, y: gameData.setup.boardHeight - y - 2 } // Shift x inward and flip y-axis
  }

  // Prepare the Battlesnake API request for each bot
  const requests = botsToQuery.map(async (bot) => {
    // Build the request body based on Battlesnake API format, excluding the perimeter and flipping the y-axis
    const youBody = turnData.playerPieces[bot.id].map((pos) => {
      const x = pos % gameData.setup.boardWidth
      const y = Math.floor(pos / gameData.setup.boardWidth)
      return adjustPosition(x, y) // Adjust the position inward and flip y-axis
    })
    const botRequestBody = {
      game: {
        id: gameID,
        ruleset: {
          name: "standard",
          version: "v1.1.15", // Example, adjust based on your actual game rules
          settings: {
            foodSpawnChance: 15,
            minimumFood: 1,
            hazardDamagePerTurn: 14,
          },
        },
        map: "standard", // Adjust map type if needed
        source: "league", // Source of the game
        timeout: 500, // Timeout per move
      },
      turn: gameData.turns.length - 1,
      board: {
        height: gameData.setup.boardHeight - 2, // Reduce the height by 2
        width: gameData.setup.boardWidth - 2, // Reduce the width by 2
        food: (turnData.food || []).map((pos) => {
          const x = pos % gameData.setup.boardWidth
          const y = Math.floor(pos / gameData.setup.boardWidth)
          return adjustPosition(x, y) // Adjust the position inward and flip y-axis
        }),
        hazards: (turnData.hazards || []).map((pos) => {
          const x = pos % gameData.setup.boardWidth
          const y = Math.floor(pos / gameData.setup.boardWidth)
          return adjustPosition(x, y) // Adjust the position inward and flip y-axis
        }),
        snakes: gameData.setup.gamePlayers.map((player) => {
          const body = turnData.playerPieces[player.id].map((pos) => {
            const x = pos % gameData.setup.boardWidth
            const y = Math.floor(pos / gameData.setup.boardWidth)
            return adjustPosition(x, y) // Adjust the position inward and flip y-axis
          })

          return {
            id: player.id,
            name: player.id, // You can modify this to get the player's name if needed
            health: turnData.playerHealth[player.id],
            body,
            head: { ...body[0] }, // Clone the head position to avoid circular reference
            length: body.length,
            latency: "111", // Placeholder value, replace with actual latency if available
            shout: "", // Optional, replace with actual shout data if available
            customizations: {
              color: "#FF0000", // Default color, you can get actual customization from your bot data
              head: "default", // Placeholder, customize if needed
              tail: "default", // Placeholder, customize if needed
            },
          }
        }),
      },
      you: {
        id: bot.id,
        name: bot.id, // You can adjust the name here based on your needs
        health: turnData.playerHealth[bot.id],
        body: youBody,
        head: { ...youBody[0] },
        length: turnData.playerPieces[bot.id].length,
        latency: "111", // Placeholder latency value, replace if you track latency
        shout: "", // Placeholder for shout, adjust if needed
        customizations: {
          color: "#FF0000", // Default color, customize if needed
          head: "default", // Placeholder for head customization
          tail: "default", // Placeholder for tail customization
        },
      },
    }

    try {
      // Make a POST request to the bot's URL
      const response = await axios.post(`${bot.url}/move`, botRequestBody, {
        timeout: 10000, // Timeout for the bot to respond
      })
      logger.info(`Successfully sent move request to bot ${bot.id}`, {
        response: response.data,
      })

      // Convert response to move
      const moveDirection = response.data.move as
        | "up"
        | "down"
        | "left"
        | "right"
      const moveIndex = convertDirectionToMoveIndex(
        moveDirection,
        turnData.playerPieces[bot.id][0], // Head position
        gameData.setup.boardWidth,
        gameData.setup.boardHeight,
      )

      // Create a new Move object
      const newMove: Move = {
        gameID: gameID,
        moveNumber: gameData.turns.length - 1, // Current turn number
        playerID: bot.id,
        move: moveIndex,
        timestamp: FieldValue.serverTimestamp(),
      }

      // Store the move in the Firestore collection
      await admin
        .firestore()
        .collection(`sessions/${sessionID}/games/${gameID}/privateMoves`)
        .add(newMove)

      const path = `sessions/${sessionID}/games/${gameID}/moveStatuses/${
        gameData.turns.length - 1
      }`
      await admin
        .firestore()
        .doc(path)
        .update({
          movedPlayerIDs: FieldValue.arrayUnion(bot.id),
        })

      logger.info(`Successfully recorded move for bot ${bot.id}`, {
        newMove,
      })
    } catch (error) {
      logger.error(`Error sending move request to bot ${bot.id}`, error)
    }
  })

  // Execute all the requests
  await Promise.all(requests)

  logger.info(`Finished processing bot moves for game ${gameID}.`)
}

export const onTurnChanged = functions.firestore
  .document("sessions/{sessionID}/games/{gameID}")
  .onWrite(async (change, context) => {
    const { gameID, sessionID } = context.params
    const newData = change.after.data() as GameState
    const oldData = change.before.data() as GameState

    // Check if it's a new document or an update
    if (!change.before.exists) {
      // Document was created
      logger.info(`New game created: ${gameID}`)
      await processTurn(newData, gameID, sessionID)
    } else if (change.before.exists && change.after.exists) {
      // Document was updated
      if (newData.turns.length !== oldData.turns.length) {
        logger.info(`New turn created for game: ${gameID}`)
        await processTurn(newData, gameID, sessionID)
      }
    }
  })

function convertDirectionToMoveIndex(
  direction: "up" | "down" | "left" | "right",
  headIndex: number,
  boardWidth: number,
  boardHeight: number,
): number {
  const x = headIndex % boardWidth
  const y = Math.floor(headIndex / boardWidth)

  switch (direction) {
    case "up":
      return y > 0 ? (y - 1) * boardWidth + x : headIndex
    case "down":
      return y < boardHeight - 1 ? (y + 1) * boardWidth + x : headIndex
    case "left":
      return x > 0 ? y * boardWidth + (x - 1) : headIndex
    case "right":
      return x < boardWidth - 1 ? y * boardWidth + (x + 1) : headIndex
    default:
      return headIndex
  }
}
