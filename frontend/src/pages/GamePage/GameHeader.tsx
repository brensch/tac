import React, { useState } from "react"
import { Box, Button, Typography } from "@mui/material"
import RulesDialog from "./RulesDialog"
import { useGameStateContext } from "../../context/GameStateContext"
import { Book, PersonAdd } from "@mui/icons-material"

const GameHeader: React.FC = () => {
  const { gameState } = useGameStateContext()

  const [openRulesDialog, setOpenRulesDialog] = useState(false)

  const handleShare = async () => {
    if (!navigator.share) return
    await navigator.share({
      title: "Tactic toes",
      text: "This game is completely unrelated to toes.",
      url: `/session/${gameState?.sessionName}`,
    })
    console.log("Content shared successfully")
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            flexGrow: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {gameState?.sessionName}
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            onClick={() => setOpenRulesDialog(true)}
            sx={{ height: 30, width: "100px" }} // Static width for the button
            startIcon={<Book />}
          >
            Rules
          </Button>
          <Button
            onClick={handleShare}
            sx={{ height: 30, width: "100px" }} // Static width for the button
            startIcon={<PersonAdd />}
          >
            Invite
          </Button>
        </Box>
      </Box>

      {/* Rules Dialog */}
      <RulesDialog
        open={openRulesDialog}
        onClose={() => setOpenRulesDialog(false)}
        rules={gameState?.gameType}
      />
    </Box>
  )
}

export default GameHeader
