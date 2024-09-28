// functions/src/gameprocessors/ProcessorFactory.ts

import { Transaction } from "firebase-admin/firestore"
import { Turn, Move } from "@shared/types/Game"
import { Connect4Processor } from "./Connect4Processor"
import { LongboiProcessor } from "./LongboiProcessor"
import { GameProcessor } from "./GameProcessor"

export function getGameProcessor(
  transaction: Transaction,
  gameID: string,
  latestMoves: Move[],
  gameType: string,
  currentTurn?: Turn,
): GameProcessor | null {
  switch (gameType) {
    case "connect4":
      return new Connect4Processor(
        transaction,
        gameID,
        latestMoves,
        currentTurn,
      )
    case "longboi":
      return new LongboiProcessor(transaction, gameID, latestMoves, currentTurn)
    default:
      console.error(`Unsupported game type: ${gameType}`)
      return null
  }
}
