const COLOR_BASE = '#b8a27b'
const COLOR_GRAIN_A = '#9f885e'
const COLOR_GRAIN_B = '#cab58f'
const COLOR_BORDER_OUTER = '#17130f'
const COLOR_BORDER_MID = '#6a5536'
const COLOR_BORDER_INNER = '#dbc79f'
const COLOR_CORNER = '#2d2217'
const COLOR_PATTERN = '#8e734b'

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

  const outer = Math.max(2, Math.floor(size * 0.05))
  const mid = Math.max(2, Math.floor(size * 0.03))
  const inner = Math.max(1, Math.floor(size * 0.02))

  ctx.fillStyle = COLOR_BORDER_OUTER
  ctx.fillRect(0, 0, size, outer)
  ctx.fillRect(0, size - outer, size, outer)
  ctx.fillRect(0, 0, outer, size)
  ctx.fillRect(size - outer, 0, outer, size)

  ctx.fillStyle = COLOR_BORDER_MID
  ctx.fillRect(outer, outer, size - outer * 2, mid)
  ctx.fillRect(outer, size - outer - mid, size - outer * 2, mid)
  ctx.fillRect(outer, outer, mid, size - outer * 2)
  ctx.fillRect(size - outer - mid, outer, mid, size - outer * 2)

  const hiInset = outer + mid
  ctx.fillStyle = COLOR_BORDER_INNER
  ctx.fillRect(hiInset, hiInset, size - hiInset * 2, inner)
  ctx.fillRect(hiInset, hiInset, inner, size - hiInset * 2)

  // Small corner motifs preserve stylization without huge dark blocks.
  const motif = Math.max(4, Math.floor(size * 0.08))
  const m = outer + 1
  ctx.fillStyle = COLOR_CORNER
  ctx.fillRect(m, m, motif, 2)
  ctx.fillRect(m, m, 2, motif)
  ctx.fillRect(size - m - motif, m, motif, 2)
  ctx.fillRect(size - m - 2, m, 2, motif)
  ctx.fillRect(m, size - m - 2, motif, 2)
  ctx.fillRect(m, size - m - motif, 2, motif)
  ctx.fillRect(size - m - motif, size - m - 2, motif, 2)
  ctx.fillRect(size - m - 2, size - m - motif, 2, motif)

  const centerInset = outer + mid + inner + 2
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
