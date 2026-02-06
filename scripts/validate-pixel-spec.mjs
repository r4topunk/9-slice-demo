import { expandRects, loadSpec, pointsToSet } from './pixel-utils.mjs'

const spec = loadSpec()
const fail = (msg) => {
  console.error(`ERROR: ${msg}`)
  process.exitCode = 1
}

const allRects = []
for (const group of [spec.base, spec.shirt, spec.pants, spec.boots]) {
  for (const key of Object.keys(group)) {
    allRects.push(...group[key])
  }
}

for (const [x, y, w, h] of allRects) {
  if (x < 0 || y < 0 || x + w > spec.size || y + h > spec.size) {
    fail(`Rect out of bounds: [${x},${y},${w},${h}]`)
  }
}

const shirtMask = pointsToSet([
  ...expandRects(spec.shirt.light),
  ...expandRects(spec.shirt.base),
  ...expandRects(spec.shirt.shadow),
  ...expandRects(spec.shirt.pattern)
])

const pantsMask = pointsToSet([
  ...expandRects(spec.pants.light),
  ...expandRects(spec.pants.base),
  ...expandRects(spec.pants.shadow),
  ...expandRects(spec.pants.pattern)
])

for (const point of shirtMask) {
  if (pantsMask.has(point)) {
    fail(`Shirt/Pants overlap at ${point}`)
  }
}

const [neckX, neckY] = spec.anchors.neck
if (![...shirtMask].some((p) => {
  const [x, y] = p.split(',').map(Number)
  return Math.abs(x - neckX) <= 10 && y >= neckY && y <= neckY + 14
})) {
  fail('Shirt mask is not anchored close to neck')
}

if (process.exitCode !== 1) {
  console.log('Pixel spec validation passed.')
}
