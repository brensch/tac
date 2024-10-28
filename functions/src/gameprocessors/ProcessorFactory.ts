// functions/src/gameprocessors/ProcessorFactory.ts

import { GameState } from "@shared/types/Game"
import { ColorClashProcessor } from "./ColourClash"
import { Connect4Processor } from "./Connect4Processor"
import { GameProcessor } from "./GameProcessor"
import { LongboiProcessor } from "./LongboiProcessor"
import { ReversiProcessor } from "./Reversi"
import { SnekProcessor } from "./SnekProcessor"
import { TacticToesProcessor } from "./TacticToesProcessor"

export function getGameProcessor(gameState: GameState): GameProcessor | null {
  switch (gameState.setup.gameType) {
    case "connect4":
      return new Connect4Processor(gameState)
    case "longboi":
      return new LongboiProcessor(gameState)
    case "tactictoes":
      return new TacticToesProcessor(gameState)
    case "snek":
      return new SnekProcessor(gameState)
    case "colourclash":
      return new ColorClashProcessor(gameState)
    case "reversi":
      return new ReversiProcessor(gameState)
    default:
      console.error(`Unsupported game type: ${gameState.setup.gameType}`)
      return null
  }
}
