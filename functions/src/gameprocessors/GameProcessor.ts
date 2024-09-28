// functions/src/gameprocessors/GameProcessor.ts

import { Transaction } from "firebase-admin/firestore"
import { Turn, Move, Winner, GameState } from "@shared/types/Game"

/**
 * Abstract base class for all game processors.
 * Defines the required methods each processor must implement.
 */
export abstract class GameProcessor {
  protected transaction: Transaction
  protected gameID: string
  protected currentTurn?: Turn
  protected latestMoves: Move[]

  constructor(
    transaction: Transaction,
    gameID: string,
    latestMoves: Move[],
    currentTurn?: Turn,
  ) {
    this.transaction = transaction
    this.gameID = gameID
    this.currentTurn = currentTurn
    this.latestMoves = latestMoves
  }

  /**
   * Initializes the game by setting up the board and creating the first turn.
   */
  abstract initializeGame(gameState: GameState): Promise<void>

  /**
   * Applies the latest moves to the game board.
   */
  abstract applyMoves(): Promise<void>

  /**
   * Determines if any player has met the win condition.
   * @returns An array of Winner objects.
   */
  abstract findWinners(): Promise<Winner[]>
}
