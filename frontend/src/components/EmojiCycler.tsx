import React, { useEffect, useState } from "react"
import { Box, Typography } from "@mui/material"
import { emojiList } from "@shared/types/Emojis"

interface Props {
  fontSize?: string | number
}

export const EmojiCycler: React.FC<Props> = ({ fontSize = "10rem" }) => {
  const [currentEmoji, setCurrentEmoji] = useState<string>(emojiList[0])

  useEffect(() => {
    // Function to randomly pick an emoji from the array
    const getRandomEmoji = () => {
      const randomIndex = Math.floor(Math.random() * emojiList.length)
      return emojiList[randomIndex]
    }

    // Set an interval to change the emoji every 100ms
    const emojiInterval = setInterval(() => {
      setCurrentEmoji(getRandomEmoji())
    }, 100)

    // Cleanup the interval when the component unmounts
    return () => clearInterval(emojiInterval)
  }, [])

  return <Box sx={{ fontSize }}>{currentEmoji}</Box>
}

const sendEmojis = [
  "🚀",
  "🛫",
  "🏹",
  "💨",
  "📈",
  "💸",
  "🏄",
  "🌙",
  "➡️",
  "💹",
  "🐂",
  "🎬",
  "🚦",
  "👉",
  "🔛",
  "🆒",
  "🦍",
  "✅",
  "👍",
  "🍑",
  "🦶",
  "🤑",
  "⛷️",
  "🧑‍🦯‍➡️",
  "🏃‍♀️‍➡️",
  "🕺",
  "🏌️",
  "🏂",
  "🕹️",
  "🥇",
  "💡",
  "🚒",
  "🏎️",
  "✈️",
  "🛩️",
  "🚢",
  "🛥️",
  "⛵",
  "🚤",
  "🚨",
  "🆕",
  "▶️",
  "🔜",
  "☑️",
]

type Emoji = (typeof sendEmojis)[number]

export const RotatingEmoji: React.FC = () => {
  const [currentEmoji, setCurrentEmoji] = useState<Emoji>(sendEmojis[0])
  const [previousEmojis, setPreviousEmojis] = useState<Emoji[]>([sendEmojis[0]])

  const getRandomEmoji = (): Emoji => {
    const availableEmojis = sendEmojis.filter(
      (emoji) => !previousEmojis.includes(emoji),
    )
    if (availableEmojis.length === 0) {
      // If all emojis have been used, reset the previous emojis list
      setPreviousEmojis([currentEmoji])
      return sendEmojis.find((emoji) => emoji !== currentEmoji) ?? sendEmojis[0]
    }
    return availableEmojis[Math.floor(Math.random() * availableEmojis.length)]
  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      const newEmoji = getRandomEmoji()
      setCurrentEmoji(newEmoji)
      setPreviousEmojis((prev) =>
        [...prev, newEmoji].slice(-sendEmojis.length + 1),
      )
    }, 1000)

    return () => clearInterval(intervalId)
  }, [currentEmoji])

  return (
    <Typography
      variant="h3"
      component="div"
      sx={{
        fontFamily:
          '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Symbol", sans-serif',
      }}
    >
      {currentEmoji}
    </Typography>
  )
}
