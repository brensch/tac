import React, { useState, useEffect } from "react"
import { Box, TextField, Button, Typography, Container } from "@mui/material"
import { Refresh } from "@mui/icons-material"
import { emojiList } from "@shared/types/Emojis"
import { ColorResult, HuePicker } from "react-color"
import { generateColor } from "../utils/colourUtils" // Import the new generateColor function
import { signInWithPopup } from "firebase/auth"
import { auth, provider } from "../firebaseConfig"

interface SignUpPageProps {
  onSave: (name: string, emoji: string, colour: string) => void
}

const SignupPage: React.FC<SignUpPageProps> = ({ onSave }) => {
  const [name, setName] = useState<string>("")
  const [selectedEmoji, setSelectedEmoji] = useState<string>("")
  const [message, setMessage] = useState<string>("")
  const [displayedEmojis, setDisplayedEmojis] = useState<string[]>([])
  const [hue, setHue] = useState<number>(Math.floor(Math.random() * 360))
  const [selectedColour, setSelectedColour] = useState<string>(
    generateColor(hue),
  )

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

  const handleHueChange = (color: ColorResult) => {
    setHue(color.hsl.h)
  }

  useEffect(() => {
    const newColor = generateColor(hue)
    setSelectedColour(newColor)
  }, [hue])

  const handleSignInWithGoogle = async () => {
    const user = auth.currentUser
    if (!user) return

    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      setMessage("Failed to connect google.")
      console.error("Error linking Google account:", error)
    }
  }

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
          onChange={(e) => setName(e.target.value)}
          fullWidth
        />
        <Box
          sx={{
            mt: 4,
            width: "100%",
            maxWidth: "600px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            border: "2px solid #000",
            "& .hue-horizontal": {
              borderRadius: "0px !important",
            },
          }}
        >
          <HuePicker
            color={selectedColour}
            onChange={handleHueChange}
            width="100%"
          />
        </Box>

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
              onClick={() => setSelectedEmoji(emoji)}
              sx={{
                fontSize: "2rem",
                width: "50px",
                height: "50px",
                backgroundColor:
                  selectedEmoji === emoji ? selectedColour : "white",
              }}
            >
              {emoji}
            </Button>
          ))}
        </Box>
        <Button
          onClick={randomizeEmojis}
          startIcon={<Refresh />}
          sx={{ mt: 2, backgroundColor: selectedColour }}
        >
          New emojis please.
        </Button>

        {message && (
          <Typography color="error" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}

        {!auth.currentUser?.isAnonymous ? (
          <Typography sx={{ mt: 2 }}>Google connected</Typography>
        ) : (
          <Button
            onClick={handleSignInWithGoogle}
            sx={{ mt: 2, backgroundColor: selectedColour }}
          >
            Connect google
          </Button>
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
