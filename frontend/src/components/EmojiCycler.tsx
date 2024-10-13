import React, { useEffect, useState } from "react"
import { Box } from "@mui/material"
import { emojiList } from "@shared/types/Emojis"

const EmojiCycler: React.FC = () => {
  const [currentEmoji, setCurrentEmoji] = useState<string>(emojiList[0])

  useEffect(() => {
    // Function to randomly pick an emoji from the array
    const getRandomEmoji = () => {
      const randomIndex = Math.floor(Math.random() * emojiList.length)
      return emojiList[randomIndex]
    }

    // Set an interval to change the emoji every 1 second (1000 ms)
    const emojiInterval = setInterval(() => {
      setCurrentEmoji(getRandomEmoji())
    }, 100)

    // Cleanup the interval when the component unmounts
    return () => clearInterval(emojiInterval)
  }, [])

  return <Box sx={{ fontSize: "10rem" }}>{currentEmoji}</Box>
}

export default EmojiCycler
