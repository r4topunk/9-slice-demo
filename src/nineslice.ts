import type { Insets, Rect } from './types'
import { clamp, snap } from './math'

export type NineSliceOptions = {
  pixelSnap: boolean
  tileCenter: boolean
}

export const sanitizeInsets = (insets: Insets, src: Rect): Insets => {
  const safeLeft = clamp(insets.left, 0, src.w)
  const safeRight = clamp(insets.right, 0, src.w - safeLeft)
  const safeTop = clamp(insets.top, 0, src.h)
  const safeBottom = clamp(insets.bottom, 0, src.h - safeTop)

  return {
    left: safeLeft,
    right: safeRight,
    top: safeTop,
    bottom: safeBottom
  }
}

const snapRect = (rect: Rect, enabled: boolean): Rect => {
  if (!enabled) return rect
  return {
    x: snap(rect.x),
    y: snap(rect.y),
    w: snap(rect.w),
    h: snap(rect.h)
  }
}

const drawTiledCenter = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  src: Rect,
  dst: Rect,
  pixelSnap: boolean
): void => {
  if (src.w <= 0 || src.h <= 0 || dst.w <= 0 || dst.h <= 0) return
  const startX = pixelSnap ? snap(dst.x) : dst.x
  const startY = pixelSnap ? snap(dst.y) : dst.y
  const endX = pixelSnap ? snap(dst.x + dst.w) : dst.x + dst.w
  const endY = pixelSnap ? snap(dst.y + dst.h) : dst.y + dst.h

  for (let y = startY; y < endY; y += src.h) {
    const drawH = Math.min(src.h, endY - y)
    for (let x = startX; x < endX; x += src.w) {
      const drawW = Math.min(src.w, endX - x)
      ctx.drawImage(source, src.x, src.y, drawW, drawH, x, y, drawW, drawH)
    }
  }
}

export const drawNineSlice = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  srcRect: Rect,
  dstRect: Rect,
  insets: Insets,
  options: NineSliceOptions
): { dst: Rect; insets: Insets } => {
  const safeInsets = sanitizeInsets(insets, srcRect)
  const snappedDst = snapRect(dstRect, options.pixelSnap)

  const sx0 = srcRect.x
  const sx1 = srcRect.x + safeInsets.left
  const sx2 = srcRect.x + srcRect.w - safeInsets.right
  const sx3 = srcRect.x + srcRect.w

  const sy0 = srcRect.y
  const sy1 = srcRect.y + safeInsets.top
  const sy2 = srcRect.y + srcRect.h - safeInsets.bottom
  const sy3 = srcRect.y + srcRect.h

  const dx0 = snappedDst.x
  const dx1 = snappedDst.x + safeInsets.left
  const dx2 = snappedDst.x + snappedDst.w - safeInsets.right
  const dx3 = snappedDst.x + snappedDst.w

  const dy0 = snappedDst.y
  const dy1 = snappedDst.y + safeInsets.top
  const dy2 = snappedDst.y + snappedDst.h - safeInsets.bottom
  const dy3 = snappedDst.y + snappedDst.h

  const sx = [sx0, sx1, sx2, sx3]
  const sy = [sy0, sy1, sy2, sy3]
  const dx = [dx0, dx1, dx2, dx3]
  const dy = [dy0, dy1, dy2, dy3]

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const sw = sx[col + 1] - sx[col]
      const sh = sy[row + 1] - sy[row]
      const dw = dx[col + 1] - dx[col]
      const dh = dy[row + 1] - dy[row]

      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue

      if (row === 1 && col === 1 && options.tileCenter) {
        drawTiledCenter(
          ctx,
          source,
          { x: sx[col], y: sy[row], w: sw, h: sh },
          { x: dx[col], y: dy[row], w: dw, h: dh },
          options.pixelSnap
        )
        continue
      }

      ctx.drawImage(source, sx[col], sy[row], sw, sh, dx[col], dy[row], dw, dh)
    }
  }

  return {
    dst: snappedDst,
    insets: safeInsets
  }
}
