import React, { useState } from "react"
import { Button, TextField, Stack } from "@mui/material"
import { useNavigate } from "react-router-dom"

const JoinPage: React.FC = () => {
  const [gameID, setGameID] = useState("")
  const navigate = useNavigate()

  const handleSubmit = () => {
    if (gameID.trim()) {
      navigate(`/game/${gameID}`)
    }
  }

  return (
    <Stack
      spacing={2}
      direction="column"
      alignItems="center"
      justifyContent="center"
      sx={{ height: "100vh" }}
    >
      <TextField
        label="Game ID"
        variant="outlined"
        value={gameID}
        onChange={(e) => setGameID(e.target.value)}
      />
      <Button color="primary" onClick={handleSubmit}>
        Submit
      </Button>
    </Stack>
  )
}

export default JoinPage
