// functions/src/gameprocessors/ProcessorFactory.ts

import { GameSetup } from "@shared/types/Game"
import { Connect4Processor } from "./Connect4Processor"
import { GameProcessor } from "./GameProcessor"

export function getGameProcessor(gameSetup: GameSetup): GameProcessor | null {
  switch (gameSetup.gameType) {
    case "connect4":
      return new Connect4Processor(gameSetup)
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
      console.error(`Unsupported game type: ${gameSetup.gameType}`)
      return null
  }
}
