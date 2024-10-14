// Simplified color generation function
export const generateColor = (
  hue: number,
  saturation: number = 85,
  lightness: number = 60,
): string => {
  const h = hue % 360
  const s = Math.max(0, Math.min(100, saturation))
  const l = Math.max(0, Math.min(100, lightness))
  return `hsl(${h}, ${s}%, ${l}%)`
}
