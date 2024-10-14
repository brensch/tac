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
      <Typography>If you hit an opponent's body or a wall you die.</Typography>
      <Typography>
        If you run into someone head to head the shorter snake dies.
      </Typography>
    </>
  )
}

export const ColorClashRules: React.FC = () => {
  return (
    <>
      <Typography>
        ColourClash is a board game where players compete to create the largest
        area of their color.
      </Typography>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <Typography>
            Players start in different corners of the board.
          </Typography>
        </li>
        <li>
          <Typography>
            On your turn, place a piece next to one of your existing pieces.
          </Typography>
        </li>
        <li>
          <Typography>The game ends when no one can make a move.</Typography>
        </li>
        <li>
          <Typography>
            The player with the largest connected color area wins!
          </Typography>
        </li>
      </ul>
      <Typography>
        Strategy tip: Expand your area while blocking opponents. Think ahead!
      </Typography>
    </>
  )
}

export const ReversiRules: React.FC = () => {
  return (
    <>
      <Typography>
        Reversi is a strategy board game for two players, played on an 8x8 grid.
      </Typography>
      <Typography>
        Players take turns placing pieces on the board with their color facing
        up.
      </Typography>
      <Typography>
        When you place a piece such that it brackets one or more of your
        opponent's pieces in a straight line (horizontally, vertically, or
        diagonally), those pieces are flipped to your color.
      </Typography>
      <Typography>
        The game ends when neither player can make a valid move. The player with
        the most pieces on the board wins.
      </Typography>
    </>
  )
}
