import React, { useState, useEffect } from "react"
import { Box, TextField, Button, Typography, Container } from "@mui/material"
import { Refresh } from "@mui/icons-material"
import { emojiList } from "@shared/types/Emojis"
import Wheel from "@uiw/react-color-wheel"

interface SignUpPageProps {
  onSave: (nickname: string, emoji: string, colour: string) => void
}

const SignupPage: React.FC<SignUpPageProps> = ({ onSave }) => {
  const [nickname, setNickname] = useState<string>("")
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
    if (!nickname.trim() || !selectedEmoji) {
      setMessage("Please enter a nickname and select an emoji.")
      return
    }
    onSave(nickname, selectedEmoji, selectedColour)
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
          label="Nickname"
          variant="outlined"
          value={nickname}
          sx={{ mb: 2 }}
          onChange={(e) => setNickname(e.target.value)}
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

// Helper function to generate random color with consistent lightness
const getRandomColor = () => {
  const hue = Math.floor(Math.random() * 360) // Random hue (0-360)
  const saturation = 80 // Fixed saturation
  const lightness = 50 // Fixed lightness for consistent brightness
  return hslToHex(hue, saturation, lightness)
}

const hslToHex = (h: number, s: number, l: number) => {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
    b = 0
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
    b = 0
  } else if (h >= 120 && h < 180) {
    r = 0
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    r = 0
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    g = 0
    b = c
  } else if (h >= 300 && h < 360) {
    r = c
    g = 0
    b = x
  }

  r = Math.round((r + m) * 255)
  g = Math.round((g + m) * 255)
  b = Math.round((b + m) * 255)

  const toHex = (n: number) => n.toString(16).padStart(2, "0")

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
