import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material"
import { Connect4Rules, LongBoiRules } from "../../constants/Rules"

interface RulesDialogProps {
  open: boolean
  onClose: () => void
  rules?: string
}

export const getRulesComponent = (rules?: string): React.FC => {
  switch (rules) {
    case "connect4":
      return Connect4Rules
    case "longboi":
      return LongBoiRules
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
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Game Rules</DialogTitle>
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
