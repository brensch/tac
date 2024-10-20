import React from "react"
import { GameStateProvider } from "../../context/GameStateContext"
import GameActive from "./GameActive"
import GameHeader from "./GameHeader"
import GameSetup from "./GameSetup"
import GameFinished, { PlayerResult } from "./GameFinished"
import { useParams } from "react-router-dom"
import EmojiRain from "./EmojiRain"

const GamePage: React.FC = () => {
  const { sessionName, gameID } = useParams<{
    sessionName: string
    gameID: string
  }>()

  // If no gameID is passed, do nothing
  if (!gameID || !sessionName) return null

  // const sortedPlayers = playersWithScores.sort((a, b) => b.score - a.score)
  // const topPlayer: PlayerResult | null =
  //   sortedPlayers.length > 0 ? sortedPlayers[0] : null
  // const draw =
  //   sortedPlayers.length > 1 &&
  //   sortedPlayers[0].score === sortedPlayers[1].score

  return (
    <GameStateProvider key={gameID} gameID={gameID} sessionName={sessionName}>
      <GameHeader />
      <GameFinished />
      <GameSetup />
      <GameActive />
      <EmojiRain
        emoji={"💩"}
        top={-20} // Start emoji rain from the top
      />
    </GameStateProvider>
  )
}

export default GamePage
