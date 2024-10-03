import React, { useState, useEffect } from "react"
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
} from "@mui/material"
import { useGameStateContext } from "../../context/GameStateContext"
import EmojiRain from "./EmojiRain"
import { useNavigate } from "react-router-dom"
import { Winner } from "@shared/types/Game"

interface PlayerResult {
  playerID: string
  nickname: string
  emoji: string
  score: number
}

const GameFinished: React.FC = () => {
  const { gameState, players } = useGameStateContext()
  const navigate = useNavigate()
  const [sortedPlayers, setSortedPlayers] = useState<PlayerResult[]>([])

  useEffect(() => {
    // Build a list of all players with their scores
    const playersWithScores = players.map((player) => {
      const winner = winners.find((w) => w.playerID === player.id)
      return {
        playerID: player.id,
        nickname: player.name,
        emoji: player.emoji,
        score: winner ? winner.score : 0,
      }
    })

    // Sort the players by score in descending order
    const sortedPlayers = playersWithScores.sort((a, b) => b.score - a.score)

    setSortedPlayers(sortedPlayers)
  }, [players])

  // Ensure gameState and players are available
  if (!gameState || !players) return null

  const winners: Winner[] = gameState.winners || []

  // If there are no winners, display a message accordingly
  const unFinished = gameState.nextGame === ""
  if (unFinished) return null

  // Get the top player's emoji for the EmojiRain effect
  const topPlayer: PlayerResult | null =
    sortedPlayers.length > 0 ? sortedPlayers[0] : null
  const draw =
    sortedPlayers.length > 1 &&
    sortedPlayers[0].score === sortedPlayers[1].score

  return (
    <>
      <Box
        sx={{
          position: "relative",
          zIndex: 9999999, // Ensures this section stays on top
          backgroundColor: "white", // Blocks out the EmojiRain
          padding: 2,
          border: "1px solid black",
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
              {topPlayer?.nickname} won. Nice.
            </Typography>
          </>
        )}

        {/* Table of Players and Scores */}
        <TableContainer
          component={Paper}
          sx={{ maxWidth: 600, margin: "auto", my: 2 }}
        >
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
                    {player.emoji} {player.nickname}
                  </TableCell>
                  <TableCell align="right">{player.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* "Play Again?" Button */}
        {gameState.nextGame !== "" && (
          <Button
            sx={{ my: 2, bgcolor: "green" }}
            variant="contained"
            fullWidth
            onClick={() => navigate(`/game/${gameState.nextGame}`)}
          >
            Play Again?
          </Button>
        )}
      </Box>

      {/* Emoji Rain Effect for Top Player */}
      {topPlayer && !draw && (
        <EmojiRain
          emoji={topPlayer.emoji}
          top={-20} // Start emoji rain from the top
        />
      )}
    </>
  )
}

export default GameFinished
