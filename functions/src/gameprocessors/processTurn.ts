import {
  Transaction,
  QuerySnapshot,
  DocumentData,
  Timestamp,
  FieldValue,
} from "firebase-admin/firestore"
import {
  Move,
  GameState,
  MoveStatus,
  PlayerRanking,
  GameResult,
  Player,
  Winner,
} from "@shared/types/Game"
import { getGameProcessor } from "./ProcessorFactory"
import { logger } from "../logger"
import { createNewGame } from "../utils/createNewGame"
import * as admin from "firebase-admin"

interface PlayerUpdateData {
  ref: FirebaseFirestore.DocumentReference
  newRanking: PlayerRanking
  shouldCreate: boolean
}

interface PlayerData {
  id: string
  ref: FirebaseFirestore.DocumentReference
  data: Player | null
  currentMMR: number
  gamesPlayed: number
  exists: boolean
}

// Modified constants
const DEFAULT_MMR = 1000
const MIN_MMR = 0 // Minimum MMR value

async function preparePlayerUpdates(
  transaction: Transaction,
  sessionID: string,
  gameID: string,
  gameState: GameState,
  winners: Winner[]
): Promise<PlayerUpdateData[]> {
  const playerIDs = gameState.setup.gamePlayers.map((p) => p.id)
  const playerRefs = playerIDs.map((id) =>
    admin.firestore().collection("users").doc(id)
  )

  const playerDocs = await Promise.all(playerRefs.map((ref) => transaction.get(ref)))

  const playerData: PlayerData[] = playerDocs.map((doc) => {
    const data = doc.data() as Player | undefined
    const ranking = data?.ranking
    return {
      id: doc.id,
      ref: doc.ref,
      data: data ?? null,
      currentMMR: ranking?.currentMMR ?? DEFAULT_MMR,
      gamesPlayed: ranking?.gamesPlayed ?? 0,
      exists: doc.exists,
    }
  })

  // Map of playerID to placement
  const placementsMap = new Map<string, number>()
  winners.forEach((winner, index) => {
    placementsMap.set(winner.playerID, index + 1)
  })
  playerIDs.forEach((id) => {
    if (!placementsMap.has(id)) {
      placementsMap.set(id, winners.length + 1)
    }
  })

  // Get the list of placements in the same order as playerData
  const placements: number[] = playerData.map((player) => placementsMap.get(player.id)!)

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

    const existingRanking = player.data?.ranking ?? {
      currentMMR: DEFAULT_MMR,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      gameHistory: [],
      lastUpdated: Timestamp.fromMillis(now),
    }

    const gameHistory = [...existingRanking.gameHistory, gameResult].slice(-100)

    const newRanking: PlayerRanking = {
      currentMMR: newMMR,
      gamesPlayed: existingRanking.gamesPlayed + 1,
      wins: existingRanking.wins + (placement === 1 ? 1 : 0),
      losses: existingRanking.losses + (placement !== 1 ? 1 : 0),
      gameHistory,
      lastUpdated: FieldValue.serverTimestamp(),
    }

    updates.push({
      ref: player.ref,
      newRanking,
      shouldCreate: !player.exists,
    })

    logger.info(`Preparing ranking update for player ${player.id}`, {
      previousMMR: player.currentMMR,
      newMMR: newRanking.currentMMR,
      mmrChange,
      placement,
      gamesPlayed: player.gamesPlayed,
      creating: !player.exists,
    })
  }

  return updates
}

