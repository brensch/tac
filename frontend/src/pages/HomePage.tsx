import React, { useState } from "react"
import { Box, IconButton, Stack, TextField, Typography } from "@mui/material"
import { useNavigate } from "react-router-dom"
import { useUser } from "../context/UserContext"

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [sessionName, setSessionName] = useState("")
  const { colour } = useUser()

  const handleNewGame = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault() // Prevent the form from submitting the traditional way
    e.stopPropagation() // Stop propagation of the event
    navigate(`/session/${sessionName}`)
  }

  return (
    <Stack alignItems="left">
      <Typography pt={2} variant="h4" align="left" gutterBottom>
        Games entirely unrelated to toes*
      </Typography>

      <Typography pt={14} variant="body2" align="left" gutterBottom>
        Pick a word for your session. If you want to play with someone, use the
        same word.
      </Typography>
      <form onSubmit={handleNewGame} style={{ width: "100%" }}>
        <TextField
          fullWidth
          value={sessionName}
          placeholder="Session name"
          onChange={(e) => {
            // Convert to lowercase and remove non-letter characters
            const lowercaseValue = e.target.value
              .toLowerCase()
              .replace(/[^a-z]/g, "")
            setSessionName(lowercaseValue)
          }}
          sx={{
            pt: 3,
            "& .MuiInputBase-root": {
              height: "70px", // Adjust height here
              backgroundColor: colour,
            },
            "& .MuiInputBase-input": {
              fontSize: "28px", // Increase the font size here
            },
          }}
          slotProps={{
            input: {
              endAdornment: (
                <IconButton
                  type="submit"
                  sx={{
                    color: "black",
                    fontSize: "32px",
                  }}
                >
                  🚀
                </IconButton>
              ),
            },
          }}
        />
      </form>

      <Typography
        pt={2}
        variant="body2"
        sx={{
          position: "absolute",
          bottom: "60px",
          left: 0,
          right: 0,
          border: "1px solid",
          borderImage:
            "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet) 1",
          borderRadius: 0,
          mt: 15,
          mb: 2,
          mx: 1,
          px: 2,
          py: 1,
          display: "flex", // Ensures the emoji and text are inline
          alignItems: "center", // Vertically centers the text and emoji
        }}
      >
        <Box
          role="img"
          aria-label="dancing emoji"
          sx={{ mr: 2, fontSize: "30px" }}
        >
          🕺
        </Box>
        Ugly colour? Uninspired emoji? Edit it in the top right.
      </Typography>
      <Typography
        pt={2}
        variant="subtitle2"
        align="left"
        gutterBottom
      ></Typography>

      {/* Footer text fixed at the bottom */}
      <Typography
        pt={2}
        variant="body1"
        align="left"
        gutterBottom
        sx={{
          position: "fixed",
          bottom: 10,
          left: 10,
          width: "100%",
          textAlign: "left",
        }}
      >
        * Toes may be involved.
        <br /> A game by brendo
      </Typography>
    </Stack>
  )
}

export default HomePage
