import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import { Winner } from "@shared/types/Game"
import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStateContext } from "../../context/GameStateContext"
import { useUser } from "../../context/UserContext"
import EmojiRain from "./EmojiRain"

export interface PlayerResult {
  playerID: string
  name: string | undefined
  emoji: string | undefined
  score: number
  mmr: number | undefined
  mmrBump: number | undefined
  turnsSurvived: number // Add this
}

const GameFinished: React.FC = () => {
  const { gameState, players, latestTurn, sessionName, session } = useGameStateContext()
  const { colour } = useUser()
  const navigate = useNavigate()

  const [sortedPlayers, setSortedPlayers] = useState<PlayerResult[]>([])
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 0 | 1 | 2>>({})
  const [gritResults, setGritResults] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!latestTurn) return
    const winners: Winner[] = latestTurn.winners || []

    const playersWithScores: PlayerResult[] = winners.map((player) => {
      const winner = players.find((w) => w.id === player.playerID)
      return {
        playerID: player.playerID,
        name: winner?.name,
        emoji: winner?.emoji,
        score: player.score,
        mmr: player.newMMR,
        mmrBump: player.mmrChange,
        turnsSurvived: player.turnsSurvived ?? 0, // Needs to be provided
      }
    })

    const sorted = playersWithScores.sort((a, b) => b.score - a.score)
    setSortedPlayers(sorted)

    const initialAssignments = Object.fromEntries(sorted.map(p => [p.playerID, 0]))
    setTeamAssignments(initialAssignments)
  }, [players])

  if (!gameState || !players || !latestTurn) return null
  if (latestTurn.winners.length === 0) return null

  const draw = sortedPlayers.length > 1 && sortedPlayers[0].score === sortedPlayers[1].score
  const topPlayer = sortedPlayers[0]

  const handleClickPlayer = (playerID: string) => {
    setTeamAssignments(prev => ({
      ...prev,
      [playerID]: (prev[playerID] + 1) % 3 as 0 | 1 | 2,
    }))
  }

  const calculateGrit = () => {
    const team1 = sortedPlayers.filter(p => teamAssignments[p.playerID] === 1)
    const team2 = sortedPlayers.filter(p => teamAssignments[p.playerID] === 2)

    const avg = (arr: PlayerResult[]) =>
      arr.length === 0 ? 0 : arr.reduce((sum, p) => sum + p.turnsSurvived, 0) / arr.length

    const avg1 = avg(team1)
    const avg2 = avg(team2)

    const determineOutcome = (team: PlayerResult[]) =>
      team.some(p => p.score > (team === team1 ? avg2 : avg1)) ? "win" :
      team.some(p => p.score < (team === team1 ? avg2 : avg1)) ? "loss" : "draw"

    const newGrits: Record<string, number> = {}
    for (const p of sortedPlayers) {
      const team = teamAssignments[p.playerID]
      if (team === 0) continue

      const myTeam = team === 1 ? team1 : team2
      const oppTeam = team === 1 ? team2 : team1
      const outcome = determineOutcome(myTeam)

      let grit = 0
      if (outcome === "win") grit = -avg(oppTeam)
      else if (outcome === "loss") grit = avg(myTeam)
      else grit = avg(myTeam) - avg(oppTeam)

      newGrits[p.playerID] = parseFloat(grit.toFixed(2))
    }

    setGritResults(newGrits)
  }

  return (
    <>
      <Box
        sx={{
          position: "relative",
          zIndex: 9999999,
          backgroundColor: "white",
          padding: 2,
          border: "2px solid black",
          my: 2,
        }}
      >
        <Typography variant="h5" color="primary" sx={{ my: 2, textAlign: "left" }}>
          {draw ? "It's a draw. Lame." : `${topPlayer?.name} won. Nice.`}
        </Typography>

        <TableContainer sx={{ margin: "auto", my: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Player</strong></TableCell>
                <TableCell align="right"><strong>Score</strong></TableCell>
                <TableCell align="right"><strong>MMR</strong></TableCell>
                <TableCell align="right"><strong>Team</strong></TableCell>
                <TableCell align="right"><strong>Grit</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPlayers.map((player, index) => (
                <TableRow
                  key={player.playerID}
                  hover
                  onClick={() => handleClickPlayer(player.playerID)}
                  sx={{
                    cursor: "pointer",
                    backgroundColor:
                      teamAssignments[player.playerID] === 1
                        ? "#d0f0c0"
                        : teamAssignments[player.playerID] === 2
                          ? "#f0d0d0"
                          : "inherit",
                  }}
                >
                  <TableCell>{index + 1}. {player.emoji} {player.name}</TableCell>
                  <TableCell align="right">{player.score}</TableCell>
                  <TableCell align="right">
                    {player.mmr} ({player.mmrBump})
                  </TableCell>
                  <TableCell align="right">
                    {teamAssignments[player.playerID] || "-"}
                  </TableCell>
                  <TableCell align="right">
                    {gritResults[player.playerID] ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Button sx={{ my: 1 }} variant="outlined" fullWidth onClick={calculateGrit}>
          Calculate Grit
        </Button>

        <Button
          sx={{ my: 2, bgcolor: colour }}
          variant="contained"
          fullWidth
          onClick={() => navigate(`/session/${sessionName}/${session?.latestGameID}`)}
        >
          That was fun. Again.
        </Button>
      </Box>

      {topPlayer && !draw && <EmojiRain emoji={topPlayer.emoji} />}
    </>
  )
}

export default GameFinished