export const calculateMMRChanges = (
  players: { mmr: number; gamesPlayed: number }[],
  placements: number[]
): number[] => {
  const totalPlayers = players.length
  const mmrChanges: number[] = []

  // First, calculate initial MMR changes
  players.forEach((player, idx) => {
    const opponentPlayers = players.filter((_, i) => i !== idx)
    const opponentMMRs = opponentPlayers.map((p) => p.mmr)
    const numOpponents = opponentMMRs.length

    // Expected score
    let expectedWins = 0
    opponentMMRs.forEach((opponentMMR) => {
      const mmrDiff = player.mmr - opponentMMR
      const winProb = 1 / (1 + Math.pow(10, -mmrDiff / 400))
      expectedWins += winProb
    })
    const expectedScore = expectedWins / numOpponents

    // Actual score
    const placement = placements[idx]
    const actualWins = totalPlayers - placement
    const actualScore = actualWins / numOpponents

    // Base K-factor
    const BASE_K = 32

    // Adjust K-factor based on games played (new players get bigger adjustments)
    const MIN_GAMES_FOR_STABLE_K = 30
    const experienceMultiplier =
      1 + Math.max(0, (MIN_GAMES_FOR_STABLE_K - player.gamesPlayed) / MIN_GAMES_FOR_STABLE_K)

    // Adjusted K-factor
    const adjustedK = BASE_K * experienceMultiplier

    // MMR change
    let mmrChange = adjustedK * (actualScore - expectedScore)
    mmrChanges.push(mmrChange)
  })

  // Now, adjust MMR changes to prevent MMR from going below MIN_MMR
  const adjustedMMRChanges = adjustMMRChangesForMinMMR(players, mmrChanges, MIN_MMR)

  // Ensure zero-sum MMR changes
  const finalMMRChanges = adjustMMRChangesToZeroSum(adjustedMMRChanges)

  // Round the MMR changes
  return finalMMRChanges.map((change) => Math.round(change))
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

// Adjust MMR changes to zero-sum
function adjustMMRChangesToZeroSum(mmrChanges: number[]): number[] {
  const totalChange = mmrChanges.reduce((sum, change) => sum + change, 0)
  const adjustment = -totalChange / mmrChanges.length
  return mmrChanges.map((change) => change + adjustment)
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
      logger.error("got no turns in move. problem")
      return
    }

    const latestTurnNumber = gameState.turns.length - 1
    if (latestTurnNumber !== turnNumber) {
      logger.error(
        "got asked to process previous turn",
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
      logger.warn("game already finished.")
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
          move.timestamp instanceof Timestamp ? move.timestamp.toMillis() : 0
        return moveTime <= latestAllowedTime
      })
      .sort((a, b) => {
        const aTime =
          a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0
        const bTime =
          b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0
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
      throw `processor not known: ${gameState.setup.gameType}`
    }

    const nextTurn = await processor.applyMoves(currentTurn, latestMoves)
    const now = Date.now()
    const turnDurationMillis = gameState.setup.maxTurnTime * 1000
    const endTime = new Date(now + turnDurationMillis)

    nextTurn.startTime = Timestamp.fromMillis(now)
    nextTurn.endTime = Timestamp.fromDate(endTime)

    if (nextTurn.winners.length > 0) {
      // Prepare all player ranking updates (reads)
      const playerUpdates = await preparePlayerUpdates(
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

      // Update or create all player rankings
      playerUpdates.forEach((update) => {
        if (update.shouldCreate) {
          // Create new player document with initial data
          transaction.create(update.ref, {
            id: update.ref.id,
            name:
              gameState.setup.gamePlayers.find((p) => p.id === update.ref.id)
                ?.id ?? update.ref.id,
            emoji: "🎮", // Default emoji
            colour: "#000000", // Default color
            createdAt: FieldValue.serverTimestamp(),
            ranking: update.newRanking,
          })
        } else {
          // Update existing player document
          transaction.update(update.ref, {
            ranking: update.newRanking,
          })
        }
      })

      // Create new game
      await createNewGame(transaction, sessionID, gameState.setup)

      logger.info(`Game ${gameID} finished and rankings updated.`, {
        winners: nextTurn.winners,
      })
    } else {
      // Normal turn update
      transaction.update(gameStateRef, {
        turns: FieldValue.arrayUnion(nextTurn),
      })

      const moveNumber = gameState.turns.length
      const moveStatusRef = admin
        .firestore()
        .collection(`sessions/${sessionID}/games/${gameID}/moveStatuses`)
        .doc(`${moveNumber}`)
      const moveStatus: MoveStatus = {
        moveNumber: moveNumber,
        alivePlayerIDs: nextTurn.alivePlayers,
        movedPlayerIDs: [],
      }
      transaction.set(moveStatusRef, moveStatus)
    }
  } catch (error) {
    logger.error(
      `Error processing turn ${turnNumber} for game ${gameID}:`,
      error
    )
    throw error
  }
}
