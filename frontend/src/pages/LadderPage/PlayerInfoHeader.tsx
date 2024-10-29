// src/pages/LadderPage/PlayerInfoHeader.tsx

import {
    Box,
    Typography
} from '@mui/material'
import React, { useEffect, useState } from 'react'
import { EmojiCycler } from '../../components/EmojiCycler'
import { usePlayerInfo } from './usePlayerInfo'

interface Props {
    playerID: string
}

export const PlayerInfoHeader: React.FC<Props> = ({ playerID }) => {
    const { players } = usePlayerInfo([playerID])
    const [showLoading, setShowLoading] = useState(true)
    const player = players[playerID]

    useEffect(() => {
        if (player) {
            setShowLoading(false)
        }
    }, [player])

    // Show loading state
    if (!player && showLoading) {
        return (
            <Box
                sx={{
                    p: 2,
                    border: '2px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    height: "70px",
                }}
            >
                <EmojiCycler fontSize="2rem" />
                <Typography variant="h5">Loading...</Typography>
            </Box>
        )
    }

    // Only show player if we have data
    if (!player) {
        return null
    }

    return (
        <Box
            sx={{
                p: 2,
                backgroundColor: player.colour || 'inherit',
                display: 'flex',
                height: "70px",
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
                >
                    {player.emoji}
                </Typography>
            )}
            <Typography
                variant="h5"
            >
                {player.name}
            </Typography>
        </Box>
    )
}