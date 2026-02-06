import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  clamp01,
  flattenRectGroup,
  loadSpec,
  loadStyleProfiles,
  parseArgs,
  rectArea
} from './pixel-utils.mjs'

const hexToRgb = (hex) => {
  const normalized = String(hex).trim().replace('#', '')
  if (normalized.length !== 6) throw new Error(`Invalid color: ${hex}`)
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  }
}

const toLinear = (value) => {
  const n = value / 255
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
}

const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

const hueFromHex = (hex) => {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  if (delta === 0) return 0
  let hue = 0
  if (max === rn) hue = ((gn - bn) / delta) % 6
  else if (max === gn) hue = (bn - rn) / delta + 2
  else hue = (rn - gn) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360
  return hue
}

const hueDistance = (a, b) => {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

const contrastRatio = (a, b) => {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const evaluateRangeMetric = (id, label, value, [min, max]) => {
  const inRange = value >= min && value <= max
  const distance = inRange
    ? 0
    : value < min
      ? (min - value) / Math.max(0.0001, min)
      : (value - max) / Math.max(0.0001, max)
  return {
    id,
    label,
    value,
    target: [min, max],
    status: inRange ? 'ok' : 'warn',
    score: clamp01(1 - distance),
    direction: inRange ? 'ok' : value < min ? 'low' : 'high'
  }
}

const minHueGap = (colors) => {
  if (colors.length < 2) return 180
  const hues = colors.map(hueFromHex)
  let minGap = Number.POSITIVE_INFINITY
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      minGap = Math.min(minGap, hueDistance(hues[i], hues[j]))
    }
  }
  return Number.isFinite(minGap) ? minGap : 180
}

const uniquePaletteColors = (spec) => {
  const colors = new Set()
  const push = (color) => colors.add(String(color).toLowerCase())
  push(spec.palettes.outline)
  for (const group of [spec.palettes.skin, spec.palettes.hair]) {
    push(group.light)
    push(group.base)
    push(group.shadow)
  }
  for (const variant of [...spec.palettes.shirt, ...spec.palettes.pants]) {
    push(variant.light)
    push(variant.base)
    push(variant.shadow)
  }
  return [...colors]
}

const styleSuggestion = (id, direction, details) => {
  if (id === 'palette_count') {
    return direction === 'low'
      ? 'Palette is too tight. Add one accent ramp or one extra shadow for personality.'
      : 'Palette is too broad. Merge similar colors to keep a stronger visual identity.'
  }
  if (id === 'ramp_tone_pass_rate') {
    const list = details.toneFailures.slice(0, 6).join(', ')
    return `Some ramps are flat. Increase light/base/shadow separation in: ${list || 'palette ramps'}.`
  }
  if (id === 'ramp_hue_pass_rate') {
    const list = details.hueFailures.slice(0, 6).join(', ')
    return `Some ramps drift hue too much. Tighten ramp cohesion in: ${list || 'palette ramps'}.`
  }
  if (id === 'shirt_hue_gap' || id === 'pants_hue_gap') {
    return 'Color variants are too close. Push hue farther apart so options feel distinct.'
  }
  if (id === 'outline_contrast') {
    return 'Outline contrast is low. Darken outline or brighten main fills for cleaner readability.'
  }
  if (id === 'shirt_pattern_density' || id === 'pants_pattern_density') {
    return direction === 'low'
      ? 'Pattern is too subtle. Add a few larger motif clusters.'
      : 'Pattern is too busy. Reduce internal pattern density for a cleaner style.'
  }
  if (id === 'tiny_rect_ratio') {
    return 'There are too many micro-rects. Merge tiny fragments into cleaner clusters.'
  }
  return 'Tune colors and clusters for a clearer style direction.'
}

