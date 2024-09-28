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

const RulesDialog: React.FC<RulesDialogProps> = ({ open, onClose, rules }) => {
  const [RulesComponent, setRulesComponent] = useState<React.FC>(
    () => Connect4Rules,
  )

  useEffect(() => {
    if (rules === "connect4") {
      setRulesComponent(() => Connect4Rules)
    } else {
      setRulesComponent(() => LongBoiRules)
    }
  }, [rules]) // Run this effect only when 'rules' changes

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
