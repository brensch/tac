import React, { useState } from "react"
import { Button, TextField, Stack, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"

const JoinPage: React.FC = () => {
  const [gameID, setGameID] = useState("")
  const navigate = useNavigate()

  const handleSubmit = () => {
    if (gameID.trim()) {
      navigate(`/session/${gameID}`)
    }
  }

  return (
    <Stack
      spacing={2}
      direction="column"
      alignItems="center"
      justifyContent="center"
      sx={{ height: "50vh" }}
    >
      <Typography>Missing out on the fun?</Typography>
      <TextField
        label="Session name"
        variant="outlined"
        value={gameID}
        onChange={(e) => setGameID(e.target.value)}
        fullWidth
      />
      <Button
        disabled={gameID === ""}
        color="primary"
        onClick={handleSubmit}
        fullWidth
      >
        Join
      </Button>
    </Stack>
  )
}

export default JoinPage
