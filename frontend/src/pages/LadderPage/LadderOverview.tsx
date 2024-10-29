// src/pages/LadderPage/LadderOverview.tsx

import { Box } from '@mui/material'
import { useParams } from 'react-router-dom'
import { LadderGameTypeSelector } from './LadderGameTypeSelector'
import { PlayerInfoHeader } from './PlayerInfoHeader'

export const LadderOverview = () => {
    const { playerID } = useParams<{ playerID: string }>()

    if (!playerID) {
        return null
    }

    return (
        <Box>
            <PlayerInfoHeader playerID={playerID} />
            <Box sx={{ mt: 3 }}>
                <LadderGameTypeSelector playerID={playerID} />
            </Box>
        </Box>
    )
}