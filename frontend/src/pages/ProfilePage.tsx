import React, { useState } from "react"
import { useUser } from "../context/UserContext"
import { Container, Box, TextField, Button, Typography } from "@mui/material"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"

const ProfilePage: React.FC = () => {
  const { userID, nickname: initialNickname, emoji: initialEmoji } = useUser()
  const [nickname, setNickname] = useState<string>(initialNickname)
  const [selectedEmoji, setSelectedEmoji] = useState<string>(initialEmoji)
  const [message, setMessage] = useState<string>("")

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
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
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
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2, // Add some spacing between buttons
            justifyContent: "center",
            mt: 1,
          }}
        >
          {emojiList.map((emoji) => (
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
