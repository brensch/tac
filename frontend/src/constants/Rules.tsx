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
      <Typography>
        Form the longest single path by connecting squares up, down, left, or
        right.
      </Typography>
      <Typography>Diagonal connections and branches don't count.</Typography>
    </>
  )
}
