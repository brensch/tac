import React, { useState, useEffect } from "react"
import { useUser } from "../context/UserContext"
import { Container, Box, TextField, Button, Typography } from "@mui/material"
import Wheel from "@uiw/react-color-wheel"
import { getRandomColor } from "./SignupPage"
import { emojiList } from "@shared/types/Emojis"

interface ProfilePageProps {
  setUpdatedNickname: (nickname: string) => void
  setUpdatedColour: (colour: string) => void
  setUpdatedEmoji: (emoji: string) => void
}

const ProfilePage: React.FC<ProfilePageProps> = ({
  setUpdatedNickname,
  setUpdatedColour,
  setUpdatedEmoji,
}) => {
  const {
    nickname: initialNickname,
    emoji: initialEmoji,
    colour: initialColour,
  } = useUser()

  const [nickname, setNickname] = useState<string>(initialNickname)
  const [selectedColour, setSelectedColour] = useState<string>(
    getRandomColor(initialColour),
  )
  const [selectedEmoji, setSelectedEmoji] = useState<string>(initialEmoji)
  const [displayedEmojis, setDisplayedEmojis] = useState<string[]>([])

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
    setUpdatedNickname(nickname)
  }, [nickname, setUpdatedNickname])

  useEffect(() => {
    setUpdatedColour(selectedColour)
  }, [selectedColour, setUpdatedColour])

  const handleEmojiClick = (emoji: string) => {
    setSelectedEmoji(emoji)
    setUpdatedEmoji(emoji)
  }

  const handleColourChange = (color: any) => {
    setSelectedColour(color.hex)
  }

  return (
    <Container sx={{ m: 1, maxWidth: "100%" }}>
      <Box
        width="100%"
        maxWidth="600px"
        display="flex"
        flexDirection="column"
        alignItems="center"
        mx="auto"
      >
        <TextField
          label="Nickname"
          variant="outlined"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          fullWidth
        />

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            justifyContent: "center",
            mt: 1,
          }}
        >
          {displayedEmojis.map((emoji) => (
            <Button
              key={emoji}
              variant={selectedEmoji === emoji ? "contained" : "outlined"}
              onClick={() => handleEmojiClick(emoji)}
              sx={{ fontSize: "2rem", width: "50px", height: "50px" }}
            >
              {emoji}
            </Button>
          ))}
        </Box>

        <Button onClick={randomizeEmojis} sx={{ mt: 2 }}>
          New emojis please.
        </Button>

        {/* Colour Picker */}
        <Box
          sx={{
            mt: 4,
            width: "100%",
            display: "flex", // Use flexbox to center the content
            justifyContent: "center", // Center horizontally
            alignItems: "center", // Center vertically if needed
            backgroundColor: selectedColour,
            border: "1px solid black", // Black outline
            padding: 2, // Optional padding around the Wheel
          }}
        >
          <Wheel color={selectedColour} onChange={handleColourChange} />
        </Box>
      </Box>
    </Container>
  )
}

export default ProfilePage
