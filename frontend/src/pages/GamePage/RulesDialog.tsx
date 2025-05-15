import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material"
import {
  ColorClashRules,
  Connect4Rules,
  LongBoiRules,
  ReversiRules,
  SnekRules,
  TacticToesRules,
} from "../../constants/Rules"
import { GameType } from "@shared/types/Game"

interface RulesDialogProps {
  open: boolean
  onClose: () => void
  rules?: GameType
}

export const getRulesComponent = (rules?: GameType): React.FC => {
  switch (rules) {
    case "connect4":
      return Connect4Rules
    case "longboi":
      return LongBoiRules
    case "tactictoes":
      return TacticToesRules
    case "snek":
      return SnekRules
    case "colourclash":
      return ColorClashRules
    case "reversi":
      return ReversiRules
    default:
      return Connect4Rules // Fallback if no valid rules type is provided
  }
}

const RulesDialog: React.FC<RulesDialogProps> = ({ open, onClose, rules }) => {
  const [RulesComponent, setRulesComponent] = useState<React.FC>(() =>
    getRulesComponent(rules),
  )

  useEffect(() => {
    setRulesComponent(() => getRulesComponent(rules))
  }, [rules])

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{
      sx: {
        border: "2px solid black",
        borderRadius: 0,
        boxShadow: "none",
      },
    }}>
      <DialogTitle>{rules} rules</DialogTitle>
      <DialogContent>
        <DialogContentText>
          <RulesComponent />
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default RulesDialog
