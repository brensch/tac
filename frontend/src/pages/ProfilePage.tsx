import React, { useState, useEffect } from "react"
import { useUser } from "../context/UserContext"
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { emojiList } from "@shared/types/Emojis"
import RefreshIcon from "@mui/icons-material/Refresh"
import SaveIcon from "@mui/icons-material/Save"
import Wheel from "@uiw/react-color-wheel"

const ProfilePage: React.FC = () => {
  const {
    userID,
    nickname: initialNickname,
    emoji: initialEmoji,
    colour: initialColour,
  } = useUser()
  const [nickname, setNickname] = useState<string>(initialNickname)
  const [selectedEmoji, setSelectedEmoji] = useState<string>(initialEmoji)
  const [selectedColour, setSelectedColour] = useState<string>(
    initialColour || "#000000",
  )
  const [message, setMessage] = useState<string>("")
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

  const handleUpdateNickname = async () => {
    if (!nickname.trim()) {
      setMessage("Please enter a nickname.")
      return
    }
    const userDocRef = doc(db, "users", userID)
    await updateDoc(userDocRef, { nickname })
    setMessage("Nickname updated.")
  }

  const handleEmojiClick = async (emoji: string) => {
    setSelectedEmoji(emoji)
    const userDocRef = doc(db, "users", userID)
    await updateDoc(userDocRef, { emoji })
    setMessage("Emoji updated.")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleColourChange = async (color: any) => {
    setSelectedColour(color.hex)
    const userDocRef = doc(db, "users", userID)
    await updateDoc(userDocRef, { colour: color.hex })
    setMessage("Colour updated.")
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
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleUpdateNickname} edge="end">
                  <SaveIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
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

        <Button
          onClick={randomizeEmojis}
          startIcon={<RefreshIcon />}
          sx={{ mt: 2 }}
        >
          New emojis please.
        </Button>

        {/* Colour Picker using SliderPicker */}
        <Box sx={{ mt: 4 }}>
          <Wheel color={selectedColour} onChange={handleColourChange} />
        </Box>

        {message && (
          <Typography color="success" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
      </Box>
    </Container>
  )
}

export default ProfilePage
