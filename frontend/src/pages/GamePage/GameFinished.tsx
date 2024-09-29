import React, { useRef, useState, useEffect } from "react"
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
} from "@mui/material"
import { useGameStateContext } from "../../context/GameStateContext"
import EmojiRain from "./EmojiRain"
import { useNavigate } from "react-router-dom"
import { Winner } from "@shared/types/Game"

const GameFinished: React.FC = () => {
  const { gameState, playerInfos } = useGameStateContext()
  const navigate = useNavigate()
  const playAgainButtonRef = useRef<HTMLButtonElement | null>(null)
  const [emojiRainTop, setEmojiRainTop] = useState<number | null>(null)

  useEffect(() => {
    // Set the emoji rain's starting position based on the "Play Again?" button position
    if (playAgainButtonRef.current) {
      const buttonRect = playAgainButtonRef.current.getBoundingClientRect()
      setEmojiRainTop(buttonRect.bottom) // Set the top position just below the button
    }
  }, [])

  // Ensure gameState and playerInfos are available
  if (!gameState || !playerInfos) return null

  const winners: Winner[] = gameState.winners || []

  // If there are no winners, display a message accordingly
  const unFinished = gameState.nextGame === ""
  if (unFinished) return null

  // Build a list of all players with their scores
  const playersWithScores = playerInfos.map((player) => {
    const winner = winners.find((w) => w.playerID === player.id)
    return {
      playerID: player.id,
      nickname: player.nickname,
      emoji: player.emoji,
      score: winner ? winner.score : 0,
    }
  })

  // Sort the players by score in descending order
  const sortedPlayers = playersWithScores.sort((a, b) => b.score - a.score)

  // Get the top player's emoji for the EmojiRain effect
  const topPlayerEmoji = sortedPlayers.length > 0 ? sortedPlayers[0].emoji : ""
  const draw =
    sortedPlayers.length > 1 &&
    sortedPlayers[0].score === sortedPlayers[1].score

  return (
    <>
      {draw ? (
        <>
          <Typography
            variant="h5"
            color="primary"
            sx={{ my: 2, textAlign: "center" }}
          >
            Game Over! Nobody made a move.
          </Typography>
          {gameState.nextGame !== "" && (
            <Button
              ref={playAgainButtonRef}
              sx={{ my: 2, zIndex: 10000000, bgcolor: "green" }}
              variant="contained"
              fullWidth
              onClick={() => navigate(`/game/${gameState.nextGame}`)}
            >
              Play Again?
            </Button>
          )}
        </>
      ) : (
        <>
          <Typography
            variant="h5"
            color="primary"
            sx={{ my: 2, textAlign: "center" }}
          >
            Game Over!
          </Typography>

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
              ref={playAgainButtonRef}
              sx={{ my: 2, zIndex: 10000000, bgcolor: "green" }}
              variant="contained"
              fullWidth
              onClick={() => navigate(`/game/${gameState.nextGame}`)}
            >
              Play Again?
            </Button>
          )}

          {/* Emoji Rain Effect for Top Player */}
          {topPlayerEmoji && emojiRainTop !== null && (
            <EmojiRain emoji={topPlayerEmoji} top={emojiRainTop} />
          )}
        </>
      )}
    </>
  )
}

export default GameFinished
