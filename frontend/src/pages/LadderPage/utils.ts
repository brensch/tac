// src/pages/LadderPage/utils.ts

import { GameType, Player } from '@shared/types/Game'
import { PlayerRankings, GameTypeStats } from './types'

export const ordinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export const calculateWinRate = (wins: number, total: number): number => {
    if (total === 0) return 0
    return (wins / total) * 100
}

export const getGameTypeStats = (
    rankings: PlayerRankings
): GameTypeStats[] => {
    return Object.entries(rankings).map(([gameType, ranking]) => ({
        gameType: gameType as GameType,
        currentMMR: ranking.currentMMR,
        gamesPlayed: ranking.gamesPlayed,
        winRate: calculateWinRate(ranking.wins, ranking.gamesPlayed)
    }))
}

export const formatPlayerName = (player: Player | null, fallbackID: string): string => {
    if (!player) return fallbackID
    return `${player.emoji || ''} ${player.name || fallbackID}`.trim()
}