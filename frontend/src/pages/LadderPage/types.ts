// src/pages/LadderPage/types.ts

import { GameType, GameResult } from '@shared/types/Game'

export interface PlayerRanking {
    currentMMR: number
    gamesPlayed: number
    wins: number
    losses: number
    gameHistory: GameResult[]
}

export interface PlayerRankings {
    [gameType: string]: PlayerRanking
}

export interface RankingData {
    playerID: string
    rankings: PlayerRankings
}

export interface GameTypeStats {
    gameType: GameType
    currentMMR: number
    gamesPlayed: number
    winRate: number
}

export interface LoadingStates {
    player?: boolean
    rankings?: boolean
    history?: boolean
    leaderboard?: boolean
}