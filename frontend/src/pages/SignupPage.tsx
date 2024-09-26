import React, { useState, useEffect, useCallback } from "react"
import { Box, TextField, Button, Typography, Container } from "@mui/material"
import { Refresh } from "@mui/icons-material"
import { emojiList } from "@shared/types/Emojis"

interface SignUpPageProps {
  onSave: (nickname: string, emoji: string) => void
}

const SignupPage: React.FC<SignUpPageProps> = ({ onSave }) => {
  const [nickname, setNickname] = useState<string>("")
  const [selectedEmoji, setSelectedEmoji] = useState<string>("")
  const [message, setMessage] = useState<string>("")
  const [displayedEmojis, setDisplayedEmojis] = useState<string[]>([])

  const randomizeEmojis = useCallback(() => {
    const shuffledEmojis = [...emojiList].sort(() => 0.5 - Math.random())
    const filteredEmojis = shuffledEmojis.filter(
      (emoji) => emoji !== selectedEmoji,
    )

    if (selectedEmoji === "") {
      setDisplayedEmojis(filteredEmojis.slice(0, 20))
      return
    }

    setDisplayedEmojis([selectedEmoji, ...filteredEmojis.slice(0, 19)])
  }, [selectedEmoji, setDisplayedEmojis])

  useEffect(() => {
    randomizeEmojis()
  }, [randomizeEmojis])

  const handleSubmit = () => {
    if (!nickname.trim() || !selectedEmoji) {
      setMessage("Please enter a nickname and select an emoji.")
      return
    }
    onSave(nickname, selectedEmoji)
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
        {message && (
          <Typography color="error" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
        <Button onClick={handleSubmit} sx={{ mt: 2 }}>
          Let's go
        </Button>
      </Box>
    </Container>
  )
}

export default SignupPage