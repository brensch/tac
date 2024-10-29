// src/pages/LadderPage/LadderPlayerStats.tsx

import {
    Box,
    CircularProgress,
    Typography
} from '@mui/material'
import React from 'react'
import { RankingData } from './types'
import { calculateWinRate } from './utils'

interface StatBoxProps {
    label: string
    value: string | number
    emoji: string
    large?: boolean
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, emoji, large }) => (
    <Box
        sx={{
            border: '2px solid #000',
            p: 2,
            transition: 'box-shadow 0.3s ease',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            height: large ? 180 : 140,
            '&:hover': {
                boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
            }
        }}
    >
        <Typography
            sx={{
                fontSize: large ? '2rem' : '1.5rem',
                mb: 1
            }}
        >
            {emoji}
        </Typography>
        <Typography
            variant={large ? "h3" : "h5"}
            sx={{
                fontWeight: 'bold',
                fontFamily: '"Roboto Mono", monospace',
            }}
        >
            {value}
        </Typography>
        <Typography
            variant="body2"
            sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                opacity: 0.7
            }}
        >
            {label}
        </Typography>
    </Box>
)

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
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2
                }}
            >
                <StatBox
                    label="Current MMR"
                    value={stats.currentMMR}
                    emoji="🏆"
                    large
                />
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 2
                    }}
                >
                    <StatBox
                        label="Win Rate"
                        value={`${winRate.toFixed(1)}%`}
                        emoji="🎯"
                    />
                    <StatBox
                        label="Games"
                        value={stats.gamesPlayed}
                        emoji="🎮"
                    />
                    <StatBox
                        label="Wins"
                        value={stats.wins}
                        emoji="✨"
                    />
                    <StatBox
                        label="Losses"
                        value={stats.losses}
                        emoji="💀"
                    />
                </Box>
            </Box>
        </Box>
    )
}