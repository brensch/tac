// functions/src/gameprocessors/ProcessorFactory.ts

import { GameSetup } from "@shared/types/Game"
import { Connect4Processor } from "./Connect4Processor"
import { GameProcessor } from "./GameProcessor"
import { SnekProcessor } from "./SnekProcessor"
import { LongboiProcessor } from "./LongboiProcessor"
import { TacticToesProcessor } from "./TacticToesProcessor"

export function getGameProcessor(gameSetup: GameSetup): GameProcessor | null {
  switch (gameSetup.gameType) {
    case "connect4":
      return new Connect4Processor(gameSetup)
    case "longboi":
      return new LongboiProcessor(gameSetup)
    case "tactictoes":
      return new TacticToesProcessor(gameSetup)
    case "snek":
      return new SnekProcessor(gameSetup)
    default:
      console.error(`Unsupported game type: ${gameSetup.gameType}`)
      return null
  }
}
