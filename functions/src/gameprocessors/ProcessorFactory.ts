// functions/src/gameprocessors/ProcessorFactory.ts

import { Transaction } from "firebase-admin/firestore"
import { Turn, Move, GameState } from "@shared/types/Game"
import { Connect4Processor } from "./Connect4Processor"
import { LongboiProcessor } from "./LongboiProcessor"
import { GameProcessor } from "./GameProcessor"
import { TacticToesProcessor } from "./TacticToesProcessor"
import { SnekProcessor } from "./SnekProcessor"

export function getGameProcessor(
  gameState: GameState,
  gameType: string,
): GameProcessor | null {
  switch (gameType) {
    case "connect4":
      return new Connect4Processor(gameState)
    // case "longboi":
    //   return new LongboiProcessor(transaction, gameID, latestMoves, currentTurn)
    // case "tactictoes":
    //   return new TacticToesProcessor(
    //     transaction,
    //     gameID,
    //     latestMoves,
    //     currentTurn,
    //   )
    // case "snek":
    //   return new SnekProcessor(transaction, gameID, latestMoves, currentTurn)
    default:
      console.error(`Unsupported game type: ${gameType}`)
      return null
  }
}
