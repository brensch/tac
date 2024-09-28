import React from "react"
import { useParams } from "react-router-dom"

import { GameStateProvider } from "../../context/GameStateContext"
import GameActive from "./GameActive"
import GameHeader from "./GameHeader"
import GameSetup from "./GameSetup"
import GameFinished from "./GameFinished"

const GamePage: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()

  if (!gameID) return

  return (
    <GameStateProvider key={gameID} gameID={gameID}>
      <GameHeader />
      <GameFinished />
      <GameSetup />
      <GameActive />
    </GameStateProvider>
  )
}

export default GamePage
