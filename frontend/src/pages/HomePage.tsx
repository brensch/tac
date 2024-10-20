import { Box, Button, Stack, Typography } from "@mui/material"
import React, { ChangeEvent, useState } from "react"
import { useNavigate } from "react-router-dom"
import { RotatingEmoji } from "../components/EmojiCycler"
import TypingEffectInput from "../components/TypingEffectInput"
import { useUser } from "../context/UserContext"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [sessionName, setSessionName] = useState("")
  const [error, setError] = useState("")
  const { colour } = useUser()

  const handleSessionNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const lowercaseValue = e.target.value.toLowerCase().replace(/[^a-z]/g, "")
    setSessionName(lowercaseValue)
  }

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
    <Stack
      sx={{
        minHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Typography pt={10} variant="h4" align="left" gutterBottom>
          Games entirely unrelated to toes*
        </Typography>
        <Typography pt={2} variant="body2" align="left" gutterBottom>
          Pick a word for your session. If you want to play with someone, use
          the same word.
        </Typography>
        <form onSubmit={handleNewGame} style={{ width: "100%" }}>
          <Box display="flex" alignItems="center" mt={3}>
            <TypingEffectInput
              value={sessionName}
              onChange={handleSessionNameChange}
              colour={colour}
            />
          </Box>
          <Button
            type="submit"
            fullWidth
            sx={{
              mt: 2,
              fontSize: "32px",
              backgroundColor: colour,
              color: "black",
              "&:hover": {
                backgroundColor: colour,
                opacity: 0.8,
              },
            }}
          >
            Play{"\u00A0"}
            <RotatingEmoji />
          </Button>
        </form>
        <Typography sx={{ pt: 2 }} color="error">
          {error}
        </Typography>
      </Box>

      <Box sx={{ mt: "auto", mb: 5 }}>
        <Box
          sx={{
            border: "2px solid",
            borderImage:
              "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet) 1",
            borderRadius: 0,
            py: 1,
            my: 2,
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

        <Box>
          <Typography variant="body1" align="left">
            * Toes may be involved
          </Typography>
          <Typography variant="body1" align="left">
            A game by brendan
          </Typography>
        </Box>
      </Box>
    </Stack>
  )
}

export default HomePage
