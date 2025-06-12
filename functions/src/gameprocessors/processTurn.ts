// processTurn.ts

import {
  GameRanking,
  GameResult,
  GameState,
  Move,
  Ranking,
  Winner
} from "@shared/types/Game"
import * as admin from "firebase-admin"
import {
  DocumentData,
  FieldValue,
  QuerySnapshot,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore"
import { logger } from "../logger"
import { createNewGame } from "../utils/createNewGame"
import { getGameProcessor } from "./ProcessorFactory"
import { scheduleTurnExpiration } from "../utils/scheduleTurnExpiration"

interface PlayerUpdateData {
  playerID: string
  type: "human" | "bot"
  ref: FirebaseFirestore.DocumentReference // Reference to the ranking document
  newRanking: GameRanking
  shouldCreate: boolean
  mmrChange: number
  newMMR: number
}

interface PlayerData {
  id: string
  type: "human" | "bot"
  rankingRef: FirebaseFirestore.DocumentReference // Reference to the ranking document
  rankingData: Ranking | null // Existing ranking data
  currentMMR: number
  gamesPlayed: number
  exists: boolean // Whether the ranking document exists
}

const DEFAULT_MMR = 1000
const MIN_MMR = 0 // Minimum MMR value

async function preparePlayerUpdates(
  transaction: Transaction,
  sessionID: string,
  gameID: string,
  gameState: GameState,
  winners: Winner[]
): Promise<PlayerUpdateData[]> {
  const gameType = gameState.setup.gameType // Get the game type

  const playerIDs = gameState.setup.gamePlayers.map((p) => p.id)
  const playerTypes = new Map<string, "human" | "bot">()
  gameState.setup.gamePlayers.forEach((p) => {
    playerTypes.set(p.id, p.type)
  })

  // Build references to the rankings documents
  const rankingRefs = playerIDs.map((id) =>
    admin.firestore().collection("rankings").doc(id)
  )

  // Fetch existing rankings
  const rankingDocs = await Promise.all(
    rankingRefs.map((ref) => transaction.get(ref))
  )

  const playerData: PlayerData[] = rankingDocs.map((doc, index) => {
    const data = doc.data() as Ranking | undefined
    const type = playerTypes.get(doc.id)!

    const rankings = data?.rankings
    const rankingForGameType = rankings ? rankings[gameType] : null

    return {
      id: doc.id,
      type: type,
      rankingRef: doc.ref,
      rankingData: data || null,
      currentMMR: rankingForGameType?.currentMMR ?? DEFAULT_MMR,
      gamesPlayed: rankingForGameType?.gamesPlayed ?? 0,
      exists: doc.exists,
    }
  })

  // Map of playerID to placement, handling draws
  // First, create an array of player results
  const playerResults = playerData.map((player) => {
    const winner = winners.find((w) => w.playerID === player.id)
    const score = winner ? winner.score : 0
    return { playerID: player.id, score }
  })

  // Sort by score in descending order
  playerResults.sort((a, b) => b.score - a.score)

  // Assign placements, handling ties
  const placementsMap = new Map<string, number>()
  let currentPlacement = 1
  for (let i = 0; i < playerResults.length; i++) {
    const playerID = playerResults[i].playerID
    const score = playerResults[i].score

    // If not the first player and score is equal to previous score, same placement
    if (i > 0 && score === playerResults[i - 1].score) {
      // Same placement as previous
      placementsMap.set(playerID, currentPlacement)
    } else {
      // New placement
      currentPlacement = i + 1
      placementsMap.set(playerID, currentPlacement)
    }
  }

  // Get the list of placements in the same order as playerData
  const placements: number[] = playerData.map(
    (player) => placementsMap.get(player.id)!
  )

  // Prepare data for MMR calculation
  const playersForMMR = playerData.map((player) => ({
    mmr: player.currentMMR,
    gamesPlayed: player.gamesPlayed,
  }))

  // Calculate MMR changes for all players
  const mmrChanges = calculateMMRChanges(playersForMMR, placements)

  const updates: PlayerUpdateData[] = []
  const now = Date.now()

  for (let i = 0; i < playerData.length; i++) {
    const player = playerData[i]
    const mmrChange = mmrChanges[i]
    const placement = placements[i]

    const newMMR = player.currentMMR + mmrChange

    const gameResult: GameResult = {
      sessionID,
      gameID,
      timestamp: Timestamp.fromMillis(now),
      previousMMR: player.currentMMR,
      mmrChange,
      placement,
      opponents: playerData
        .filter((p) => p.id !== player.id)
        .map((opponent) => ({
          playerID: opponent.id,
          mmr: opponent.currentMMR,
          placement: placementsMap.get(opponent.id)!,
        })),
    }

    const existingRanking = player.rankingData?.rankings?.[gameType] ?? {
      currentMMR: DEFAULT_MMR,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      gameHistory: [],
      lastUpdated: Timestamp.fromMillis(now),
    }

    const gameHistory = [...existingRanking.gameHistory, gameResult].slice(-100)

    const newRanking: GameRanking = {
      currentMMR: newMMR,
      gamesPlayed: existingRanking.gamesPlayed + 1,
      wins: existingRanking.wins + (placement === 1 ? 1 : 0),
      losses: existingRanking.losses + (placement !== 1 ? 1 : 0),
      gameHistory,
      lastUpdated: FieldValue.serverTimestamp(),
    }

    // Prepare the updated rankings object
    const updatedRankings = {
      ...(player.rankingData?.rankings || {}),
      [gameType]: newRanking,
    }

    // // Prepare the full Ranking document
    // const updatedRankingDoc: Ranking = {
    //   playerID: player.id,
    //   type: player.type,
    //   rankings: updatedRankings,
    //   lastUpdated: FieldValue.serverTimestamp(),
    // }

    updates.push({
      playerID: player.id,
      type: player.type,
      ref: player.rankingRef,
      newRanking: newRanking,
      shouldCreate: !player.exists,
      mmrChange,
      newMMR,
    })

    logger.info(`Preparing ranking update for player ${player.id}`, {
      previousMMR: player.currentMMR,
      newMMR: newMMR,
      mmrChange,
      placement,
      gamesPlayed: player.gamesPlayed,
      creating: !player.exists,
    })

    // Now, write the updated ranking document
    if (player.exists) {
      // Update existing ranking document
      transaction.update(player.rankingRef, {
        playerID: player.id,
        type: player.type,
        rankings: updatedRankings,
        lastUpdated: FieldValue.serverTimestamp(),
      })
    } else {
      // Create new ranking document
      transaction.create(player.rankingRef, {
        playerID: player.id,
        type: player.type,
        rankings: {
          [gameType]: newRanking,
        },
        lastUpdated: FieldValue.serverTimestamp(),
      })
    }
  }

  // Update the winners array to include mmrChange and newMMR
  for (const winner of winners) {
    const playerUpdate = updates.find((u) => u.playerID === winner.playerID)
    if (playerUpdate) {
      winner.mmrChange = playerUpdate.mmrChange
      winner.newMMR = playerUpdate.newMMR
    }
  }

  return updates
}

export async function processTurn(
  transaction: Transaction,
  gameID: string,
  sessionID: string,
  turnNumber: number
): Promise<void> {
  try {
    // Get game state
    const gameStateRef = admin
      .firestore()
      .collection(`sessions/${sessionID}/games`)
      .doc(gameID)
    const gameStateDoc = await transaction.get(gameStateRef)
    const gameState = gameStateDoc.data() as GameState

    if (!gameState) {
      logger.error("Game state not found", { gameID })
      return
    }

    if (gameState.turns.length === 0) {
      logger.error("No turns in game state.")
      return
    }

    const latestTurnNumber = gameState.turns.length - 1
    if (latestTurnNumber !== turnNumber) {
      logger.error(
        "Processing previous turn",
        latestTurnNumber,
        turnNumber
      )
      return
    }
    const currentTurn = gameState.turns[turnNumber]

    // Get moves
    const movesQuery = admin
      .firestore()
      .collection(`sessions/${sessionID}/games/${gameID}/privateMoves`)
      .where("moveNumber", "==", turnNumber)
    const movesSnapshot: QuerySnapshot<DocumentData> = await transaction.get(
      movesQuery
    )

    if (currentTurn.winners.length > 0) {
      logger.warn("Game already finished.")
      return
    }

    // Process moves and get next turn
    const movesThisRound: Move[] = movesSnapshot.docs.map(
      (doc) => doc.data() as Move
    )
    const latestAllowedTime = currentTurn.endTime.toMillis()

    const latestMoves: Move[] = movesThisRound
      .filter((move) => {
        const moveTime =
          move.timestamp instanceof Timestamp
            ? move.timestamp.toMillis()
            : 0
        return moveTime <= latestAllowedTime
      })
      .sort((a, b) => {
        const aTime =
          a.timestamp instanceof Timestamp
            ? a.timestamp.toMillis()
            : 0
        const bTime =
          b.timestamp instanceof Timestamp
            ? b.timestamp.toMillis()
            : 0
        return bTime - aTime
      })
      .reduce((acc: Move[], move: Move) => {
        if (!acc.find((m) => m.playerID === move.playerID)) {
          acc.push(move)
        }
        return acc
      }, [])

    if (!currentTurn) {
      logger.info("No current turn found for the game.", { gameID })
      return
    }

    const processor = getGameProcessor(gameState)
    if (!processor) {
      logger.error(`No processor available `, { gameID })
      throw `Processor not known: ${gameState.setup.gameType}`
    }

    const nextTurn = await processor.applyMoves(currentTurn, latestMoves)
    const now = Date.now()
    const turnDurationMillis = gameState.setup.maxTurnTime * 1000
    const endTime = new Date(now + turnDurationMillis)

    nextTurn.startTime = Timestamp.fromMillis(now)
    nextTurn.endTime = Timestamp.fromDate(endTime)

    if (nextTurn.winners.length > 0) {
      // Prepare all player ranking updates (reads and writes are done in preparePlayerUpdates)
      // All ranking updates are handled within preparePlayerUpdates
      await preparePlayerUpdates(
        transaction,
        sessionID,
        gameID,
        gameState,
        nextTurn.winners
      )

      // Perform all writes together
      transaction.update(gameStateRef, {
        turns: FieldValue.arrayUnion(nextTurn),
        timeFinished: FieldValue.serverTimestamp(),
      })


      // Create new game
      await createNewGame(transaction, sessionID, gameState.setup)

      logger.info(`Game ${gameID} finished and rankings updated.`, {
        winners: nextTurn.winners,
      })
    } else {
      // normal turn
      transaction.update(gameStateRef, {
        turns: FieldValue.arrayUnion(nextTurn),
      })

      const newTurnNumber = gameState.turns.length        // index of nextTurn
      const moveStatusRef = admin
        .firestore()
        .collection(`sessions/${sessionID}/games/${gameID}/moveStatuses`)
        .doc(`${newTurnNumber}`)
      transaction.set(moveStatusRef, {
        moveNumber: newTurnNumber,
        alivePlayerIDs: nextTurn.alivePlayers,
        movedPlayerIDs: [],
      })

      // schedule the expiration *inside* this transaction callback*
      // so if enqueue fails, the transaction will retry instead of committing
      const executeAt = new Date(nextTurn.endTime.toMillis())
      await scheduleTurnExpiration(sessionID, gameID, newTurnNumber, executeAt)
    }

  } catch (error) {
    logger.error(
      `Error processing turn ${turnNumber} for game ${gameID}:`,
      error
    )
    throw error
  }
}

export const calculateMMRChanges = (
  players: { mmr: number; gamesPlayed: number }[],
  placements: number[]
): number[] => {
  const mmrChanges: number[] = []

  players.forEach((player, idx) => {
    const opponentPlayers = players.filter((_, i) => i !== idx)
    const numOpponents = opponentPlayers.length

    if (numOpponents === 0) {
      mmrChanges.push(0)
      return
    }

    // Expected score
    let expectedScore = 0
    opponentPlayers.forEach((opponent) => {
      const mmrDiff = player.mmr - opponent.mmr
      const winProb = 1 / (1 + Math.pow(10, -mmrDiff / 400))
      expectedScore += winProb
    })
    expectedScore = expectedScore / numOpponents

    // Actual score considering draws
    let actualScore = 0
    const playerPlacement = placements[idx]
    opponentPlayers.forEach((_, oppIdx) => {
      const opponentPlacement = placements[oppIdx >= idx ? oppIdx + 1 : oppIdx]
      let scoreVsOpponent = 0
      if (playerPlacement < opponentPlacement) {
        scoreVsOpponent = 1 // Player beat opponent
      } else if (playerPlacement === opponentPlacement) {
        scoreVsOpponent = 0.5 // Draw
      } else {
        scoreVsOpponent = 0 // Player lost to opponent
      }
      actualScore += scoreVsOpponent
    })
    actualScore = actualScore / numOpponents

    // Dynamic K-factor
    const K = calculateKFactor(player.gamesPlayed)

    // MMR change
    let mmrChange = K * (actualScore - expectedScore)
    mmrChanges.push(mmrChange)
  })

  // Adjust MMR changes to prevent MMR from going below MIN_MMR
  const adjustedMMRChanges = adjustMMRChangesForMinMMR(players, mmrChanges, MIN_MMR)

  // Round the MMR changes
  return adjustedMMRChanges.map((change) => Math.round(change))
}

function calculateKFactor(gamesPlayed: number): number {
  const MAX_K = 64 // High K-factor for new players
  const MIN_K = 16 // Lower K-factor for experienced players
  const K = Math.max(MIN_K, MAX_K - (gamesPlayed * (MAX_K - MIN_K)) / 50)
  return K
}

// Adjust MMR changes to prevent MMR from going below MIN_MMR
function adjustMMRChangesForMinMMR(
  players: { mmr: number }[],
  mmrChanges: number[],
  minMMR: number
): number[] {
  const adjustedChanges = [...mmrChanges]
  let totalAdjustment = 0

  for (let i = 0; i < players.length; i++) {
    const playerMMR = players[i].mmr
    const mmrChange = adjustedChanges[i]
    const newMMR = playerMMR + mmrChange

    if (newMMR < minMMR) {
      const adjustmentNeeded = minMMR - newMMR
      totalAdjustment += adjustmentNeeded // This amount needs to be redistributed
      adjustedChanges[i] += adjustmentNeeded // Adjust MMR change
    }
  }

  // Redistribute the total adjustment among other players proportionally
  const playersWhoCanReceiveAdjustment = players
    .map((player, idx) => ({ idx, mmrChange: adjustedChanges[idx] }))
    .filter((p) => adjustedChanges[p.idx] + totalAdjustment / players.length > 0)

  if (playersWhoCanReceiveAdjustment.length > 0) {
    const adjustmentPerPlayer = totalAdjustment / playersWhoCanReceiveAdjustment.length
    playersWhoCanReceiveAdjustment.forEach((p) => {
      adjustedChanges[p.idx] -= adjustmentPerPlayer
    })
  }

  return adjustedChanges
}
