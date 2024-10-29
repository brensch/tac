// src/pages/LadderPage/LadderGameTypeLeaderboard.tsx

import React from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { formatPlayerName } from './utils'
import { usePlayerInfo } from './usePlayerInfo'
import { useLadder } from './LadderContext'
import { EmojiCycler } from '../../components/EmojiCycler'

interface Props {
  gameType: string
}

export const LadderGameTypeLeaderboard: React.FC<Props> = ({ gameType }) => {
  const navigate = useNavigate()
  const { globalRankings, loadingGlobal } = useLadder()
  const rankings = globalRankings[gameType] ?? []
  const { players, loadingPlayers } = usePlayerInfo(
    rankings.map(r => r.playerID)
  )

  if (loadingGlobal || loadingPlayers) {
    <EmojiCycler fontSize="2rem" />
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
            {rankings.slice(0, 10).map((ranking, index) => {
              const player = players[ranking.playerID]
              const gameRanking = ranking.rankings[gameType]
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
                  <TableCell>{gameRanking.currentMMR}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}