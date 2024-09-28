import React from "react"
import { useParams } from "react-router-dom"

import { GameStateProvider } from "../../context/GameStateContext"
import GameActive from "./components/GameActive"
import GameHeader from "./components/GameHeader"
import GameSetup from "./components/GameSetup"

const GamePage: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()

  if (!gameID) return

  console.log("index")

  return (
    <GameStateProvider gameID={gameID}>
      <></>
      <GameHeader />
      <GameSetup />
      <GameActive />
    </GameStateProvider>
  )
}

export default GamePage
