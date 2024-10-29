// src/pages/LadderPage/LadderPreviousGames.tsx

import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Stack,
} from '@mui/material'
import { GameResult } from '@shared/types/Game'
import { doc, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebaseConfig'
import { RankingData } from './types'
import { usePlayerInfo } from './usePlayerInfo'
import { formatPlayerName, ordinalSuffix } from './utils'
import { EmojiCycler } from '../../components/EmojiCycler'

interface Props {
    playerID: string
    gameType: string
}

const formatDate = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
}

export const LadderPreviousGames: React.FC<Props> = ({ playerID, gameType }) => {
    const navigate = useNavigate()
    const [gameHistory, setGameHistory] = useState<GameResult[]>([])
    const [loading, setLoading] = useState(true)
    const { players, loadingPlayers } = usePlayerInfo(
        gameHistory.flatMap(game => game.opponents.map(opp => opp.playerID))
    )

    useEffect(() => {
        const rankingRef = doc(db, 'rankings', playerID)
        const unsubscribe = onSnapshot(rankingRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data() as RankingData
                const history = data.rankings[gameType]?.gameHistory || []
                setGameHistory([...history].reverse().slice(0, 10))
            } else {
                setGameHistory([])
            }
            setLoading(false)
        })

        return () => unsubscribe()
    }, [playerID, gameType])

    if (loading || loadingPlayers) {
        <EmojiCycler fontSize="2rem" />
    }

    if (gameHistory.length === 0) {
        return <Typography>No game history available.</Typography>
    }

    // Group games by date
    const groupedGames = gameHistory.reduce((acc, game) => {
        const date = game.timestamp.toDate()
        const dateStr = date.toLocaleDateString()
        if (!acc[dateStr]) {
            acc[dateStr] = []
        }
        acc[dateStr].push(game)
        return acc
    }, {} as Record<string, GameResult[]>)

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Recent Games</Typography>
            <TableContainer>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: '100px' }} />
                        <col />
                        <col style={{ width: '80px' }} />
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Opponents</TableCell>
                            <TableCell>Result</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Object.entries(groupedGames).map(([dateStr, games]) => (
                            <React.Fragment key={dateStr}>
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        sx={{
                                            backgroundColor: 'rgba(0,0,0,0.04)',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {dateStr}
                                    </TableCell>
                                </TableRow>
                                {games.map((game) => (
                                    <TableRow key={`${game.sessionID}-${game.gameID}`}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            <a
                                                href={`/session/${game.sessionID}/${game.gameID}`}
                                                style={{ textDecoration: 'none', color: 'inherit' }}
                                            >
                                                {formatDate(game.timestamp.toDate())} 🔗
                                            </a>
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', p: 0 }}>
                                            <Stack >
                                                {game.opponents.map((opp) => {
                                                    const player = players[opp.playerID]
                                                    return (
                                                        <Box
                                                            key={opp.playerID}
                                                            onClick={() => navigate(`/ladder/${opp.playerID}`)}
                                                            sx={{
                                                                cursor: 'pointer',
                                                                '&:hover': {
                                                                    opacity: 0.7
                                                                },
                                                                backgroundColor: player?.colour || 'inherit',
                                                                display: 'inline-block',

                                                            }}
                                                        >
                                                            {formatPlayerName(player, opp.playerID)}
                                                        </Box>
                                                    )
                                                })}
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ p: 1 }}>
                                            {ordinalSuffix(game.placement)}&nbsp;
                                            {game.mmrChange > 0 ? `+${game.mmrChange}` : game.mmrChange}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    )
}