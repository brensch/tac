// src/pages/LadderPage/LadderPlayerStats.tsx

import React from 'react'
import {
    Box,
    Typography,
    CircularProgress,
    Stack
} from '@mui/material'
import { RankingData } from './types'
import { calculateWinRate } from './utils'

interface Props {
    ranking: RankingData | null
    gameType: string
    loading?: boolean
}

export const LadderPlayerStats: React.FC<Props> = ({ ranking, gameType, loading = false }) => {
    if (loading) {
        return <CircularProgress />
    }

    if (!ranking || !ranking.rankings[gameType]) {
        return <Typography>No statistics available for {gameType}</Typography>
    }

    const stats = ranking.rankings[gameType]
    const winRate = calculateWinRate(stats.wins, stats.gamesPlayed)

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Game Statistics</Typography>
            <Box
                sx={{
                    border: '2px solid #000',
                    p: 2,
                    transition: 'box-shadow 0.3s ease',
                    backgroundColor: '#fff',
                    '&:hover': {
                        boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                    }
                }}
            >
                <Stack spacing={1}>
                    <Typography variant="h6">{gameType}</Typography>
                    <Typography>MMR: {stats.currentMMR}</Typography>
                    <Typography>Games: {stats.gamesPlayed}</Typography>
                    <Typography>Wins: {stats.wins}</Typography>
                    <Typography>Losses: {stats.losses}</Typography>
                    <Typography>Win Rate: {winRate.toFixed(1)}%</Typography>
                </Stack>
            </Box>
        </Box>
    )
}