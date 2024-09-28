import { Typography } from "@mui/material"

export const Connect4Rules: React.FC = () => {
  return (
    <>
      <Typography>Get 4 squares in a row to win</Typography>
    </>
  )
}

export const LongBoiRules: React.FC = () => {
  return (
    <>
      <Typography>Get the longest line of connected squares to win.</Typography>
      <Typography>
        Diagonal connections don't count, only up down left right.
      </Typography>
    </>
  )
}
