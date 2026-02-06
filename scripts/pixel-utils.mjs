import fs from 'node:fs'
import path from 'node:path'

export const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
export const specPath = path.join(rootDir, 'assets', 'pixel-spec.json')
export const styleProfilesPath = path.join(rootDir, 'assets', 'pixel-style-profiles.json')

export const loadSpec = () => JSON.parse(fs.readFileSync(specPath, 'utf8'))
export const loadStyleProfiles = () => JSON.parse(fs.readFileSync(styleProfilesPath, 'utf8'))

export const expandRects = (rects) => {
  const pixels = []
  for (const [x, y, w, h] of rects) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        pixels.push([xx, yy])
      }
    }
  }
  return pixels
}

export const pointsToSet = (points) => {
  const out = new Set()
  for (const [x, y] of points) {
    out.add(`${x},${y}`)
  }
  return out
}

export const flattenRectGroup = (group) => Object.values(group).flat()

export const boundsFromPoints = (points) => {
  if (!points.length) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export const rectArea = (rects) => rects.reduce((sum, [, , w, h]) => sum + w * h, 0)

export const rectToSvg = (rects, color, opacity = 1) =>
  rects
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}"/>`)
    .join('\n')

export const writeFileSafe = (relativePath, content) => {
  const abs = path.join(rootDir, relativePath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
  return abs
}

export const parseArgs = (argv, defaults = {}) => {
  const out = { ...defaults }
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const maybeValue = argv[i + 1]
    if (!maybeValue || maybeValue.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = maybeValue
    i += 1
  }
  return out
}

export const clamp01 = (value) => Math.min(1, Math.max(0, value))
