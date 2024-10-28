import React from "react"

interface EmojiRainProps {
  emoji?: string
  duration?: number
  totalEmojis?: number
}

const EmojiRain: React.FC<EmojiRainProps> = ({
  emoji,
  duration = 15,
  totalEmojis = 300
}) => {
  const [emojis, setEmojis] = React.useState<Array<{
    id: number
    left: number
    delay: number
    size: number
    speed: number
  }>>([])

  React.useEffect(() => {
    if (emoji) {
      const newEmojis = Array.from({ length: totalEmojis }, (_, i) => {
        const progress = i / totalEmojis
        const b = 3
        const delay = Math.exp(progress * b)
        const maxInitialDelay = duration * 2
        const scaledDelay = (delay - 1) * maxInitialDelay / (Math.exp(b) - 1)

        const speedMultiplier = 0.5 + Math.random()

        return {
          id: i,
          left: Math.random() * 100,
          delay: scaledDelay * (0.8 + Math.random() * 0.4),
          size: Math.random() * 24 + 24,
          speed: duration * speedMultiplier
        }
      })

      newEmojis.sort((a, b) => a.delay - b.delay)

      setEmojis(newEmojis)
    }
  }, [emoji, duration, totalEmojis])

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
      {emojis.map(({ id, left, delay, size, speed }) => (
        <div
          key={id}
          style={{
            position: "absolute",
            top: `-50px`,
            left: `${left}%`,
            fontSize: `${size}px`,
            animation: `fall ${speed}s linear ${delay}s forwards`,
            willChange: 'transform',
            WebkitTextFillColor: 'initial', // Makes emojis solid in WebKit browsers
            color: 'initial',               // Ensures full color rendering
          }}
        >
          {emoji}
        </div>
      ))}
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