import React from "react"
import { useParams } from "react-router-dom"

import { GameStateProvider } from "../../context/GameStateContext"
import GameActive from "./components/GameActive"
import GameHeader from "./components/GameHeader"
import GameSetup from "./components/GameSetup"
import GameFinished from "./components/GameFinished"

const GamePage: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()

  if (!gameID) return

  return (
    <GameStateProvider gameID={gameID}>
      <></>
      <GameHeader />
      <GameFinished />
      <GameSetup />
      <GameActive />
    </GameStateProvider>
  )
}

export default GamePage
