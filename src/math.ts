export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const snap = (value: number): number => Math.round(value)
