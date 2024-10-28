import React from "react"

interface EmojiRainProps {
  emoji?: string
}

const EmojiRain: React.FC<EmojiRainProps> = ({ emoji }) => {
  const [emojis, setEmojis] = React.useState<number[]>([])

  React.useEffect(() => {
    if (emoji) {
      // Just create 100 emojis once when the emoji is provided
      setEmojis(Array.from({ length: 300 }, (_, i) => i))
    }
  }, [emoji])

  if (!emoji) return null

  return (
    <div
      style={{
        position: "fixed",
        top: `-20px`,
        left: "-20px",
        width: "120%",
        height: "120%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      {emojis.map((i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 3 // 0-3s delay for initial spread
        const duration = 6 // Consistent 6s fall for all emojis
        const size = Math.random() * 24 + 24

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `-50px`,
              left: `${left}%`,
              fontSize: `${size}px`,
              animation: `fall ${duration}s linear ${delay}s forwards`,
              willChange: 'transform',
            }}
          >
            {emoji}
          </div>
        )
      })}
      <style>
        {`
          @keyframes fall {
            from { transform: translateY(0); }
            to { transform: translateY(120vh); }
          }
        `}
      </style>
    </div>
  )
}

export default EmojiRain