import { Box, Button, Container, TextField, Typography } from "@mui/material"
import { emojiList } from "@shared/types/Emojis"
import { linkWithPopup, signOut } from "firebase/auth"
import React, { useEffect, useState } from "react"
import { ColorResult, HuePicker } from "react-color"
import { useUser } from "../context/UserContext"
import { auth, provider } from "../firebaseConfig"
import { generateColor } from "../utils/colourUtils"
import { useNavigate } from "react-router-dom"

interface ProfilePageProps {
  setUpdatedName: (name: string) => void
  setUpdatedColour: (colour: string) => void
  setUpdatedEmoji: (emoji: string) => void
  handleProfileClose: () => void
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  setUpdatedName,
  setUpdatedColour,
  setUpdatedEmoji,
  handleProfileClose
}) => {
  const {
    name: initialName,
    emoji: initialEmoji,
    colour: initialColour,
  } = useUser()

  const [name, setName] = useState<string>(initialName)
  const [hue, setHue] = useState<number>(() => {
    // Extract hue from HSL color string
    const hslMatch = initialColour.match(
      /hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/,
    )
    if (hslMatch) {
      return parseFloat(hslMatch[1])
    }
    return 0 // Default hue if parsing fails
  })
  const [selectedColour, setSelectedColour] = useState<string>(initialColour)
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

  const navigate = useNavigate()

  useEffect(() => {
    randomizeEmojis()
  }, [])

  useEffect(() => {
    setUpdatedName(name)
  }, [name, setUpdatedName])

  useEffect(() => {
    // Generate new color in HSL format
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
        <Button
          color="primary"
          onClick={() => {
            navigate(`/bots`)
            handleProfileClose()

          }}
          sx={{ mt: 2, background: selectedColour }}
        >
          Bots 🤖
        </Button>
        <Button
          color="primary"
          component="a"
          href="https://buy.stripe.com/3cs16x5Ck5Wff9CfYY"
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleProfileClose}
          sx={{ mt: 2, background: selectedColour }}
        >
          Tips 💸
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
