import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  boundsFromPoints,
  clamp01,
  expandRects,
  flattenRectGroup,
  loadSpec,
  loadStyleProfiles,
  parseArgs,
  pointsToSet
} from './pixel-utils.mjs'

const proportionSuggestion = (id, direction) => {
  if (id === 'head_ratio') {
    return direction === 'low'
      ? 'Head is too small for the body. Increase head mass 2-4 px or shorten torso a bit.'
      : 'Head is too large for this body. Trim top/sides 1-3 px or add torso volume.'
  }
  if (id === 'shoulder_to_head') {
    return direction === 'low'
      ? 'Shoulders are too narrow for the head. Push shoulders out 1-2 px each side.'
      : 'Shoulders are too wide for the head. Pull shoulder silhouette in by 1-2 px.'
  }
  if (id === 'neck_to_head') {
    return direction === 'low'
      ? 'Neck is too short/hidden. Add a small neck bridge before the collar.'
      : 'Neck looks long. Raise collar or shorten neck by 1-2 px.'
  }
  if (id === 'torso_to_leg') {
    return direction === 'low'
      ? 'Torso feels short versus legs. Add chest/waist volume or reduce leg length.'
      : 'Torso feels long versus legs. Shorten torso or extend legs slightly.'
  }
  if (id === 'symmetry_gap') {
    return 'Upper silhouette asymmetry is high. Keep intentional asymmetry but mirror core masses first.'
  }
  return 'Adjust silhouette masses and recheck.'
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

const computeSymmetryGap = (points, centerX, maxY) => {
  const upperSet = pointsToSet(points.filter(([, y]) => y <= maxY))
  let total = 0
  let misses = 0
  for (const key of upperSet) {
    const [x, y] = key.split(',').map(Number)
    if (x >= centerX) continue
    const mirrorX = Math.round(centerX + (centerX - x))
    total += 1
    if (!upperSet.has(`${mirrorX},${y}`)) misses += 1
  }
  if (!total) return 0
  return misses / total
}

export const analyzeProportion = (spec, profileName = 'balanced') => {
  const profiles = loadStyleProfiles().proportionProfiles || {}
  const profile = profiles[profileName] || profiles.balanced
  if (!profile) {
    throw new Error(`Proportion profile "${profileName}" not found`)
  }

  const bodyPoints = expandRects([
    ...flattenRectGroup(spec.base),
    ...flattenRectGroup(spec.shirt),
    ...flattenRectGroup(spec.pants),
    ...flattenRectGroup(spec.boots)
  ])
  const bodyBounds = boundsFromPoints(bodyPoints)
  if (!bodyBounds) throw new Error('No sprite points found in spec')

  const topY = bodyBounds.minY
  const neckY = spec.anchors.neck[1]
  const shoulderY = (spec.anchors.leftShoulder[1] + spec.anchors.rightShoulder[1]) * 0.5
  const hipY = spec.anchors.hip[1]
  const feetY = spec.anchors.feet[1]
  const waistY = spec.anchors.waist[1]

  const headPoints = bodyPoints.filter(([, y]) => y <= neckY + 1)
  const headBounds = boundsFromPoints(headPoints) || bodyBounds

  const totalHeight = Math.max(1, feetY - topY)
  const headHeight = Math.max(1, neckY - topY)
  const headWidth = Math.max(1, headBounds.width)
  const shoulderWidth = Math.max(1, spec.anchors.rightShoulder[0] - spec.anchors.leftShoulder[0])
  const neckLength = Math.max(1, shoulderY - neckY)
  const torsoHeight = Math.max(1, hipY - neckY)
  const legHeight = Math.max(1, feetY - hipY)
  const symmetryGap = computeSymmetryGap(bodyPoints, spec.anchors.headCenter[0], waistY)

  const metrics = [
    evaluateRangeMetric('head_ratio', 'Head vs total height', headHeight / totalHeight, profile.headRatio),
    evaluateRangeMetric('shoulder_to_head', 'Shoulder width vs head width', shoulderWidth / headWidth, profile.shoulderToHead),
    evaluateRangeMetric('neck_to_head', 'Neck length vs head height', neckLength / headHeight, profile.neckToHead),
    evaluateRangeMetric('torso_to_leg', 'Torso height vs leg height', torsoHeight / legHeight, profile.torsoToLeg),
    evaluateRangeMetric('symmetry_gap', 'Upper silhouette asymmetry', symmetryGap, [0, profile.symmetryGapMax])
  ]

  const suggestions = metrics
    .filter((metric) => metric.status === 'warn')
    .map((metric) => proportionSuggestion(metric.id, metric.direction))

  const score = Math.round((metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length) * 100)

  return {
    profileName,
    metrics,
    suggestions,
    score
  }
}

const printProportionReport = (report) => {
  console.log(`[pixel-proportion] profile=${report.profileName}`)
  for (const metric of report.metrics) {
    const [min, max] = metric.target
    const value = metric.value.toFixed(3)
    console.log(
      `- ${metric.status.toUpperCase()} ${metric.label}: ${value} (target ${min.toFixed(3)}..${max.toFixed(3)})`
    )
  }
  if (report.suggestions.length) {
    console.log('\nSuggestions:')
    for (const suggestion of report.suggestions) {
      console.log(`- ${suggestion}`)
    }
  } else {
    console.log('\nNo proportion fixes suggested.')
  }
  console.log(`\nProportion score: ${report.score}/100`)
}

const runCli = () => {
  const args = parseArgs(process.argv, { profile: 'balanced' })
  const spec = loadSpec()
  const report = analyzeProportion(spec, String(args.profile))

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printProportionReport(report)
  }

  if (args.strict && report.metrics.some((metric) => metric.status !== 'ok')) {
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) runCli()
