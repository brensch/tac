import React from "react"

import { Button, Typography } from "@mui/material"

import { useGameStateContext } from "../../context/GameStateContext"
import EmojiRain from "./EmojiRain"
import { useNavigate } from "react-router-dom"

const GameFinished: React.FC = () => {
  const { gameState, playerInfos } = useGameStateContext()
  const navigate = useNavigate()
  if (!gameState) return

  const { winner } = gameState
  const winnerInfo = playerInfos.find((p) => p.id === winner)
  const winnerEmoji = winnerInfo?.emoji || ""

  if (winner === "") return
  return (
    <>
      <Typography variant="h5" color="primary" sx={{ my: 2 }}>
        Game Over!{" "}
        {winner === "-1"
          ? "Nobody made a move"
          : `Winner: ${winnerInfo?.nickname || winner}`}
      </Typography>
      {gameState.nextGame !== "" && (
        <Button
          sx={{ my: 2, zIndex: 10000000, bgcolor: "green" }}
          fullWidth
          onClick={() => navigate(`/game/${gameState.nextGame}`)}
        >
          Play again?
        </Button>
      )}
      {/* Emoji Rain Effect */}
      {winnerEmoji && <EmojiRain emoji={winnerEmoji} />}
    </>
  )
}

export default GameFinished
