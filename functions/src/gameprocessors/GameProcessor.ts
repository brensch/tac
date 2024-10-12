// functions/src/gameprocessors/GameProcessor.ts

import { Transaction } from "firebase-admin/firestore"
import { Turn, Move, Winner, GameState } from "@shared/types/Game"

/**
 * Abstract base class for all game processors.
 * Defines the required methods each processor must implement.
 */
export abstract class GameProcessor {
  protected gameState: GameState
  protected currentTurn: Turn | null

  constructor(gameState: GameState) {
    this.gameState = gameState
    this.currentTurn =
      gameState.turns.length > 0
        ? gameState.turns[gameState.turns.length - 1]
        : null
  }

  /**
   * Initializes the game by setting up the board and creating the first turn.
   */
  abstract initializeTurn(): Turn

  /**
   * Applies the latest moves to the gameState.
   * Returns the latest turn so it can be added to the doc
   */
  abstract applyMoves(moves: Move[]): Turn | null

  /**
   * Determines if any player has met the win condition.
   * @returns An array of Winner objects.
   */
  abstract findWinners(): Winner[]
}
