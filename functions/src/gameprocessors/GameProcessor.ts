// functions/src/gameprocessors/GameProcessor.ts

import { Turn, Move, GameSetup, GameState } from "@shared/types/Game"

/**
 * Abstract base class for all game processors.
 * Defines the required methods each processor must implement.
 */
export abstract class GameProcessor {
  protected gameSetup: GameSetup
  protected gameState: GameState

  constructor(gameState: GameState) {
    this.gameSetup = gameState.setup
    this.gameState = gameState
  }

  /**
   * Initializes the game by setting up the board and creating the first turn.
   */
  abstract firstTurn(): Turn

  /**
   * Applies the latest moves to the gameState.
   * Returns the latest turn so it can be added to the doc
   */
  abstract applyMoves(currentTurn: Turn, moves: Move[]): Turn
}
