import { Typography } from "@mui/material"

export const Connect4Rules: React.FC = () => {
  return (
    <>
      <Typography>1. Select a square by pressing it</Typography>
      <Typography>2. Press 'Submit Move'</Typography>
      <Typography>
        3. Read your opponents' minds to not pick the same square as them. If
        you fail to do this, that square will get blocked forever (❌)
      </Typography>
      <Typography sx={{ mb: 2 }}>4. Get 4 squares in a row to win</Typography>
    </>
  )
}

export const LongBoiRules: React.FC = () => {
  return (
    <>
      <Typography>1. Select a square by pressing it</Typography>
      <Typography>2. Press 'Submit Move'</Typography>
      <Typography>
        3. Read your opponents' minds to not pick the same square as them. If
        you fail to do this, that square will get blocked forever (❌)
      </Typography>
      <Typography sx={{ mb: 2 }}>
        4. Get the longest line of squares connected by their edges to win.
      </Typography>
    </>
  )
}
