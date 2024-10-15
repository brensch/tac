import React, { useState } from "react"
import { Box, Button, Stack, TextField, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { RotatingEmoji } from "../components/EmojiCycler"
import { useUser } from "../context/UserContext"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [sessionName, setSessionName] = useState("")
  const [error, setError] = useState("")
  const { colour } = useUser()

  const handleNewGame = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (sessionName === "") {
      setError("Friend, you need a session name.")
      return
    }
    navigate(`/session/${sessionName}`)
  }

  return (
    <Stack alignItems="left">
      <Typography pt={10} variant="h4" align="left" gutterBottom>
        Games entirely unrelated to toes*
      </Typography>
      <Typography pt={2} variant="body2" align="left" gutterBottom>
        Pick a word for your session. If you want to play with someone, use the
        same word.
      </Typography>
      <form onSubmit={handleNewGame} style={{ width: "100%" }}>
        <Box display="flex" alignItems="center" mt={3}>
          <TextField
            fullWidth
            value={sessionName}
            placeholder="Session name"
            onChange={(e) => {
              const lowercaseValue = e.target.value
                .toLowerCase()
                .replace(/[^a-z]/g, "")
              setSessionName(lowercaseValue)
            }}
            sx={{
              flexGrow: 1,
              mr: 2,
              "& .MuiInputBase-root": {
                height: "70px",
                backgroundColor: colour,
              },
              "& .MuiInputBase-input": {
                fontSize: "28px",
                paddingLeft: "16px",
              },
            }}
          />
          <Button
            type="submit"
            sx={{
              height: "70px",
              width: "70px",
              minWidth: "70px",
              fontSize: "32px",
              backgroundColor: colour,
              color: "black",
              "&:hover": {
                backgroundColor: colour,
                opacity: 0.8,
              },
            }}
          >
            <RotatingEmoji />
          </Button>
        </Box>
      </form>
      <Typography sx={{ pt: 2 }} color="error">
        {error}
      </Typography>

      <Box
        sx={{
          position: "absolute",
          bottom: "60px",
          left: 0,
          right: 0,
          border: "2px solid",
          borderImage:
            "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet) 1",
          borderRadius: 0,
          mt: 15,
          mb: 2,
          mx: 1,
          px: 2,
          py: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          component="span"
          role="img"
          aria-label="dancing emoji"
          sx={{ mr: 2, fontSize: "30px" }}
        >
          🕺
        </Box>
        <Typography variant="body2">
          Ugly colour? Uninspired emoji? Edit it in the top right.
        </Typography>
      </Box>

      <Box
        sx={{
          position: "fixed",
          bottom: 10,
          left: 10,
          width: "100%",
        }}
      >
        <Typography variant="body1" align="left">
          * Toes may be involved.
          <br /> A game by brendo
        </Typography>
      </Box>
    </Stack>
  )
}

export default HomePage
