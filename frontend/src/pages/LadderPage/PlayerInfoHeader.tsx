// src/pages/LadderPage/PlayerInfoHeader.tsx

import {
    Box,
    CircularProgress,
    Typography
} from '@mui/material'
import React from 'react'
import { usePlayerInfo } from './usePlayerInfo'

interface Props {
    playerID: string
}

export const PlayerInfoHeader: React.FC<Props> = ({ playerID }) => {
    const { players, loadingPlayers } = usePlayerInfo([playerID])
    const player = players[playerID]

    if (loadingPlayers) {
        return <CircularProgress />
    }

    if (!player) {
        return <Typography>Player not found</Typography>
    }

    return (
        <Box
            sx={{
                p: 2,
                backgroundColor: player.colour || 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                border: '2px solid #000',
                transition: 'box-shadow 0.3s ease',
                '&:hover': {
                    boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                }
            }}
        >
            {player.emoji && (
                <Typography
                    variant="h4"
                    sx={{
                        fontFamily: '"Roboto Mono", monospace',
                        fontWeight: 'bold'
                    }}
                >
                    {player.emoji}
                </Typography>
            )}
            <Typography
                variant="h5"
            >
                {player.name || playerID}
            </Typography>

        </Box>
    )
}