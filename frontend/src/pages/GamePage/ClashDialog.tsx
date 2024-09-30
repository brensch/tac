import React from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Button,
} from "@mui/material"
import { PlayerInfo } from "@shared/types/Game"

interface ClashDialogProps {
  open: boolean
  onClose: () => void
  clashReason: string
  clashPlayersList: PlayerInfo[]
}

const ClashDialog: React.FC<ClashDialogProps> = ({
  open,
  onClose,
  clashReason,
  clashPlayersList,
}) => {
  return (
    <Dialog open={open} onClose={onClose} sx={{ zIndex: 99999999 }}>
      <DialogTitle>Clash Details</DialogTitle>
      <DialogContent>
        <DialogContentText>{clashReason}</DialogContentText>
        <List>
          {clashPlayersList.map((player) => (
            <ListItem key={player.id}>
              <ListItemText primary={`${player.nickname} ${player.emoji}`} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ClashDialog
