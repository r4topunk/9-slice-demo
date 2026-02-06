import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadSpec, parseArgs, rootDir } from './pixel-utils.mjs'

const hexToRgba = (hex) => {
  const normalized = String(hex).trim().replace('#', '')
  if (normalized.length !== 6 && normalized.length !== 8) {
    throw new Error(`Invalid color: ${hex}`)
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  const a = normalized.length === 8 ? Number.parseInt(normalized.slice(6, 8), 16) / 255 : 1
  return { r, g, b, a }
}

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)))

const blendOver = (dst, src) => {
  const srcA = src.a
  const dstA = dst.a
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: (src.r * srcA + dst.r * dstA * (1 - srcA)) / outA,
    g: (src.g * srcA + dst.g * dstA * (1 - srcA)) / outA,
    b: (src.b * srcA + dst.b * dstA * (1 - srcA)) / outA,
    a: outA
  }
}

const drawRects = (pixels, width, height, rects, color) => {
  if (!rects?.length) return
  const rgba = hexToRgba(color)
  for (const [x, y, w, h] of rects) {
    for (let yy = y; yy < y + h; yy += 1) {
      if (yy < 0 || yy >= height) continue
      for (let xx = x; xx < x + w; xx += 1) {
        if (xx < 0 || xx >= width) continue
        const idx = yy * width + xx
        pixels[idx] = blendOver(pixels[idx], rgba)
      }
    }
  }
}

const makeChecker = (width, height, a, b, size = 8) => {
  const out = new Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isA = ((Math.floor(x / size) + Math.floor(y / size)) % 2) === 0
      out[y * width + x] = isA ? { ...a } : { ...b }
    }
  }
  return out
}

const compositeToRgb = (pixels, width, height, checker) => {
  const rgb = new Uint8Array(width * height * 3)
  for (let i = 0; i < pixels.length; i += 1) {
    const dst = checker[i]
    const src = pixels[i]
    const out = blendOver(dst, src)
    const offset = i * 3
    rgb[offset + 0] = clampByte(out.r)
    rgb[offset + 1] = clampByte(out.g)
    rgb[offset + 2] = clampByte(out.b)
  }
  return rgb
}

const upscaleRgb = (rgb, width, height, scale) => {
  if (scale <= 1) return { rgb, width, height }
  const outW = width * scale
  const outH = height * scale
  const out = new Uint8Array(outW * outH * 3)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcOffset = (y * width + x) * 3
      const r = rgb[srcOffset + 0]
      const g = rgb[srcOffset + 1]
      const b = rgb[srcOffset + 2]
      for (let yy = 0; yy < scale; yy += 1) {
        for (let xx = 0; xx < scale; xx += 1) {
          const dstOffset = ((y * scale + yy) * outW + (x * scale + xx)) * 3
          out[dstOffset + 0] = r
          out[dstOffset + 1] = g
          out[dstOffset + 2] = b
        }
      }
    }
  }
  return { rgb: out, width: outW, height: outH }
}

const buildSpritePixels = (spec) => {
  const width = spec.size
  const height = spec.size
  const pixels = new Array(width * height).fill(0).map(() => ({ r: 0, g: 0, b: 0, a: 0 }))

  drawRects(pixels, width, height, spec.base.outline, spec.palettes.outline)
  drawRects(pixels, width, height, spec.base.skinLight, spec.palettes.skin.light)
  drawRects(pixels, width, height, spec.base.skinBase, spec.palettes.skin.base)
  drawRects(pixels, width, height, spec.base.skinShadow, spec.palettes.skin.shadow)
  drawRects(pixels, width, height, spec.base.hairLight, spec.palettes.hair.light)
  drawRects(pixels, width, height, spec.base.hairBase, spec.palettes.hair.base)
  drawRects(pixels, width, height, spec.base.hairShadow, spec.palettes.hair.shadow)

  const shirt = spec.palettes.shirt[0]
  const pants = spec.palettes.pants[0]

  drawRects(pixels, width, height, spec.shirt.light, shirt.light)
  drawRects(pixels, width, height, spec.shirt.base, shirt.base)
  drawRects(pixels, width, height, spec.shirt.shadow, shirt.shadow)
  drawRects(pixels, width, height, spec.shirt.pattern, '#ffffff2a')

  drawRects(pixels, width, height, spec.pants.light, pants.light)
  drawRects(pixels, width, height, spec.pants.base, pants.base)
  drawRects(pixels, width, height, spec.pants.shadow, pants.shadow)
  drawRects(pixels, width, height, spec.pants.pattern, '#ffffff2a')

  drawRects(pixels, width, height, spec.boots.outline, spec.palettes.outline)
  drawRects(pixels, width, height, spec.boots.fill, '#2f2520')

  const eyeY = spec.anchors.headCenter[1] + 3
  const leftEyeX = spec.anchors.headCenter[0] - 3
  const rightEyeX = spec.anchors.headCenter[0] + 2
  drawRects(pixels, width, height, [[leftEyeX, eyeY, 1, 1], [rightEyeX, eyeY, 1, 1]], '#1b120f')

  return pixels
}

const writePpm = (filePath, width, height, rgb) => {
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, Buffer.concat([header, Buffer.from(rgb)]))
}

const convertToPng = (inPath, outPath) => {
  const result = spawnSync('/usr/bin/sips', ['-s', 'format', 'png', inPath, '--out', outPath], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`sips failed: ${result.stderr || result.stdout || `exit ${result.status}`}`)
  }
}

const runCli = () => {
  const args = parseArgs(process.argv, {
    out: 'output/pixel-art/sprite.png',
    scale: '8',
    checkerSize: '8'
  })

  const spec = loadSpec()
  const width = spec.size
  const height = spec.size
  const pixels = buildSpritePixels(spec)

  const checkerA = hexToRgba('#c7c7c7')
  const checkerB = hexToRgba('#ededed')
  const checker = makeChecker(width, height, checkerA, checkerB, Number(args.checkerSize) || 8)
  const rgb = compositeToRgb(pixels, width, height, checker)
  const scaled = upscaleRgb(rgb, width, height, Number(args.scale) || 1)

  const absOut = path.isAbsolute(String(args.out)) ? String(args.out) : path.join(rootDir, String(args.out))
  const ppmPath = absOut.replace(/\.png$/i, '.ppm')

  writePpm(ppmPath, scaled.width, scaled.height, scaled.rgb)
  convertToPng(ppmPath, absOut)
  fs.unlinkSync(ppmPath)

  const rel = path.relative(rootDir, absOut) || path.basename(absOut)
  console.log(`Rendered sprite: ${path.join(rootDir, rel)}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) runCli()

