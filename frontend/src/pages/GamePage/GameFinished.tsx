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
}

const GameFinished: React.FC = () => {
  const { gameState, players, latestTurn, sessionName, session } =
    useGameStateContext()
  const { colour } = useUser()
  const navigate = useNavigate()
  const [sortedPlayers, setSortedPlayers] = useState<PlayerResult[]>([])
  useEffect(() => {
    if (!latestTurn) return
    const winners: Winner[] = latestTurn.winners || []
    // Build a list of all players with their scores
    const playersWithScores = winners.map((player) => {
      const winner = players.find((w) => w.id === player.playerID)
      return {
        playerID: player.playerID,
        name: winner?.name,
        emoji: winner?.emoji,
        score: player.score,
      }
    })

    // Sort the players by score in descending order
    const sortedPlayers = playersWithScores.sort((a, b) => b.score - a.score)

    setSortedPlayers(sortedPlayers)
  }, [players])
  // Ensure gameState and players are available
  if (!gameState || !players || !latestTurn) return null

  // Get the top player's emoji for the EmojiRain effect
  const topPlayer: PlayerResult | null =
    sortedPlayers.length > 0 ? sortedPlayers[0] : null
  const draw =
    sortedPlayers.length > 1 &&
    sortedPlayers[0].score === sortedPlayers[1].score

  // If there are no winners, display a message accordingly
  const unFinished = latestTurn.winners.length === 0
  if (unFinished) return null

  return (
    <>
      <Box
        sx={{
          position: "relative",
          zIndex: 9999999, // Ensures this section stays on top
          backgroundColor: "white", // Blocks out the EmojiRain
          padding: 2,
          border: "2px solid black",
          my: 2,
        }}
      >
        {draw ? (
          <>
            <Typography
              variant="h5"
              color="primary"
              sx={{ my: 2, textAlign: "left" }}
            >
              It's a draw. Lame.
            </Typography>
          </>
        ) : (
          <>
            <Typography
              variant="h5"
              color="primary"
              sx={{ my: 2, textAlign: "left" }}
            >
              {topPlayer?.name} won. Nice.
            </Typography>
          </>
        )}
        {/* Table of Players and Scores */}
        <TableContainer sx={{ maxWidth: 600, margin: "auto", my: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">
                  <strong>Rank</strong>
                </TableCell>
                <TableCell align="left">
                  <strong>Player</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Score</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPlayers.map((player, index) => (
                <TableRow key={player.playerID}>
                  <TableCell align="center">{index + 1}</TableCell>
                  <TableCell align="left">
                    {player.emoji} {player.name}
                  </TableCell>
                  <TableCell align="right">{player.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {/* "Play Again?" Button */}
        <Button
          sx={{ my: 2, bgcolor: colour }}
          variant="contained"
          fullWidth
          onClick={() =>
            navigate(`/session/${sessionName}/${session?.latestGameID}`)
          }
        >
          That was fun. Again.
        </Button>
      </Box>

      {/* Emoji Rain Effect for Top Player */}
      {topPlayer && !draw && (
        <EmojiRain
          emoji={topPlayer.emoji }
        />
      )}
    </>
  )
}

export default GameFinished
