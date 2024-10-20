import React, { useState, useEffect } from "react"
import { TextField, TextFieldProps } from "@mui/material"

const useTypingEffect = (
  placeholderText: string,
  typingSpeed: number = 50,
  pauseDuration: number = 1000,
): string => {
  const [placeholder, setPlaceholder] = useState<string>("")
  const [isTypingForward, setIsTypingForward] = useState<boolean>(true)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  useEffect(() => {
    let timer: NodeJS.Timeout

    if (isPaused) {
      timer = setTimeout(() => {
        setIsPaused(false)
        setIsTypingForward(!isTypingForward)
      }, pauseDuration)
    } else {
      if (isTypingForward && placeholder.length < placeholderText.length) {
        timer = setTimeout(() => {
          setPlaceholder(placeholderText.slice(0, placeholder.length + 1))
        }, typingSpeed)
      } else if (!isTypingForward && placeholder.length > 0) {
        timer = setTimeout(() => {
          setPlaceholder(placeholder.slice(0, -1))
        }, typingSpeed)
      } else {
        setIsPaused(true)
      }
    }

    return () => clearTimeout(timer)
  }, [
    placeholder,
    isTypingForward,
    isPaused,
    placeholderText,
    typingSpeed,
    pauseDuration,
  ])

  return placeholder
}

interface TypingEffectInputProps extends Omit<TextFieldProps, "placeholder"> {
  colour?: string
}

const TypingEffectInput: React.FC<TypingEffectInputProps> = ({
  value,
  onChange,
  colour,
  ...props
}) => {
  const placeholder = useTypingEffect("Session name")

  return (
    <TextField
      fullWidth
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      sx={{
        flexGrow: 1,
        "& .MuiInputBase-root": {
          height: "70px",
        },
        "& .MuiInputBase-input": {
          fontSize: "28px",
          paddingLeft: "16px",
        },
      }}
      {...props}
    />
  )
}

export default TypingEffectInput
