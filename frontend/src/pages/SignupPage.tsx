import React, { useState, useEffect } from "react"
import { Box, TextField, Button, Typography, Container } from "@mui/material"
import { Refresh } from "@mui/icons-material"
import { emojiList } from "@shared/types/Emojis"
import Wheel from "@uiw/react-color-wheel"
import { getRandomColor } from "../utils/colourUtils"

interface SignUpPageProps {
  onSave: (name: string, emoji: string, colour: string) => void
}

const SignupPage: React.FC<SignUpPageProps> = ({ onSave }) => {
  const [name, setName] = useState<string>("")
  const [selectedEmoji, setSelectedEmoji] = useState<string>("")
  const [message, setMessage] = useState<string>("")
  const [displayedEmojis, setDisplayedEmojis] = useState<string[]>([])
  const [selectedColour, setSelectedColour] = useState<string>(getRandomColor())

  const randomizeEmojis = () => {
    const shuffledEmojis = [...emojiList].sort(() => 0.5 - Math.random())
    const filteredEmojis = shuffledEmojis.filter(
      (emoji) => emoji !== selectedEmoji,
    )
    if (selectedEmoji === "") {
      return setDisplayedEmojis(shuffledEmojis.slice(0, 12))
    }
    setDisplayedEmojis([selectedEmoji, ...filteredEmojis.slice(0, 11)])
  }

  useEffect(() => {
    randomizeEmojis()
  }, [])

  const handleSubmit = () => {
    if (!name.trim() || !selectedEmoji) {
      setMessage("Please enter a name and select an emoji.")
      return
    }
    onSave(name, selectedEmoji, selectedColour)
  }

  return (
    <Container sx={{ mt: 1 }}>
      <Box
        width="100%"
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <Typography variant="h4" sx={{ my: 4 }}>
          Hi. Glad you're here.
        </Typography>
        <TextField
          label="Name"
          variant="outlined"
          value={name}
          sx={{ mb: 2 }}
          onChange={(e) => setName(e.target.value)}
          fullWidth
        />

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            justifyContent: "center",
            my: 2,
          }}
        >
          {displayedEmojis.map((emoji) => (
            <Button
              key={emoji}
              variant={selectedEmoji === emoji ? "contained" : "outlined"}
              onClick={() => setSelectedEmoji(emoji)}
              sx={{ fontSize: "2rem", width: "50px", height: "50px" }}
            >
              {emoji}
            </Button>
          ))}
        </Box>
        <Button
          onClick={randomizeEmojis}
          startIcon={<Refresh />}
          sx={{ mt: 2 }}
        >
          New emojis please.
        </Button>
        {/* Colour Picker using Wheel */}
        <Box sx={{ mt: 4 }}>
          <Wheel
            color={selectedColour}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(color: any) => setSelectedColour(color.hex)}
          />
        </Box>

        {message && (
          <Typography color="success" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
        {message && (
          <Typography color="error" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}

        <Button
          onClick={handleSubmit}
          sx={{ mt: 2, backgroundColor: selectedColour }}
        >
          Let's go
        </Button>
      </Box>
    </Container>
  )
}

export default SignupPage
