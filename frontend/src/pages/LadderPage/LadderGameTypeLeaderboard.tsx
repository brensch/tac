// src/pages/LadderPage/LadderGameTypeLeaderboard.tsx

import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material'
import { collection, onSnapshot } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../firebaseConfig'
import { RankingData } from './types'
import { formatPlayerName } from './utils'
import { usePlayerInfo } from './usePlayerInfo'

interface Props {
  gameType: string
}

export const LadderGameTypeLeaderboard: React.FC<Props> = ({ gameType }) => {
  const navigate = useNavigate()
  const [rankings, setRankings] = useState<RankingData[]>([])
  const [loading, setLoading] = useState(true)
  const { players, loadingPlayers } = usePlayerInfo(
    rankings.map(r => r.playerID)
  )

  useEffect(() => {
    setLoading(true)
    setRankings([])

    const rankingsRef = collection(db, 'rankings')
    const unsubscribe = onSnapshot(rankingsRef, (snapshot) => {
      const newRankings: RankingData[] = []

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<RankingData, 'playerID'>
        if (data.rankings?.[gameType]?.currentMMR !== undefined) {
          newRankings.push({ ...data, playerID: doc.id })
        }
      })

      newRankings.sort((a, b) => {
        const mmrA = a.rankings[gameType]?.currentMMR ?? 0
        const mmrB = b.rankings[gameType]?.currentMMR ?? 0
        return mmrB - mmrA
      })

      setRankings(newRankings.slice(0, 10))
      setLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [gameType])

  if (loading || loadingPlayers) {
    return <CircularProgress />
  }

  if (rankings.length === 0) {
    return <Typography>No rankings available for {gameType}</Typography>
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Top Players</Typography>
      <TableContainer>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '80px' }} />
            <col />
            <col style={{ width: '100px' }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Player</TableCell>
              <TableCell>MMR</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rankings.map((ranking, index) => {
              const player = players[ranking.playerID]
              const gameRanking = ranking.rankings[gameType]

              // Skip if no game ranking exists
              if (!gameRanking) return null

              return (
                <TableRow
                  key={ranking.playerID}
                  sx={{
                    backgroundColor: player?.colour || 'inherit',
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8
                    }
                  }}
                  onClick={() => navigate(`/ladder/${ranking.playerID}`)}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    {formatPlayerName(player, ranking.playerID)}
                  </TableCell>
                  <TableCell>{gameRanking?.currentMMR}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}