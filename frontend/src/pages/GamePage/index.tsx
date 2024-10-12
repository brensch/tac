import React from "react"
import { GameStateProvider } from "../../context/GameStateContext"
import GameActive from "./GameActive"
import GameHeader from "./GameHeader"
import GameSetup from "./GameSetup"
import GameFinished from "./GameFinished"

// Define the props for the component
interface GamePageProps {
  gameID: string
  sessionName: string
}

const GamePage: React.FC<GamePageProps> = ({ gameID, sessionName }) => {
  // If no gameID is passed, do nothing
  if (!gameID) return null

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
