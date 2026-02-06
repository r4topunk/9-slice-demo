const COLOR_BASE = '#061006'
const COLOR_GRAIN_A = '#081808'
const COLOR_GRAIN_B = '#0b210b'
const COLOR_BORDER_OUTER = '#37ff41'
const COLOR_BORDER_SHADE = '#188d1d'
const COLOR_BORDER_INNER = '#b6ff55'
const COLOR_PATTERN = '#173317'

export const DEFAULT_TEXTURE_SIZE = 64

export const createPanelTexture = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D context unavailable')
  }

  ctx.fillStyle = COLOR_BASE
  ctx.fillRect(0, 0, size, size)

  // Grain pass gives a painterly parchment texture without large artifacts.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const v = (x * 17 + y * 31) % 29
      if (v === 0) {
        ctx.fillStyle = COLOR_GRAIN_A
        ctx.fillRect(x, y, 1, 1)
      } else if (v === 1) {
        ctx.fillStyle = COLOR_GRAIN_B
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  const outer = Math.max(2, Math.floor(size * 0.045))
  const inner = Math.max(1, Math.floor(size * 0.02))

  ctx.fillStyle = COLOR_BORDER_OUTER
  ctx.fillRect(0, 0, size, outer)
  ctx.fillRect(0, size - outer, size, outer)
  ctx.fillRect(0, 0, outer, size)
  ctx.fillRect(size - outer, 0, outer, size)

  const rimInset = outer + 1
  const rimW = Math.max(1, size - rimInset * 2)
  const rimH = Math.max(1, size - rimInset * 2)

  ctx.fillStyle = COLOR_BORDER_SHADE
  ctx.fillRect(rimInset, rimInset, rimW, inner)
  ctx.fillRect(rimInset, rimInset + rimH - inner, rimW, inner)
  ctx.fillRect(rimInset, rimInset, inner, rimH)
  ctx.fillRect(rimInset + rimW - inner, rimInset, inner, rimH)

  ctx.fillStyle = COLOR_BORDER_INNER
  ctx.fillRect(rimInset, rimInset, rimW, 1)
  ctx.fillRect(rimInset, rimInset, 1, rimH)

  const centerInset = rimInset + inner + 1
  for (let y = centerInset; y < size - centerInset; y += 1) {
    for (let x = centerInset; x < size - centerInset; x += 1) {
      const hash = (x * 19 + y * 43) % 97
      if (hash === 0 || hash === 1) {
        ctx.fillStyle = COLOR_PATTERN
        ctx.globalAlpha = 0.08
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
  ctx.globalAlpha = 1

  return canvas
}
