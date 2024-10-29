// src/pages/LadderPage/LadderGameView.tsx

import { Box, Stack } from '@mui/material'
import { GameType } from '@shared/types/Game'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db } from '../../firebaseConfig'
import { LadderGameTypeLeaderboard } from './LadderGameTypeLeaderboard'
import { LadderGameTypeSelector } from './LadderGameTypeSelector'
import { LadderPlayerStats } from './LadderPlayerStats'
import { LadderPreviousGames } from './LadderPreviousGames'
import { PlayerInfoHeader } from './PlayerInfoHeader'
import { RankingData } from './types'

export const LadderGameView = () => {
    const { playerID, gameType } = useParams<{ playerID: string; gameType: string }>()
    const [ranking, setRanking] = useState<RankingData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!playerID) return

        const rankingRef = doc(db, 'rankings', playerID)
        const unsubscribe = onSnapshot(rankingRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data() as Omit<RankingData, 'playerID'>
                setRanking({ ...data, playerID })
            } else {
                setRanking(null)
            }
            setLoading(false)
        })

        return () => unsubscribe()
    }, [playerID])

    if (!playerID || !gameType) {
        return null
    }

    return (
        <Stack>
            <PlayerInfoHeader playerID={playerID} />
            <Box sx={{ mt: 3 }}>
                <LadderGameTypeSelector
                    playerID={playerID}
                    selectedGameType={gameType as GameType}
                />
            </Box>
            <Box sx={{ mt: 3 }}>
                <LadderPlayerStats
                    ranking={ranking}
                    gameType={gameType}
                    loading={loading}
                />
            </Box>
            <Box sx={{ mt: 3 }}>
                <LadderGameTypeLeaderboard gameType={gameType} />
            </Box>
            <Box sx={{ mt: 3 }}>
                <LadderPreviousGames playerID={playerID} gameType={gameType} />
            </Box>
        </Stack>
    )
}