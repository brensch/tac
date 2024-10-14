import React, { useState, useEffect } from "react"
import { useUser } from "../context/UserContext"
import { Container, Box, TextField, Button, Typography } from "@mui/material"
import { HuePicker, ColorResult } from "react-color"
import { emojiList } from "@shared/types/Emojis"
import { auth, provider } from "../firebaseConfig"
import { linkWithPopup, signOut } from "firebase/auth"
import { generateColor } from "../utils/colourUtils"

interface ProfilePageProps {
  setUpdatedName: (name: string) => void
  setUpdatedColour: (colour: string) => void
  setUpdatedEmoji: (emoji: string) => void
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  setUpdatedName,
  setUpdatedColour,
  setUpdatedEmoji,
}) => {
  const { name: initialName, emoji: initialEmoji } = useUser()

  const [name, setName] = useState<string>(initialName)
  const [hue, setHue] = useState<number>(Math.floor(Math.random() * 360))
  const [selectedColour, setSelectedColour] = useState<string>(
    generateColor(hue),
  )
  const [selectedEmoji, setSelectedEmoji] = useState<string>(initialEmoji)
  const [displayedEmojis, setDisplayedEmojis] = useState<string[]>([])
  const [error, setError] = useState<string | null>()

  const randomizeEmojis = () => {
    const shuffledEmojis = [...emojiList].sort(() => 0.5 - Math.random())
    const filteredEmojis = shuffledEmojis.filter(
      (emoji) => emoji !== selectedEmoji,
    )
    setDisplayedEmojis([selectedEmoji, ...filteredEmojis.slice(0, 11)])
  }

  useEffect(() => {
    randomizeEmojis()
  }, [])

  useEffect(() => {
    setUpdatedName(name)
  }, [name, setUpdatedName])

  useEffect(() => {
    const newColor = generateColor(hue)
    setSelectedColour(newColor)
    setUpdatedColour(newColor)
  }, [hue, setUpdatedColour])

  const handleEmojiClick = (emoji: string) => {
    setSelectedEmoji(emoji)
    setUpdatedEmoji(emoji)
  }

  const handleHueChange = (color: ColorResult) => {
    setHue(color.hsl.h)
  }

  const handleLinkGoogleAccount = async () => {
    const user = auth.currentUser
    if (!user) return

    try {
      await linkWithPopup(user, provider)
    } catch (error) {
      console.error("Error linking Google account:", error)
      setError("Can't connect your account. Try logging out and logging in.")
    }
  }

  return (
    <Container sx={{ maxWidth: "100%" }}>
      <Box
        width="100%"
        maxWidth="600px"
        display="flex"
        flexDirection="column"
        alignItems="center"
        mx="auto"
      >
        <TextField
          label="Name"
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          sx={{ mt: 1 }}
        />
        <Box
          sx={{
            mt: 2,
            width: "100%",
            maxWidth: "600px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            border: "2px solid #000",
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
            mt: 2,
          }}
        >
          {displayedEmojis.map((emoji) => (
            <Button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
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
          sx={{ mt: 2, background: selectedColour }}
        >
          New emojis please.
        </Button>

        {auth.currentUser?.isAnonymous && (
          <Button
            onClick={handleLinkGoogleAccount}
            sx={{ mt: 2, backgroundColor: selectedColour }}
          >
            Connect google
          </Button>
        )}
        <Button
          onClick={async () => {
            await signOut(auth)
            window.location.reload()
          }}
          sx={{ mt: 2, backgroundColor: selectedColour }}
        >
          Sign out
        </Button>
        {error && (
          <Typography color="error" sx={{ textAlign: "center", mt: 2 }}>
            {error}
          </Typography>
        )}
      </Box>
    </Container>
  )
}

export default ProfilePage
