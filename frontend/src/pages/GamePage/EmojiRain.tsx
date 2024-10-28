import React from "react"

interface EmojiRainProps {
  emoji?: string
  duration?: number
  totalEmojis?: number
}

const EmojiRain: React.FC<EmojiRainProps> = ({ 
  emoji, 
  duration = 8, 
  totalEmojis = 300 
}) => {
  const [emojis, setEmojis] = React.useState<Array<{
    id: number;
    left: number;
    delay: number;
    size: number;
  }>>([])

  React.useEffect(() => {
    if (emoji) {
      // Create emojis with delays following a bell curve distribution
      const newEmojis = Array.from({ length: totalEmojis }, (_, i) => {
        // Convert index to a value between -3 and 3 for normal distribution
        const x = (i / totalEmojis) * 6 - 3
        
        // Calculate delay using normal distribution formula
        // This creates a bell curve centered at duration/2
        const standardDeviation = 1
        const mean = duration / 2
        const delay = mean + (x * standardDeviation)
        
        // Ensure delay is positive and within duration
        const clampedDelay = Math.max(0, Math.min(duration, delay))

        return {
          id: i,
          left: Math.random() * 100,
          delay: clampedDelay,
          size: Math.random() * 24 + 24
        }
      })

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
      {emojis.map(({ id, left, delay, size }) => (
        <div
          key={id}
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