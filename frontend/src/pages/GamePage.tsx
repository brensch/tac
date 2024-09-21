import React from "react"
import { useParams } from "react-router-dom"

const GamePage: React.FC = () => {
  const { gameID } = useParams<{ gameID: string }>()

  return <h1>Game ID: {gameID}</h1>
}

export default GamePage
