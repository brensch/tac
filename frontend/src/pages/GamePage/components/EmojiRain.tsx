import React from "react"

interface EmojiRainProps {
  emoji: string
}

const EmojiRain: React.FC<EmojiRainProps> = ({ emoji }) => {
  const [emojis, setEmojis] = React.useState<number[]>([])

  React.useEffect(() => {
    // Generate an array of numbers to represent emojis
    const emojiArray = Array.from({ length: 300 }, (_, i) => i)
    setEmojis(emojiArray)
  }, [])

  console.log("wot")

  return (
    <div
      style={{
        position: "fixed",
        top: -20,
        left: 0,
        width: "100%",
        height: "120%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      {emojis.map((i) => {
        const left = Math.random() * 100 // Random left position
        const delay = Math.random() * 5 // Random animation delay
        const duration = Math.random() * 5 + 5 // Random animation duration between 5s and 10s
        const size = Math.random() * 24 + 24 // Random size between 24px and 48px

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `-50px`, // Start above the screen
              left: `${left}%`,
              fontSize: `${size}px`,
              animation: `fall ${duration}s linear ${delay}s infinite`,
            }}
          >
            {emoji}
          </div>
        )
      })}
      <style>
        {`
          @keyframes fall {
            0% { transform: translateY(0); }
            100% { transform: translateY(120vh); }
          }
        `}
      </style>
    </div>
  )
}

export default EmojiRain
