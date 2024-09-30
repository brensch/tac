import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
} from "@mui/material"
import { getRulesComponent } from "./RulesDialog"
import { GameType } from "@shared/types/Game"

interface RulesDialogProps {
  open: boolean
  onClose: () => void
  rules?: GameType
  timeRemaining: number
}

const UserRulesAccept: React.FC<RulesDialogProps> = ({
  open,
  onClose,
  rules,
  timeRemaining,
}) => {
  const [RulesComponent, setRulesComponent] = useState<React.FC>(() =>
    getRulesComponent(rules),
  )
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    setRulesComponent(() => getRulesComponent(rules))
  }, [rules])

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setChecked(event.target.checked)
  }

  const handleStartClick = () => {
    if (checked) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={undefined}>
      <DialogTitle>Rules for {rules}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          <RulesComponent />
        </DialogContentText>
        <FormControlLabel
          control={
            <Checkbox
              checked={checked}
              onChange={handleCheckboxChange}
              name="understandCheckbox"
            />
          }
          label="I have read the instructions"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleStartClick} disabled={!checked}>
          Start Game ({Math.max(0, timeRemaining).toFixed(0)}s)
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default UserRulesAccept
