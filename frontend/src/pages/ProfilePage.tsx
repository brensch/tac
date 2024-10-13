import React, { useState, useEffect } from "react"
import { useUser } from "../context/UserContext"
import { Container, Box, TextField, Button, Typography } from "@mui/material"
import { HuePicker, ColorResult } from "react-color"
import { getRandomColor, hexToHSL, hslToHex } from "../utils/colourUtils"
import { emojiList } from "@shared/types/Emojis"
import { auth, provider } from "../firebaseConfig" // Import Firebase and the Google provider
import { linkWithPopup, signOut } from "firebase/auth"

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
  const {
    name: initialName,
    emoji: initialEmoji,
    colour: initialColour,
  } = useUser()

  const fixedSaturation = 60
  const fixedLightness = 70

  const [name, setName] = useState<string>(initialName)
  const [selectedColour, setSelectedColour] = useState<string>(
    getRandomColor(initialColour),
  )
  const [selectedEmoji, setSelectedEmoji] = useState<string>(initialEmoji)
  const [displayedEmojis, setDisplayedEmojis] = useState<string[]>([])
  const [error, setError] = useState<string | null>()

  const { h: initialHue } = hexToHSL(selectedColour)
  const [hue, setHue] = useState<number>(initialHue)

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
    const newColor = hslToHex(hue, fixedSaturation, fixedLightness)
    setSelectedColour(newColor)
    setUpdatedColour(newColor)
  }, [hue, fixedSaturation, fixedLightness, setUpdatedColour])

  const handleEmojiClick = (emoji: string) => {
    setSelectedEmoji(emoji)
    setUpdatedEmoji(emoji)
  }

  const handleHueChange = (color: ColorResult) => {
    setHue(color.hsl.h)
  }

  // Function to handle connecting Google Account to anonymous account
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

        {/* HuePicker with fixed brightness and saturation */}
        <Box
          sx={{
            mt: 4,
            width: "100%",
            maxWidth: "600px", // Optional max width for color slider
            display: "flex", // Use flexbox to center the content
            justifyContent: "center", // Center horizontally
            alignItems: "center", // Center vertically if needed
            padding: 2, // Optional padding
          }}
        >
          <HuePicker
            color={selectedColour} // Set the current color
            onChange={handleHueChange} // Handle only hue changes
            width="100%" // Set the width to 100% to make it full width
          />
        </Box>

        {/* Button to link Google Account */}
        {auth.currentUser?.isAnonymous && (
          <Button
            onClick={handleLinkGoogleAccount}
            sx={{ mt: 2, backgroundColor: selectedColour }} // Google blue color
          >
            Connect google
          </Button>
        )}
        <Button
          onClick={async () => {
            await signOut(auth)
            window.location.reload()
          }}
          sx={{ mt: 2, backgroundColor: selectedColour }} // Google blue color
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
