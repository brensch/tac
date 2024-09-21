// src/pages/HomePage.tsx
import React from "react"
import { Button, Stack, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { collection, addDoc } from "firebase/firestore"
import { db } from "../firebaseConfig"

const buttonStyle = {
  backgroundColor: "#000",
  color: "#fff",
  padding: "16px 32px",
  fontWeight: "bold",
  textShadow: "2px 2px #f00",
  boxShadow: "8px 8px #f00",
}

const HomePage: React.FC = () => {
  const navigate = useNavigate()

  const handleNewGame = async () => {
    try {
      const docRef = await addDoc(collection(db, "games"), {
        createdAt: new Date(),
      })
      navigate(`/game/${docRef.id}`)
    } catch (e) {
      console.error("Error creating game: ", e)
    }
  }

  return (
    <Stack spacing={4} alignItems="center">
      <Typography variant="h3" align="center" gutterBottom>
        Hi
      </Typography>
      <Button sx={buttonStyle} fullWidth onClick={handleNewGame}>
        New
      </Button>
      <Button sx={buttonStyle} fullWidth onClick={() => navigate("/join")}>
        Join
      </Button>
    </Stack>
  )
}

export default HomePage