export const analyzeStyle = (spec, styleName = 'clean') => {
  const profiles = loadStyleProfiles().styleProfiles || {}
  const profile = profiles[styleName] || profiles.clean
  if (!profile) throw new Error(`Style profile "${styleName}" not found`)

  const ramps = [
    { name: 'skin', ...spec.palettes.skin },
    { name: 'hair', ...spec.palettes.hair },
    ...spec.palettes.shirt.map((variant) => ({ name: `shirt:${variant.id}`, ...variant })),
    ...spec.palettes.pants.map((variant) => ({ name: `pants:${variant.id}`, ...variant }))
  ]

  let tonePass = 0
  let huePass = 0
  const toneFailures = []
  const hueFailures = []

  for (const ramp of ramps) {
    const stepA = luminance(ramp.light) - luminance(ramp.base)
    const stepB = luminance(ramp.base) - luminance(ramp.shadow)
    const toneOk = stepA >= profile.minToneStep && stepB >= profile.minToneStep
    if (toneOk) tonePass += 1
    else toneFailures.push(ramp.name)

    const hueSpan = Math.max(
      hueDistance(hueFromHex(ramp.light), hueFromHex(ramp.base)),
      hueDistance(hueFromHex(ramp.base), hueFromHex(ramp.shadow)),
      hueDistance(hueFromHex(ramp.light), hueFromHex(ramp.shadow))
    )
    const hueOk = hueSpan <= profile.maxHueSpanPerRamp
    if (hueOk) huePass += 1
    else hueFailures.push(ramp.name)
  }

  const paletteCount = uniquePaletteColors(spec).length
  const shirtHueGap = minHueGap(spec.palettes.shirt.map((variant) => variant.base))
  const pantsHueGap = minHueGap(spec.palettes.pants.map((variant) => variant.base))

  const outline = spec.palettes.outline
  const representative = [
    spec.palettes.skin.base,
    spec.palettes.hair.base,
    spec.palettes.shirt[0]?.base,
    spec.palettes.pants[0]?.base
  ].filter(Boolean)
  const minOutlineContrast = representative.reduce(
    (min, color) => Math.min(min, contrastRatio(outline, color)),
    Number.POSITIVE_INFINITY
  )

  const shirtArea = rectArea([...spec.shirt.light, ...spec.shirt.base, ...spec.shirt.shadow])
  const pantsArea = rectArea([...spec.pants.light, ...spec.pants.base, ...spec.pants.shadow])
  const shirtPatternDensity = rectArea(spec.shirt.pattern) / Math.max(1, shirtArea)
  const pantsPatternDensity = rectArea(spec.pants.pattern) / Math.max(1, pantsArea)

  const styleRects = [...flattenRectGroup(spec.base), ...flattenRectGroup(spec.shirt), ...flattenRectGroup(spec.pants)]
  const tinyArea = rectArea(styleRects.filter(([, , w, h]) => w * h <= 2))
  const tinyRectRatio = tinyArea / Math.max(1, rectArea(styleRects))

  const metrics = [
    evaluateRangeMetric('palette_count', 'Unique palette colors', paletteCount, profile.paletteColorCount),
    evaluateRangeMetric('ramp_tone_pass_rate', 'Ramps with clear tone steps', tonePass / ramps.length, [0.8, 1]),
    evaluateRangeMetric('ramp_hue_pass_rate', 'Ramps with controlled hue span', huePass / ramps.length, [0.85, 1]),
    evaluateRangeMetric('shirt_hue_gap', 'Shirt variant hue separation', shirtHueGap, [profile.minVariantHueGap, 180]),
    evaluateRangeMetric('pants_hue_gap', 'Pants variant hue separation', pantsHueGap, [profile.minVariantHueGap, 180]),
    evaluateRangeMetric('outline_contrast', 'Min outline contrast ratio', minOutlineContrast, [profile.outlineContrastMin, 21]),
    evaluateRangeMetric('shirt_pattern_density', 'Shirt pattern density', shirtPatternDensity, profile.patternDensity),
    evaluateRangeMetric('pants_pattern_density', 'Pants pattern density', pantsPatternDensity, profile.patternDensity),
    evaluateRangeMetric('tiny_rect_ratio', 'Tiny rect area ratio', tinyRectRatio, [0, profile.tinyRectRatioMax])
  ]

  const details = { toneFailures, hueFailures }
  const suggestions = metrics
    .filter((metric) => metric.status === 'warn')
    .map((metric) => styleSuggestion(metric.id, metric.direction, details))

  const score = Math.round((metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length) * 100)

  return {
    styleName,
    metrics,
    details,
    suggestions,
    score
  }
}

const printStyleReport = (report) => {
  console.log(`[pixel-style] profile=${report.styleName}`)
  for (const metric of report.metrics) {
    const [min, max] = metric.target
    const value = metric.value.toFixed(3)
    console.log(
      `- ${metric.status.toUpperCase()} ${metric.label}: ${value} (target ${min.toFixed(3)}..${max.toFixed(3)})`
    )
  }
  if (report.details.toneFailures.length) {
    console.log(`\nTone ramp outliers: ${report.details.toneFailures.join(', ')}`)
  }
  if (report.details.hueFailures.length) {
    console.log(`Hue span outliers: ${report.details.hueFailures.join(', ')}`)
  }
  if (report.suggestions.length) {
    console.log('\nSuggestions:')
    for (const suggestion of report.suggestions) {
      console.log(`- ${suggestion}`)
    }
  } else {
    console.log('\nNo style fixes suggested.')
  }
  console.log(`\nStyle score: ${report.score}/100`)
}

const runCli = () => {
  const args = parseArgs(process.argv, { style: 'clean' })
  const spec = loadSpec()
  const report = analyzeStyle(spec, String(args.style))

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printStyleReport(report)
  }

  if (args.strict && report.metrics.some((metric) => metric.status !== 'ok')) {
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) runCli()
