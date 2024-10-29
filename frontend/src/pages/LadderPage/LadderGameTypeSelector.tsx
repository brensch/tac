// src/pages/LadderPage/components/LadderGameTypeSelector.tsx

import React from 'react'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { GameType } from '@shared/types/Game'

interface Props {
  playerID: string
  selectedGameType?: GameType
}

const gameTypes: GameType[] = [
  'snek',
  'connect4',
  'tactictoes',
  'longboi',
  'reversi',
  'colourclash',
]

export const LadderGameTypeSelector: React.FC<Props> = ({
  playerID,
  selectedGameType
}) => {
  const navigate = useNavigate()

  const handleGameTypeChange = (event: SelectChangeEvent<string>) => {
    const gameType = event.target.value as GameType
    navigate(`/ladder/${playerID}/${gameType}`)
  }

  return (
    <FormControl fullWidth>
      <InputLabel id="game-type-select-label">Game Type</InputLabel>
      <Select
        labelId="game-type-select-label"
        value={selectedGameType || ''}
        label="Game Type"
        onChange={handleGameTypeChange}
      >
        <MenuItem value="">
          <em>Select a game type</em>
        </MenuItem>
        {gameTypes.map((type) => (
          <MenuItem key={type} value={type}>
            {type}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}