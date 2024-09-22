import React, { useState } from "react"
import { useUser } from "../context/UserContext"
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Grid,
} from "@mui/material"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"
import { useNavigate } from "react-router-dom"

const ProfilePage: React.FC = () => {
  const { userID, nickname: initialNickname, emoji: initialEmoji } = useUser()
  const [nickname, setNickname] = useState<string>(initialNickname)
  const [selectedEmoji, setSelectedEmoji] = useState<string>(initialEmoji)
  const [message, setMessage] = useState<string>("")
  const navigate = useNavigate()

  // Emoji list
  const emojiList = [
    "😀",
    "😎",
    "😂",
    "😍",
    "😅",
    "👍",
    "🎉",
    "🚀",
    "🌟",
    "🔥",
    "🍕",
    "🎮",
    "🐶",
    "🐱",
    "🌈",
    "⚽️",
    "🏀",
    "🏈",
    "⚾️",
    "🎲",
  ]

  const handleUpdateProfile = async () => {
    if (!nickname.trim() || !selectedEmoji) {
      setMessage("Please enter a nickname and select an emoji.")
      return
    }
    const userDocRef = doc(db, "users", userID)
    await updateDoc(userDocRef, { nickname, emoji: selectedEmoji })
    setMessage("Profile updated successfully!")
    navigate("/")
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Update Profile
      </Typography>
      <Box
        width="100%"
        display="flex"
        flexDirection="column"
        alignItems="center"
      >
        <TextField
          label="Nickname"
          variant="outlined"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          fullWidth
        />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Select an Emoji:
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {emojiList.map((emoji) => (
            <Grid item xs={2} key={emoji}>
              <Button
                variant={selectedEmoji === emoji ? "contained" : "outlined"}
                onClick={() => setSelectedEmoji(emoji)}
                sx={{ fontSize: "1.5rem", minWidth: "100%" }}
              >
                {emoji}
              </Button>
            </Grid>
          ))}
        </Grid>
        {message && (
          <Typography color="error" sx={{ mt: 2 }}>
            {message}
          </Typography>
        )}
        <Button onClick={handleUpdateProfile} sx={{ mt: 2 }}>
          Update Profile
        </Button>
      </Box>
    </Container>
  )
}

export default ProfilePage
