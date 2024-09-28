import { Typography } from "@mui/material"

export const Connect4Rules: React.FC = () => {
  return (
    <>
      <Typography>1. Select a square by pressing it</Typography>
      <Typography>2. Press 'Submit Move'</Typography>
      <Typography sx={{ mb: 2 }}>3. Get 4 squares in a row to win</Typography>
    </>
  )
}

export const LongBoiRules: React.FC = () => {
  return (
    <>
      <Typography>1. Select a square by pressing it</Typography>
      <Typography>2. Press 'Submit Move' before your time runs out</Typography>
      <Typography sx={{ mb: 2 }}>
        3. Get the longest line of squares connected by their edges to win.
      </Typography>
    </>
  )
}
