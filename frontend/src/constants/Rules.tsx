import { Typography } from "@mui/material"

export const Connect4Rules: React.FC = () => {
  return (
    <>
      <Typography>Connect 4, but everyone moves at the same time.</Typography>
    </>
  )
}

export const LongBoiRules: React.FC = () => {
  return (
    <>
      <Typography>
        Form the longest single path by connecting squares up, down, left, or
        right.
      </Typography>
      <Typography>Diagonal connections and branches don't count.</Typography>
    </>
  )
}

export const TacticToesRules: React.FC = () => {
  return (
    <>
      <Typography>
        Get 4 squares in a row to win. You can place squares anywhere.
      </Typography>
    </>
  )
}

export const SnekRules: React.FC = () => {
  return (
    <>
      <Typography>Nokia snake but competitive.</Typography>
      <Typography>
        If you hit an opponents body or go out of bounds you die.
      </Typography>
      <Typography>
        If you run into someone head to head the shorter snake dies.
      </Typography>
    </>
  )
}
