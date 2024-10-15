import React from "react"
import { Typography, List, ListItem, ListItemText } from "@mui/material"

export const Connect4Rules: React.FC = () => {
  return (
    <List>
      <ListItem>
        <ListItemText primary="Connect 4, but everyone moves at the same time." />
      </ListItem>
    </List>
  )
}

export const LongBoiRules: React.FC = () => {
  return (
    <List>
      <ListItem>
        <ListItemText primary="Form the longest single path by connecting squares up, down, left, or right." />
      </ListItem>
      <ListItem>
        <ListItemText primary="Diagonal connections and branches don't count." />
      </ListItem>
    </List>
  )
}

export const TacticToesRules: React.FC = () => {
  return (
    <List>
      <ListItem>
        <ListItemText primary="Get 4 squares in a row to win. You can place squares anywhere." />
      </ListItem>
    </List>
  )
}

export const SnekRules: React.FC = () => {
  return (
    <List>
      <ListItem>
        <ListItemText primary="Nokia snake but competitive." />
      </ListItem>
      <ListItem>
        <ListItemText primary="If you hit an opponent's body or a wall you die." />
      </ListItem>
      <ListItem>
        <ListItemText primary="If you run into someone head to head the shorter snake dies." />
      </ListItem>
    </List>
  )
}

export const ColorClashRules: React.FC = () => {
  return (
    <>
      <Typography variant="body1" gutterBottom>
        ColourClash is a board game where players compete to create the largest
        area of their color.
      </Typography>
      <List>
        <ListItem>
          <ListItemText primary="Players start in different corners of the board." />
        </ListItem>
        <ListItem>
          <ListItemText primary="On your turn, place a piece next to one of your existing pieces." />
        </ListItem>
        <ListItem>
          <ListItemText primary="The game ends when no one can make a move." />
        </ListItem>
        <ListItem>
          <ListItemText primary="The player with the largest connected color area wins!" />
        </ListItem>
      </List>
      <Typography variant="body1">
        Strategy tip: Expand your area while blocking opponents. Think ahead!
      </Typography>
    </>
  )
}

export const ReversiRules: React.FC = () => {
  return (
    <List>
      <ListItem>
        <ListItemText primary="Reversi is a strategy board game for two players, played on an 8x8 grid." />
      </ListItem>
      <ListItem>
        <ListItemText primary="Players take turns placing pieces on the board with their color facing up." />
      </ListItem>
      <ListItem>
        <ListItemText primary="When you place a piece such that it brackets one or more of your opponent's pieces in a straight line (horizontally, vertically, or diagonally), those pieces are flipped to your color." />
      </ListItem>
      <ListItem>
        <ListItemText primary="The game ends when neither player can make a valid move. The player with the most pieces on the board wins." />
      </ListItem>
    </List>
  )
}
