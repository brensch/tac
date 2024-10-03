import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from "@mui/material"
import { GamePlayer, Player } from "@shared/types/Game"
import React from "react"

interface ClashDialogProps {
  open: boolean
  onClose: () => void
  clashReason: string
  clashPlayersList: GamePlayer[]
  players: Player[]
}

const ClashDialog: React.FC<ClashDialogProps> = ({
  open,
  onClose,
  clashReason,
  clashPlayersList,
  players,
}) => {
  return (
    <Dialog open={open} onClose={onClose} sx={{ zIndex: 99999999 }}>
      <DialogTitle>Clash Details</DialogTitle>
      <DialogContent>
        <DialogContentText>{clashReason}</DialogContentText>
        <List>
          {clashPlayersList.map((gamePlayer) => {
            const player = players.find((player) => player.id === gamePlayer.id)
            if (!player) return null
            return (
              <ListItem key={player.id}>
                <ListItemText primary={`${player.name} ${player.emoji}`} />
              </ListItem>
            )
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ClashDialog
