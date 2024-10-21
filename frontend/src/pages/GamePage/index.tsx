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

  return (
    <GameStateProvider key={gameID} gameID={gameID} sessionName={sessionName}>
      <GameHeader />
      <GameFinished />
      <GameSetup />
      <GameActive />
    </GameStateProvider>
  )
}

export default GamePage
