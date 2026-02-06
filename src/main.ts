import { drawNineSlice } from './nineslice'
import { createPanelTexture, DEFAULT_TEXTURE_SIZE } from './procTexture'
import { drawBitmapText, measureBitmapText } from './bitmapFont'
import skatehiveLinksCatalog from '../assets/skatehive-links-catalog.json'

type Rect = { x: number; y: number; w: number; h: number }
type TraitItem = { id: string; name: string; index: number; url: string }
type TraitCategory = {
  id: string
  name: string
  order: number
  folder: string
  items: TraitItem[]
}
type TraitCatalog = { categories: TraitCategory[] }
type PanelView = 'categories' | 'items'
type ButtonKind = 'category' | 'item' | 'nav'
type Button = {
  id: string
  kind: ButtonKind
  rect: Rect
  onClick: () => void
}
type Layout = {
  panel: Rect
  header: Rect
  footer: Rect
  previewCard: Rect
  previewInner: Rect
  rightCard: Rect
  inventoryCard: Rect
  inventoryHead: Rect
  backButton: Rect
  randomButton: Rect
  gridViewport: Rect
  compact: boolean
  mobile: boolean
}
type ItemGridMetrics = {
  cols: number
  gap: number
  cellW: number
  cellH: number
  rows: number
  contentH: number
  topPadding: number
  maxScroll: number
}
type CategoryGridMetrics = {
  gap: number
  rows: number
  cellW: number
  cellH: number
  contentH: number
  maxScroll: number
}
type PointerScrollMode = 'none' | 'categories' | 'items'

const toTitle = (raw: string) => raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
const buildCatalog = (): TraitCategory[] => {
  const source = skatehiveLinksCatalog as TraitCatalog
  return source.categories
    .map((category) => ({
      ...category,
      name: toTitle(category.name),
      items: [...category.items].sort((a, b) => a.index - b.index)
    }))
    .sort((a, b) => a.order - b.order)
}

const categories = buildCatalog()
if (!categories.length) {
  throw new Error('Trait catalog missing in assets/skatehive-links-catalog.json')
}

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')
if (!canvas) throw new Error('Canvas missing')

const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('2D context missing')

const panelTexture = createPanelTexture(DEFAULT_TEXTURE_SIZE)
const compositeCanvas = document.createElement('canvas')
const compositeCtx = compositeCanvas.getContext('2d')
if (!compositeCtx) throw new Error('Composite context missing')

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const ir = (value: number) => Math.round(value)
const insetRect = (rect: Rect, padding: number): Rect => ({
  x: ir(rect.x + padding),
  y: ir(rect.y + padding),
  w: Math.max(1, ir(rect.w - padding * 2)),
  h: Math.max(1, ir(rect.h - padding * 2))
})
const withinRect = (x: number, y: number, rect: Rect) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
const intersectRect = (a: Rect, b: Rect): Rect | null => {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  if (x2 <= x1 || y2 <= y1) return null
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

const UI_COLORS = {
  ink: '#020402',
  shadow: '#040804',
  panelCore: '#081108',
  panelHi: '#102210',
  panelLow: '#050d05',
  chrome: '#2ee637',
  lcdBg: '#0d190d',
  lcdAlt: '#091409',
  lcdDeep: '#060f06',
  lcdFrame: '#1b9f28',
  accent: '#b6ff55',
  dim: '#5ad35a',
  muted: '#2f8034',
  warning: '#dfff4f'
}

const UI_SPACE = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16
} as const

const UI_FRAME = {
  edge: 1,
  cardInset: 8,
  cardPad: 5,
  panelInset: 10
} as const

const imageCache = new Map<string, HTMLImageElement>()
const imageLoadInFlight = new Map<string, Promise<HTMLImageElement | null>>()
const IPFS_GATEWAY_PREFIXES = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/'
]
const TYPE_ICON_SIZE = 64

type BitmapIcon = {
  palette: Record<string, string>
  rows: string[]
}

const BITMAP_ICONS: Record<string, BitmapIcon> = {
  backgrounds: {
    palette: {
      '.': '#030703',
      a: '#145515',
      b: '#1e8b24',
      c: '#2ee637',
      d: '#b6ff55'
    },
    rows: [
      '................',
      '.aaaaaaaaaaaaaa.',
      '.abbbbbbbbbbbba.',
      '.abbbbbbbbbbbba.',
      '.abbbbbbbbbbbba.',
      '.abbbbbbbbbbbba.',
      '.abbbbbbbbbbbba.',
      '.abbbbbbbbbbbba.',
      '.acccccccccccca.',
      '.acccccccccccca.',
      '.acccccccccccca.',
      '.acccccccccccca.',
      '.adddddddddddda.',
      '.adddddddddddda.',
      '.aaaaaaaaaaaaaa.',
      '................'
    ]
  },
  bodies: {
    palette: {
      '.': '#030703',
      a: '#145515',
      b: '#2ee637',
      c: '#1e8b24',
      d: '#b6ff55'
    },
    rows: [
      '................',
      '......aaa.......',
      '.....abdda......',
      '....abbbdda.....',
      '...abbbbbdba....',
      '...abbbbbbba....',
      '..abbbbbbbbba...',
      '..abbbbbbbbba...',
      '.abcccccccccbba.',
      '.abccccccccccba.',
      '.abccccccccccba.',
      '..abccccccccba..',
      '..abcccbbcccba..',
      '...abbb..bbb....',
      '..aabb....bbaa..',
      '...aa......aa...',
      '................',
      '................'
    ]
  },
  accessories: {
    palette: {
      '.': '#030703',
      a: '#2ee637',
      b: '#1e8b24',
      c: '#145515',
      d: '#b6ff55'
    },
    rows: [
      '................',
      '....aaaaaaaa....',
      '...abbbbbbbba...',
      '..abbbbbbbbbba..',
      '..abbbbbbbbbba..',
      '...abbbbbbbba...',
      '....accccccca....',
      '.....accccca.....',
      '......accca......',
      '.......adda......',
      '......adddda.....',
      '.....adddddda....',
      '......adddda.....',
      '.......adda......',
      '................',
      '................'
    ]
  },
  heads: {
    palette: {
      '.': '#030703',
      a: '#d6ff87',
      b: '#8ae74f',
      c: '#2ee637',
      d: '#145515'
    },
    rows: [
      '.......a........',
      '.......ab.......',
      '......abca......',
      '......bccb......',
      '...a..bccb..a...',
      '....a.bccb.a....',
      '..aa.bcccb.aa...',
      '.aa.bccddccb.aa.',
      'aa.bccddddccb.aa',
      '.aa.bccddddccbaa',
      '..aa.bccdddccaa.',
      '...a.bccddccb...',
      '..a..bccdcc..a..',
      '....a.bbdb.a....',
      '.....a.bdb......',
      '.......d........'
    ]
  },
  glasses: {
    palette: {
      '.': '#030703',
      a: '#2ee637',
      b: '#145515'
    },
    rows: [
      '................',
      '................',
      '................',
      '..aaaaa..aaaaa..',
      '.aabbbbaabbbbaa.',
      '.abbbbbbbbbbbba.',
      '.abbbbbbbbbbbba.',
      '..aaaaa..aaaaa..',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ]
  }
}
BITMAP_ICONS.background = BITMAP_ICONS.backgrounds
BITMAP_ICONS.body = BITMAP_ICONS.bodies

const createTraitTypeIcon = (categoryId: string) => {
  const icon = document.createElement('canvas')
  icon.width = TYPE_ICON_SIZE
  icon.height = TYPE_ICON_SIZE
  const iconCtx = icon.getContext('2d')
  if (!iconCtx) throw new Error('Type icon context missing')
  iconCtx.imageSmoothingEnabled = false

  const fallback: BitmapIcon = {
    palette: { '.': '#030703', a: '#1e8b24', b: '#b6ff55' },
    rows: [
      '................',
      '....aaaaaaaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....abbbbbaa....',
      '....aaaaaaaa....',
      '................',
      '................',
      '................'
    ]
  }

  const spec = BITMAP_ICONS[categoryId] ?? fallback
  const pixelSize = 4
  for (let y = 0; y < spec.rows.length; y += 1) {
    const row = spec.rows[y]
    for (let x = 0; x < row.length; x += 1) {
      const key = row[x]
      const color = spec.palette[key]
      if (!color) continue
      iconCtx.fillStyle = color
      iconCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    }
  }

  return icon
}

const parseIpfsPath = (url: string) => {
  if (url.startsWith('ipfs://')) {
    return url.slice('ipfs://'.length).replace(/^\/+/, '')
  }
  const marker = '/ipfs/'
  const markerIndex = url.indexOf(marker)
  if (markerIndex >= 0) {
    return url.slice(markerIndex + marker.length).replace(/^\/+/, '')
  }
  return ''
}

const gatewayCandidatesFor = (url: string) => {
  const path = parseIpfsPath(url)
  if (!path) return [url]

  const candidates = [url, ...IPFS_GATEWAY_PREFIXES.map((prefix) => `${prefix}${path}`)]
  return Array.from(new Set(candidates))
}

const loadImageRaw = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth !== image.naturalHeight || image.naturalWidth < 8) {
        reject(new Error(`Invalid trait dimensions for ${url}: ${image.naturalWidth}x${image.naturalHeight}`))
        return
      }
      resolve(image)
    }
    image.onerror = () => reject(new Error(`Failed to load ${url}`))
    image.src = url
  })

const syncCompositeSize = (image: HTMLImageElement) => {
  const size = Math.max(image.naturalWidth, image.naturalHeight)
  if (!Number.isFinite(size) || size <= 0) return
  if (size === state.sourceSize) return
  state.sourceSize = size
  compositeCanvas.width = size
  compositeCanvas.height = size
}

const ensureImageLoaded = (url: string) => {
  const cached = imageCache.get(url)
  if (cached) return Promise.resolve(cached)

  const inFlight = imageLoadInFlight.get(url)
  if (inFlight) return inFlight

  const task = (async () => {
    const candidates = gatewayCandidatesFor(url)
    for (const candidate of candidates) {
      try {
        const image = await loadImageRaw(candidate)
        syncCompositeSize(image)
        imageCache.set(url, image)
        imageCache.set(candidate, image)
        return image
      } catch {
        // Keep trying other gateways.
      }
    }
    return null
  })().finally(() => {
    imageLoadInFlight.delete(url)
  })

  imageLoadInFlight.set(url, task)
  return task
}

const state = {
  viewportW: 0,
  viewportH: 0,
  pixelRatio: 1,
  panelView: 'categories' as PanelView,
  selectedCategory: 0,
  selectedByCategory: Object.fromEntries(categories.map((category) => [category.id, 0])) as Record<string, number>,
  scrollByCategory: Object.fromEntries(categories.map((category) => [category.id, 0])) as Record<string, number>,
  categoryScroll: 0,
  hoverId: null as string | null,
  activeId: null as string | null,
  activePointerId: null as number | null,
  pointerStartY: 0,
  pointerStartScroll: -1,
  pointerDraggingScroll: false,
  pointerScrollMode: 'none' as PointerScrollMode,
  pointerScrollCategoryId: null as string | null,
  loading: true,
  sourceSize: 32,
  now: performance.now(),
  pulse: 0,
  status: 'READY: SELECT A TRAIT TYPE'
}

const buttons: Button[] = []
let latestLayout: Layout | null = null
const typeIcons = new Map(categories.map((category) => [category.id, createTraitTypeIcon(category.id)]))
const MATRIX_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const matrix = {
  cell: 14,
  cols: 0,
  rows: 0,
  drops: [] as number[],
  speeds: [] as number[],
  trail: [] as number[]
}

const hashNoise = (a: number, b: number, c: number) => {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123
  return value - Math.floor(value)
}

const resetMatrixRain = () => {
  matrix.cols = Math.max(1, Math.ceil(state.viewportW / matrix.cell))
  matrix.rows = Math.max(1, Math.ceil(state.viewportH / matrix.cell))
  matrix.drops = new Array(matrix.cols)
  matrix.speeds = new Array(matrix.cols)
  matrix.trail = new Array(matrix.cols)

  for (let i = 0; i < matrix.cols; i += 1) {
    matrix.drops[i] = -Math.floor(hashNoise(i, matrix.rows, 1) * matrix.rows)
    matrix.speeds[i] = 8 + hashNoise(i, matrix.cols, 2) * 12
    matrix.trail[i] = 8 + Math.floor(hashNoise(i, matrix.cols, 3) * 14)
  }
}

const resize = () => {
  const visualViewport = window.visualViewport
  state.pixelRatio = window.devicePixelRatio || 1
  state.viewportW = ir(visualViewport?.width ?? window.innerWidth)
  state.viewportH = ir(visualViewport?.height ?? window.innerHeight)
  canvas.width = Math.round(state.viewportW * state.pixelRatio)
  canvas.height = Math.round(state.viewportH * state.pixelRatio)
  canvas.style.width = `${state.viewportW}px`
  canvas.style.height = `${state.viewportH}px`
  ctx.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0)
  resetMatrixRain()
}

const currentCategory = () => categories[state.selectedCategory]
const selectedIndex = (category: TraitCategory) => state.selectedByCategory[category.id] ?? 0
const selectedItem = (category: TraitCategory) => {
  const index = clamp(selectedIndex(category), 0, Math.max(0, category.items.length - 1))
  return category.items[index]
}

const setSelectedItem = (category: TraitCategory, index: number) => {
  const clamped = clamp(index, 0, Math.max(0, category.items.length - 1))
  state.selectedByCategory[category.id] = clamped
}

const LAST_SELECTION_KEY = 'skatehive-last-selection'

const selectionSignature = () =>
  categories.map((category) => `${category.id}:${selectedIndex(category)}`).join('|')

const randomizeAllTraits = () => {
  for (const category of categories) {
    setSelectedItem(category, Math.floor(Math.random() * category.items.length))
  }
  try {
    window.localStorage.setItem(LAST_SELECTION_KEY, selectionSignature())
  } catch {
    // Ignore storage failures (private mode / restricted browser settings).
  }
  state.status = 'OK: RANDOMIZED ALL TRAITS'
}

const randomizeOnLoad = () => {
  let previous = ''
  try {
    previous = window.localStorage.getItem(LAST_SELECTION_KEY) ?? ''
  } catch {
    previous = ''
  }

  const maxAttempts = 12
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    randomizeAllTraits()
    if (!previous || selectionSignature() !== previous) break
  }
  state.status = 'READY: SELECT A TRAIT TYPE'
}

const composeAvatar = () => {
  if (!categories.length) return
  compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height)

  for (const category of categories) {
    const item = selectedItem(category)
    if (!item) continue
    const image = imageCache.get(item.url)
    if (!image) {
      void ensureImageLoaded(item.url)
      continue
    }
    const targetRatio = compositeCanvas.width / compositeCanvas.height
    const sourceRatio = image.naturalWidth / image.naturalHeight
    let sx = 0
    let sy = 0
    let sw = image.naturalWidth
    let sh = image.naturalHeight

    // Fill the square output without letterbox bars.
    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio
      sx = (image.naturalWidth - sw) * 0.5
    } else if (sourceRatio < targetRatio) {
      sh = image.naturalWidth / targetRatio
      sy = (image.naturalHeight - sh) * 0.5
    }

    compositeCtx.drawImage(image, sx, sy, sw, sh, 0, 0, compositeCanvas.width, compositeCanvas.height)
  }
}

const exportCharacterPng = () => {
  composeAvatar()
  const fileName = `${categories
    .map((category) => selectedItem(category)?.id ?? category.id)
    .join('_')}.png`

  const download = (href: string) => {
    const link = document.createElement('a')
    link.href = href
    link.download = fileName
    link.click()
  }

  if (compositeCanvas.toBlob) {
    compositeCanvas.toBlob((blob) => {
      if (!blob) {
        download(compositeCanvas.toDataURL('image/png'))
        return
      }
      const objectUrl = URL.createObjectURL(blob)
      download(objectUrl)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
    }, 'image/png')
    return
  }

  download(compositeCanvas.toDataURL('image/png'))
}

const computeLayout = (): Layout => {
  const margin = state.viewportW < 760 ? UI_SPACE.md : UI_SPACE.xl + UI_SPACE.sm
  const maxW = 1240
  const maxH = 820
  const panelW = Math.max(300, Math.min(maxW, state.viewportW - margin * 2))
  const panelH = Math.max(320, Math.min(maxH, state.viewportH - margin * 2))

  const panel: Rect = {
    x: ir((state.viewportW - panelW) * 0.5),
    y: ir((state.viewportH - panelH) * 0.5),
    w: ir(panelW),
    h: ir(panelH)
  }

  const mobile = panel.w < 760
  const compact = mobile || panel.w < 980 || panel.h < 620
  const headerH = mobile ? 44 : compact ? 56 : 52
  const footerH = mobile ? 38 : compact ? 42 : 36
  const bodyPadX = mobile ? UI_SPACE.md : UI_SPACE.xl
  const body = {
    x: panel.x + bodyPadX,
    y: panel.y + headerH + UI_SPACE.md,
    w: panel.w - bodyPadX * 2,
    h: panel.h - headerH - footerH - (UI_SPACE.md + UI_SPACE.sm)
  }

  let previewCard: Rect
  let rightCard: Rect
  if (mobile) {
    const gap = UI_SPACE.sm + UI_SPACE.xs
    const minPaneH = 120
    const maxPreviewH = Math.max(minPaneH, body.h - gap - minPaneH)
    let previewH = clamp(ir(body.h * 0.43), minPaneH, maxPreviewH)
    let rightH = body.h - previewH - gap
    if (rightH < minPaneH) {
      const missing = minPaneH - rightH
      previewH = Math.max(minPaneH, previewH - missing)
      rightH = body.h - previewH - gap
    }
    previewCard = { x: body.x, y: body.y, w: body.w, h: previewH }
    rightCard = { x: body.x, y: body.y + previewH + gap, w: body.w, h: Math.max(minPaneH, rightH) }
  } else {
    const minPreviewW = ir(body.w * (compact ? 0.46 : 0.48))
    const maxPreviewW = ir(body.w * 0.62)
    const squareTargetW = ir(body.h * (compact ? 0.9 : 0.96))
    const previewW = clamp(squareTargetW, minPreviewW, maxPreviewW)
    previewCard = { x: body.x, y: body.y, w: previewW, h: body.h }
    rightCard = { x: body.x + previewW + UI_SPACE.lg, y: body.y, w: body.w - previewW - UI_SPACE.lg, h: body.h }
  }

  const rightInner = insetRect(rightCard, UI_SPACE.xs)
  const inventoryCard = {
    x: rightInner.x,
    y: rightInner.y,
    w: rightInner.w,
    h: rightInner.h
  }
  const categoriesView = state.panelView === 'categories'
  const inventoryHead = {
    x: inventoryCard.x + UI_SPACE.md,
    y: inventoryCard.y + UI_SPACE.md,
    w: inventoryCard.w - UI_SPACE.md * 2,
    h: categoriesView ? (mobile ? 30 : compact ? 42 : 40) : mobile ? 56 : compact ? 64 : 58
  }
  const backButtonW = mobile ? 54 : 62
  const backButtonH = mobile ? 24 : 26
  const randomButtonW = mobile ? 70 : 78
  const randomButtonH = mobile ? 24 : 26
  const headerRightX = inventoryHead.x + inventoryHead.w - UI_SPACE.md
  const backButton = { x: headerRightX - backButtonW, y: inventoryHead.y + UI_SPACE.xs, w: backButtonW, h: backButtonH }
  const randomButton = {
    x: headerRightX - randomButtonW,
    y: inventoryHead.y + UI_SPACE.xs,
    w: randomButtonW,
    h: randomButtonH
  }

  return {
    panel,
    header: {
      x: panel.x + (mobile ? UI_SPACE.md : UI_SPACE.lg),
      y: panel.y + UI_SPACE.md,
      w: panel.w - (mobile ? UI_SPACE.md * 2 : UI_SPACE.lg * 2),
      h: mobile ? 28 : compact ? 38 : 34
    },
    footer: {
      x: panel.x + (mobile ? UI_SPACE.md : UI_SPACE.lg),
      y: panel.y + panel.h - (mobile ? 36 : compact ? 40 : 34),
      w: panel.w - (mobile ? UI_SPACE.md * 2 : UI_SPACE.lg * 2),
      h: mobile ? 28 : compact ? 30 : 28
    },
    previewCard,
    previewInner: insetRect(previewCard, UI_SPACE.lg - 2),
    rightCard,
    inventoryCard,
    inventoryHead,
    backButton,
    randomButton,
    gridViewport: {
      x: inventoryCard.x + UI_SPACE.md,
      y: inventoryHead.y + inventoryHead.h + UI_SPACE.sm,
      w: inventoryCard.w - UI_SPACE.md * 2,
      h: inventoryCard.h - inventoryHead.h - (UI_SPACE.md + UI_SPACE.sm)
    },
    compact,
    mobile
  }
}

const drawBackground = () => {
  const fade = ctx.createLinearGradient(0, 0, 0, state.viewportH)
  fade.addColorStop(0, UI_COLORS.ink)
  fade.addColorStop(0.5, UI_COLORS.shadow)
  fade.addColorStop(1, '#010301')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, state.viewportW, state.viewportH)

  const tile = 56
  for (let y = 0; y < state.viewportH; y += tile) {
    for (let x = 0; x < state.viewportW; x += tile) {
      const odd = ((x / tile) + (y / tile)) % 2 === 1
      ctx.fillStyle = odd ? '#040b04' : '#050e05'
      ctx.fillRect(x, y, tile, tile)
      ctx.fillStyle = '#113011'
      ctx.globalAlpha = 0.22
      ctx.fillRect(x, y, tile, 1)
      ctx.fillRect(x, y, 1, tile)
      ctx.globalAlpha = 1
    }
  }

  ctx.globalAlpha = 0.22
  ctx.fillStyle = UI_COLORS.chrome
  for (let y = 0; y < state.viewportH; y += 3) {
    ctx.fillRect(0, y, state.viewportW, 1)
  }
  ctx.globalAlpha = 0.08
  for (let x = 0; x < state.viewportW; x += 6) {
    ctx.fillRect(x, 0, 1, state.viewportH)
  }
  ctx.globalAlpha = 1

  const fontSize = Math.max(11, matrix.cell - 1)
  const headColor = '#dfff9a'
  const tailColor = '#38cc4a'
  const baseTick = Math.floor(state.now * 0.025)
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`
  ctx.textBaseline = 'top'

  for (let col = 0; col < matrix.cols; col += 1) {
    const x = col * matrix.cell + 1
    const headRow = Math.floor(matrix.drops[col])
    const trail = matrix.trail[col]
    for (let step = 0; step < trail; step += 1) {
      const row = headRow - step
      if (row < 0 || row >= matrix.rows) continue
      const y = row * matrix.cell
      const fade = 1 - step / trail
      const glyphIndex = Math.floor(hashNoise(col, row, baseTick + step) * MATRIX_CHARSET.length)
      const glyph = MATRIX_CHARSET[glyphIndex] ?? '0'
      ctx.fillStyle = step === 0 ? headColor : tailColor
      ctx.globalAlpha = step === 0 ? 0.9 : 0.08 + fade * 0.42
      ctx.fillText(glyph, x, y)
    }
  }
  ctx.globalAlpha = 1
}

const drawPanelShadow = (rect: Rect) => {
  ctx.fillStyle = '#0000008f'
  ctx.fillRect(rect.x + UI_SPACE.sm, rect.y + UI_SPACE.md, rect.w, rect.h)
  ctx.fillStyle = '#2ee6371e'
  ctx.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, 1)
}

const drawCard = (rect: Rect, tileCenter = false) => {
  drawNineSlice(
    ctx,
    panelTexture,
    { x: 0, y: 0, w: panelTexture.width, h: panelTexture.height },
    rect,
    { left: UI_FRAME.cardInset, right: UI_FRAME.cardInset, top: UI_FRAME.cardInset, bottom: UI_FRAME.cardInset },
    { pixelSnap: true, tileCenter }
  )
  const inner = insetRect(rect, UI_FRAME.cardPad)
  ctx.fillStyle = UI_COLORS.panelCore
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h)
  ctx.fillStyle = UI_COLORS.panelHi
  ctx.fillRect(inner.x, inner.y, inner.w, 2)
}

const drawInsetSurface = (
  rect: Rect,
  options: {
    innerColor: string
    topLine?: boolean
    bottomLine?: boolean
    sideLines?: boolean
  }
) => {
  ctx.fillStyle = UI_COLORS.panelLow
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)

  const inner = insetRect(rect, 2)
  ctx.fillStyle = options.innerColor
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h)

  ctx.fillStyle = UI_COLORS.chrome
  if (options.topLine !== false) {
    ctx.fillRect(inner.x, inner.y, inner.w, UI_FRAME.edge)
  }
  if (options.bottomLine) {
    ctx.fillRect(inner.x, inner.y + inner.h - UI_FRAME.edge, inner.w, UI_FRAME.edge)
  }
  if (options.sideLines) {
    ctx.fillRect(inner.x, inner.y, UI_FRAME.edge, inner.h)
    ctx.fillRect(inner.x + inner.w - UI_FRAME.edge, inner.y, UI_FRAME.edge, inner.h)
  }
}

const addButton = (button: Button) => {
  buttons.push(button)
}

const getItemGridMetrics = (layout: Layout, itemCount: number): ItemGridMetrics => {
  const grid = layout.gridViewport
  const gap = layout.mobile ? UI_SPACE.sm : UI_SPACE.md
  const scrollPadRight = layout.mobile ? 12 : 14
  const usableW = Math.max(1, grid.w - scrollPadRight)
  const candidateCols = [3]
  let bestScore = Number.POSITIVE_INFINITY
  let best: ItemGridMetrics = {
    cols: candidateCols[0] ?? 2,
    gap,
    cellW: Math.max(layout.mobile ? 56 : 66, grid.w),
    cellH: Math.max(layout.mobile ? 72 : 86, grid.w),
    rows: 1,
    contentH: 1,
    topPadding: 0,
    maxScroll: 0
  }

  for (const cols of candidateCols) {
    const minCellW = layout.mobile ? 56 : 66
    const cellW = Math.max(minCellW, ir((usableW - gap * (cols - 1)) / cols))
    const cellH = cellW
    const rows = Math.max(1, Math.ceil(itemCount / cols))
    const contentH = rows * (cellH + gap) - gap
    const topPadding = contentH < grid.h ? ir((grid.h - contentH) * (layout.mobile ? 0.06 : 0.12)) : 0
    const maxScroll = Math.max(0, contentH - grid.h)
    const score = Math.abs(grid.h - contentH)
    if (score < bestScore) {
      bestScore = score
      best = { cols, gap, cellW, cellH, rows, contentH, topPadding, maxScroll }
    }
  }

  return best
}

const getCategoryGridMetrics = (layout: Layout): CategoryGridMetrics => {
  const grid = layout.gridViewport
  const gap = layout.mobile ? UI_SPACE.sm : UI_SPACE.md
  const rows = Math.max(1, categories.length)
  const cellW = grid.w
  const fitCellH = ir((grid.h - gap * (rows - 1)) / rows)
  const cellH = layout.mobile ? clamp(fitCellH, 34, 74) : Math.max(74, fitCellH)
  const contentH = rows * (cellH + gap) - gap
  const maxScroll = Math.max(0, contentH - grid.h)
  return { gap, rows, cellW, cellH, contentH, maxScroll }
}

const fitBitmapLabel = (text: string, maxWidth: number, scale: number) => {
  if (measureBitmapText(text, scale) <= maxWidth) return text
  let output = text
  while (output.length > 3 && measureBitmapText(`${output}...`, scale) > maxWidth) {
    output = output.slice(0, -1)
  }
  return output.length > 3 ? `${output}...` : output
}

const drawHeader = (layout: Layout) => {
  drawInsetSurface(layout.header, {
    innerColor: '#0b1d0b',
    topLine: false,
    bottomLine: false
  })

  const title = layout.mobile ? 'SKATEHIVE' : 'SKATEHIVE TERMINAL'
  const titleScale = layout.mobile ? 1 : 2
  drawBitmapText(ctx, title, layout.header.x + UI_SPACE.md, layout.header.y + (layout.mobile ? 9 : 5), {
    scale: titleScale,
    color: UI_COLORS.accent,
    pixelSnap: true
  })
  const now = new Date()
  const hh = `${now.getHours()}`.padStart(2, '0')
  const mm = `${now.getMinutes()}`.padStart(2, '0')
  const meta = `${hh}:${mm}`
  const metaW = measureBitmapText(meta, 1)
  drawBitmapText(ctx, meta, layout.header.x + layout.header.w - metaW - UI_SPACE.lg, layout.header.y + (layout.mobile ? 9 : 7), {
    scale: 1,
    color: UI_COLORS.warning,
    pixelSnap: true
  })
}

const drawFooter = (layout: Layout) => {
  drawInsetSurface(layout.footer, {
    innerColor: '#081808',
    topLine: true
  })

  const footerText = layout.mobile
    ? state.panelView === 'items'
      ? 'TAP SELECT  DRAG SCROLL'
      : 'TAP TRAIT TYPE TO OPEN'
    : 'ENTER OPEN  ESC BACK  WHEEL SCROLL  E EXPORT  F FULLSCREEN'
  const textW = measureBitmapText(footerText, 1)
  const textX = Math.max(layout.footer.x + UI_SPACE.sm, ir(layout.footer.x + (layout.footer.w - textW) * 0.5))
  drawBitmapText(ctx, footerText, textX, layout.footer.y + (layout.mobile ? 8 : 9), {
    scale: 1,
    color: UI_COLORS.dim,
    pixelSnap: true
  })
}

const drawPreview = (layout: Layout) => {
  drawCard(layout.previewCard)

  const frame = insetRect(layout.previewInner, UI_SPACE.xs - 1)
  drawInsetSurface(frame, {
    innerColor: '#070f07',
    topLine: true
  })
  const view = insetRect(frame, 2)
  ctx.fillStyle = UI_COLORS.lcdDeep
  ctx.fillRect(view.x, view.y, view.w, view.h)

  const stageSize = Math.max(1, Math.min(view.w, view.h))
  const stage = {
    x: ir(view.x + (view.w - stageSize) * 0.5),
    y: ir(view.y + (view.h - stageSize) * 0.5),
    w: stageSize,
    h: stageSize
  }
  const topBand = { x: view.x, y: view.y, w: view.w, h: Math.max(0, stage.y - view.y) }
  const bottomBand = {
    x: view.x,
    y: stage.y + stage.h,
    w: view.w,
    h: Math.max(0, view.y + view.h - (stage.y + stage.h))
  }
  const leftBand = { x: view.x, y: stage.y, w: Math.max(0, stage.x - view.x), h: stage.h }
  const rightBand = {
    x: stage.x + stage.w,
    y: stage.y,
    w: Math.max(0, view.x + view.w - (stage.x + stage.w)),
    h: stage.h
  }

  const drawFillerBand = (band: Rect) => {
    if (band.w <= 0 || band.h <= 0) return
    ctx.fillStyle = '#061106'
    ctx.fillRect(band.x, band.y, band.w, band.h)
    ctx.fillStyle = '#0f2f0f'
    ctx.globalAlpha = 0.22
    for (let y = band.y; y < band.y + band.h; y += 3) {
      ctx.fillRect(band.x, y, band.w, 1)
    }
    ctx.globalAlpha = 1
  }

  drawFillerBand(topBand)
  drawFillerBand(bottomBand)
  drawFillerBand(leftBand)
  drawFillerBand(rightBand)

  ctx.fillStyle = '#050b05'
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h)
  ctx.fillStyle = UI_COLORS.chrome
  ctx.fillRect(stage.x, stage.y, stage.w, 1)
  ctx.fillRect(stage.x, stage.y + stage.h - 1, stage.w, 1)
  ctx.fillRect(stage.x, stage.y, 1, stage.h)
  ctx.fillRect(stage.x + stage.w - 1, stage.y, 1, stage.h)

  composeAvatar()
  const fitScaleW = stage.w / compositeCanvas.width
  const fitScaleH = stage.h / compositeCanvas.height
  const scale = clamp(Math.min(fitScaleW, fitScaleH), 0.1, 12)
  const spriteW = compositeCanvas.width * scale
  const spriteH = compositeCanvas.height * scale
  const spriteX = ir(stage.x + (stage.w - spriteW) * 0.5)
  const spriteY = ir(stage.y + (stage.h - spriteH) * 0.5)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(compositeCanvas, spriteX, spriteY, spriteW, spriteH)

  if (topBand.h >= 14) {
    const meta = `${compositeCanvas.width}x${compositeCanvas.height}`
    const metaW = measureBitmapText(meta, 1)
    drawBitmapText(ctx, meta, topBand.x + topBand.w - metaW - UI_SPACE.sm, topBand.y + Math.max(UI_SPACE.xs, topBand.h - 12), {
      scale: 1,
      color: UI_COLORS.dim,
      pixelSnap: true
    })
  }

  const category = currentCategory()
  const selected = selectedItem(category)
  if (bottomBand.h >= 14) {
    const itemLabel = `${category.name.toUpperCase()} ${selected?.name.toUpperCase() ?? ''}`
    const fitW = Math.max(30, bottomBand.w - UI_SPACE.md * 2)
    const finalLabel = fitBitmapLabel(itemLabel, fitW, 1)
    let lineY = bottomBand.y + UI_SPACE.xs
    if (bottomBand.h >= 24) {
      drawBitmapText(ctx, 'ACTIVE TRAIT', bottomBand.x + UI_SPACE.sm, bottomBand.y + UI_SPACE.xs, {
        scale: 1,
        color: UI_COLORS.warning,
        pixelSnap: true
      })
      lineY = bottomBand.h >= 30 ? bottomBand.y + 16 : bottomBand.y + 14
    }
    drawBitmapText(ctx, finalLabel, bottomBand.x + UI_SPACE.sm, lineY, {
      scale: 1,
      color: UI_COLORS.dim,
      pixelSnap: true
    })
  }
}

const drawBackButton = (layout: Layout) => {
  const hover = state.hoverId === 'nav-back'
  const active = state.activeId === 'nav-back'
  const yOffset = active ? 1 : 0
  const rect = { ...layout.backButton, y: layout.backButton.y + yOffset }

  drawInsetSurface(rect, {
    innerColor: hover ? '#0d240d' : '#0a1b0a',
    topLine: true,
    bottomLine: true,
    sideLines: true
  })

  if (hover || active) {
    ctx.fillStyle = hover ? '#2ee63718' : '#2ee6370f'
    const inner = insetRect(rect, 3)
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h)
  }

  const label = 'BACK'
  const labelW = measureBitmapText(label, 1)
  drawBitmapText(ctx, label, rect.x + ir((rect.w - labelW) * 0.5), rect.y + 8, {
    scale: 1,
    color: hover ? UI_COLORS.accent : UI_COLORS.dim,
    pixelSnap: true
  })

  addButton({
    id: 'nav-back',
    kind: 'nav',
    rect: layout.backButton,
    onClick: () => {
      state.panelView = 'categories'
      state.status = 'READY: SELECT A TRAIT TYPE'
    }
  })
}

const drawRandomButton = (layout: Layout) => {
  const hover = state.hoverId === 'nav-random'
  const active = state.activeId === 'nav-random'
  const yOffset = active ? 1 : 0
  const rect = { ...layout.randomButton, y: layout.randomButton.y + yOffset }

  drawInsetSurface(rect, {
    innerColor: hover ? '#0d240d' : '#0a1b0a',
    topLine: true,
    bottomLine: true,
    sideLines: true
  })

  if (hover || active) {
    ctx.fillStyle = hover ? '#2ee63718' : '#2ee6370f'
    const inner = insetRect(rect, 3)
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h)
  }

  const label = 'RANDOM'
  const labelW = measureBitmapText(label, 1)
  drawBitmapText(ctx, label, rect.x + ir((rect.w - labelW) * 0.5), rect.y + 8, {
    scale: 1,
    color: hover ? UI_COLORS.accent : UI_COLORS.dim,
    pixelSnap: true
  })

  addButton({
    id: 'nav-random',
    kind: 'nav',
    rect: layout.randomButton,
    onClick: randomizeAllTraits
  })
}

const drawCategorySelection = (layout: Layout) => {
  const grid = layout.gridViewport
  const metrics = getCategoryGridMetrics(layout)
  const { gap, cellW, cellH, contentH, maxScroll } = metrics
  const scroll = clamp(state.categoryScroll, 0, maxScroll)
  state.categoryScroll = scroll

  ctx.fillStyle = UI_COLORS.panelLow
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h)

  ctx.save()
  ctx.beginPath()
  ctx.rect(grid.x, grid.y, grid.w, grid.h)
  ctx.clip()

  categories.forEach((category, index) => {
    const row = index
    const x = grid.x
    const y = grid.y + row * (cellH + gap) - scroll
    if (y + cellH < grid.y || y > grid.y + grid.h) return

    const isSelected = state.selectedCategory === index
    const hover = state.hoverId === `category-${index}`
    ctx.fillStyle = isSelected ? '#0f2410' : hover ? '#0c1d0d' : '#091709'
    ctx.fillRect(x, y, cellW, cellH)
    if (isSelected || hover) {
      const border = isSelected ? UI_COLORS.accent : UI_COLORS.chrome
      ctx.fillStyle = border
      ctx.fillRect(x, y, cellW, 1)
      ctx.fillRect(x, y + cellH - 1, cellW, 1)
      ctx.fillRect(x, y, 1, cellH)
      ctx.fillRect(x + cellW - 1, y, 1, cellH)
    }

    const icon = typeIcons.get(category.id)
    let iconSize = 0
    let iconX = x + (layout.mobile ? UI_SPACE.sm : UI_SPACE.md)
    if (icon) {
      iconSize = layout.mobile ? Math.max(22, Math.min(40, cellH - 10)) : Math.max(46, Math.min(64, cellH - 18))
      const iconY = y + ir((cellH - iconSize) * 0.5)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(icon, iconX, iconY, iconSize, iconSize)
    }

    const textX = iconSize > 0 ? iconX + iconSize + (layout.mobile ? UI_SPACE.md : UI_SPACE.lg) : x + UI_SPACE.md
    const compactCell = layout.mobile || cellH < 58
    if (compactCell) {
      drawBitmapText(ctx, category.name.toUpperCase(), textX, y + ir(cellH * 0.52), {
        scale: 1,
        color: isSelected ? UI_COLORS.accent : UI_COLORS.dim,
        pixelSnap: true
      })
    } else {
      const titleY = y + ir(cellH * 0.48)
      drawBitmapText(ctx, category.name.toUpperCase(), textX, titleY, {
        scale: 1,
        color: isSelected ? UI_COLORS.accent : UI_COLORS.dim,
        pixelSnap: true
      })
      drawBitmapText(ctx, `${category.items.length} ITEMS`, textX, titleY + 16, {
        scale: 1,
        color: isSelected ? UI_COLORS.warning : UI_COLORS.muted,
        pixelSnap: true
      })
    }

    const clipped = intersectRect({ x, y, w: cellW, h: cellH }, grid)
    if (clipped) {
      addButton({
        id: `category-${index}`,
        kind: 'category',
        rect: clipped,
        onClick: () => {
          state.selectedCategory = index
          state.panelView = 'items'
          state.status = `OPEN: ${category.name.toUpperCase()} INDEX`
        }
      })
    }
  })

  ctx.restore()

  if (maxScroll > 0) {
    const track = { x: grid.x + grid.w - UI_SPACE.sm, y: grid.y + UI_SPACE.xs, w: UI_SPACE.xs, h: grid.h - UI_SPACE.md }
    const thumbH = Math.max(16, ir((grid.h / contentH) * track.h))
    const thumbY = track.y + ir((scroll / maxScroll) * Math.max(0, track.h - thumbH))
    ctx.fillStyle = '#0a1f0a'
    ctx.fillRect(track.x, track.y, track.w, track.h)
    ctx.fillStyle = UI_COLORS.chrome
    ctx.fillRect(track.x, thumbY, track.w, thumbH)
  }
}

const drawItemSelection = (layout: Layout) => {
  const category = currentCategory()

  const grid = layout.gridViewport
  const metrics = getItemGridMetrics(layout, category.items.length)
  const { gap, cols, cellW, cellH, contentH, maxScroll, topPadding } = metrics
  const scroll = clamp(state.scrollByCategory[category.id] ?? 0, 0, maxScroll)
  state.scrollByCategory[category.id] = scroll

  ctx.fillStyle = UI_COLORS.panelLow
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h)

  ctx.save()
  ctx.beginPath()
  ctx.rect(grid.x, grid.y, grid.w, grid.h)
  ctx.clip()

  category.items.forEach((item, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = grid.x + col * (cellW + gap)
    const y = grid.y + topPadding + row * (cellH + gap) - scroll
    if (y > grid.y + grid.h || y + cellH < grid.y) return

    const selectedItemIndex = selectedIndex(category)
    const isSelected = selectedItemIndex === index
    const hover = state.hoverId === `item-${category.id}-${index}`

    ctx.fillStyle = isSelected ? '#0f2410' : hover ? '#0c1d0d' : '#091709'
    ctx.fillRect(x, y, cellW, cellH)
    const edge = isSelected ? UI_COLORS.accent : hover ? UI_COLORS.chrome : '#1f3d1f'
    ctx.fillStyle = edge
    ctx.fillRect(x, y, cellW, 1)
    ctx.fillRect(x, y + cellH - 1, cellW, 1)
    ctx.fillRect(x, y, 1, cellH)
    ctx.fillRect(x + cellW - 1, y, 1, cellH)

    const image = imageCache.get(item.url)
    if (image) {
      const thumbPad = layout.mobile ? 4 : 5
      const thumbSize = cellW - thumbPad * 2
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(image, x + thumbPad, y + thumbPad, thumbSize, thumbSize)
    } else {
      void ensureImageLoaded(item.url)
    }

    const clipped = intersectRect({ x, y, w: cellW, h: cellH }, grid)
    if (clipped) {
      addButton({
        id: `item-${category.id}-${index}`,
        kind: 'item',
        rect: clipped,
        onClick: () => setSelectedItem(category, index)
      })
    }
  })

  ctx.restore()

  if (maxScroll > 0) {
    const track = { x: grid.x + grid.w - UI_SPACE.sm, y: grid.y + UI_SPACE.xs, w: UI_SPACE.xs, h: grid.h - UI_SPACE.md }
    const thumbH = Math.max(16, ir((grid.h / contentH) * track.h))
    const thumbY = track.y + ir((scroll / maxScroll) * Math.max(0, track.h - thumbH))
    ctx.fillStyle = '#0a1f0a'
    ctx.fillRect(track.x, track.y, track.w, track.h)
    ctx.fillStyle = UI_COLORS.chrome
    ctx.fillRect(track.x, thumbY, track.w, thumbH)
  }

}

const drawInventory = (layout: Layout) => {
  drawCard(layout.rightCard)
  ctx.fillStyle = '#081408'
  ctx.fillRect(layout.inventoryCard.x, layout.inventoryCard.y, layout.inventoryCard.w, layout.inventoryCard.h)
  const inventoryInner = insetRect(layout.inventoryCard, 2)
  ctx.fillStyle = '#0a1a0a'
  ctx.fillRect(inventoryInner.x, inventoryInner.y, inventoryInner.w, inventoryInner.h)

  drawInsetSurface(layout.inventoryHead, {
    innerColor: '#0b1d0b',
    topLine: false
  })

  const title = state.panelView === 'categories'
    ? 'TRAIT TYPES'
    : layout.mobile
      ? currentCategory().name.toUpperCase()
      : `${currentCategory().name.toUpperCase()} TRAITS`
  const titleMaxW = state.panelView === 'categories'
    ? layout.inventoryHead.w - layout.randomButton.w - UI_SPACE.lg * 3
    : layout.inventoryHead.w - UI_SPACE.lg * 2
  const titleText = fitBitmapLabel(title, Math.max(40, titleMaxW), layout.mobile ? 1 : 2)
  drawBitmapText(ctx, titleText, layout.inventoryHead.x + UI_SPACE.md, layout.inventoryHead.y + UI_SPACE.sm, {
    scale: layout.mobile ? 1 : 2,
    color: UI_COLORS.accent,
    pixelSnap: true
  })

  if (state.panelView === 'categories') {
    drawRandomButton(layout)
    drawCategorySelection(layout)
  } else {
    drawItemSelection(layout)
    drawBackButton(layout)
  }

  drawBitmapText(ctx, state.status.toUpperCase(), layout.gridViewport.x + UI_SPACE.xs, layout.gridViewport.y + layout.gridViewport.h - UI_SPACE.sm, {
    scale: 1,
    color: UI_COLORS.dim,
    pixelSnap: true
  })
}

const drawLoading = () => {
  drawBackground()
  ctx.fillStyle = '#000000c2'
  ctx.fillRect(0, 0, state.viewportW, state.viewportH)
  const label = 'BOOTING SKATEHIVE TERMINAL...'
  const labelW = measureBitmapText(label, 2)
  drawBitmapText(ctx, label, ir((state.viewportW - labelW) * 0.5), ir(state.viewportH * 0.5), {
    scale: 2,
    color: UI_COLORS.accent,
    pixelSnap: true
  })
}

const render = () => {
  buttons.length = 0
  if (state.loading) {
    drawLoading()
    return
  }

  drawBackground()
  const layout = computeLayout()
  latestLayout = layout

  drawPanelShadow(layout.panel)
  drawNineSlice(
    ctx,
    panelTexture,
    { x: 0, y: 0, w: panelTexture.width, h: panelTexture.height },
    layout.panel,
    {
      left: UI_FRAME.panelInset,
      right: UI_FRAME.panelInset,
      top: UI_FRAME.panelInset,
      bottom: UI_FRAME.panelInset
    },
    { pixelSnap: true, tileCenter: false }
  )

  drawHeader(layout)
  drawPreview(layout)
  drawInventory(layout)
  drawFooter(layout)
}

const findHoveredButton = (x: number, y: number) => {
  for (let i = buttons.length - 1; i >= 0; i -= 1) {
    const button = buttons[i]
    if (withinRect(x, y, button.rect)) return button
  }
  return null
}

const updateHover = (x: number, y: number) => {
  const hovered = findHoveredButton(x, y)
  state.hoverId = hovered?.id ?? null
  canvas.style.cursor = hovered ? 'pointer' : 'default'
}

const pointerPos = (event: MouseEvent | WheelEvent | PointerEvent) => {
  const bounds = canvas.getBoundingClientRect()
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top
  }
}

const resetPointerInteraction = () => {
  state.activePointerId = null
  state.activeId = null
  state.pointerStartScroll = -1
  state.pointerDraggingScroll = false
  state.pointerScrollMode = 'none'
  state.pointerScrollCategoryId = null
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const pos = pointerPos(event)
  updateHover(pos.x, pos.y)
  const hovered = findHoveredButton(pos.x, pos.y)
  state.activePointerId = event.pointerId
  state.activeId = hovered?.id ?? null
  state.pointerStartY = pos.y
  state.pointerStartScroll = -1
  state.pointerDraggingScroll = false
  state.pointerScrollMode = 'none'
  state.pointerScrollCategoryId = null

  if (latestLayout && withinRect(pos.x, pos.y, latestLayout.gridViewport)) {
    if (state.panelView === 'items') {
      const category = currentCategory()
      state.pointerStartScroll = state.scrollByCategory[category.id] ?? 0
      state.pointerScrollMode = 'items'
      state.pointerScrollCategoryId = category.id
    } else if (state.panelView === 'categories') {
      state.pointerStartScroll = state.categoryScroll
      state.pointerScrollMode = 'categories'
    }
  }

  canvas.setPointerCapture(event.pointerId)
})

canvas.addEventListener('pointermove', (event) => {
  const pos = pointerPos(event)
  if (event.pointerType === 'mouse' || state.activePointerId === event.pointerId) {
    updateHover(pos.x, pos.y)
  }

  if (state.activePointerId !== event.pointerId) return
  if (!latestLayout || state.pointerStartScroll < 0 || state.pointerScrollMode === 'none') return

  const dragDeltaY = pos.y - state.pointerStartY
  if (Math.abs(dragDeltaY) > 6) {
    state.pointerDraggingScroll = true
    state.activeId = null
  }
  if (!state.pointerDraggingScroll) return

  if (state.pointerScrollMode === 'categories') {
    const metrics = getCategoryGridMetrics(latestLayout)
    state.categoryScroll = clamp(state.pointerStartScroll - dragDeltaY, 0, metrics.maxScroll)
  } else {
    const category = categories.find((entry) => entry.id === state.pointerScrollCategoryId) ?? currentCategory()
    const metrics = getItemGridMetrics(latestLayout, category.items.length)
    state.scrollByCategory[category.id] = clamp(state.pointerStartScroll - dragDeltaY, 0, metrics.maxScroll)
  }
  event.preventDefault()
})

canvas.addEventListener('pointerup', (event) => {
  if (state.activePointerId !== event.pointerId) return
  const pos = pointerPos(event)
  const hovered = findHoveredButton(pos.x, pos.y)
  const shouldClick = !state.pointerDraggingScroll && hovered && state.activeId === hovered.id
  resetPointerInteraction()

  if (shouldClick && hovered) hovered.onClick()
  if (event.pointerType === 'mouse') {
    updateHover(pos.x, pos.y)
  } else {
    state.hoverId = null
    canvas.style.cursor = 'default'
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId)
  }
})

canvas.addEventListener('pointercancel', (event) => {
  if (state.activePointerId === event.pointerId) resetPointerInteraction()
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId)
  }
})

canvas.addEventListener('pointerleave', (event) => {
  if (event.pointerType !== 'mouse' || state.activePointerId !== null) return
  state.hoverId = null
  canvas.style.cursor = 'default'
})

canvas.addEventListener('wheel', (event) => {
  if (!latestLayout) return
  const pos = pointerPos(event)
  if (!withinRect(pos.x, pos.y, latestLayout.gridViewport)) return

  event.preventDefault()
  const deltaScale = latestLayout.mobile ? 1 : 0.75
  if (state.panelView === 'categories') {
    const metrics = getCategoryGridMetrics(latestLayout)
    state.categoryScroll = clamp(state.categoryScroll + event.deltaY * deltaScale, 0, metrics.maxScroll)
    return
  }

  if (state.panelView === 'items') {
    const category = currentCategory()
    const metrics = getItemGridMetrics(latestLayout, category.items.length)
    const next = clamp((state.scrollByCategory[category.id] ?? 0) + event.deltaY * deltaScale, 0, metrics.maxScroll)
    state.scrollByCategory[category.id] = next
  }
}, { passive: false })

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase()
  const category = currentCategory()
  const index = selectedIndex(category)

  if (event.key === 'Escape' && state.panelView === 'items') {
    state.panelView = 'categories'
    state.status = 'READY: SELECT A TRAIT TYPE'
    return
  }
  if (event.key === 'Enter' && state.panelView === 'categories') {
    state.panelView = 'items'
    state.status = `OPEN: ${category.name.toUpperCase()} INDEX`
    return
  }
  if (event.key === 'ArrowUp') {
    state.selectedCategory = (state.selectedCategory + categories.length - 1) % categories.length
    if (state.panelView === 'items') {
      state.status = `OPEN: ${currentCategory().name.toUpperCase()} INDEX`
    }
    return
  }
  if (event.key === 'ArrowDown') {
    state.selectedCategory = (state.selectedCategory + 1) % categories.length
    if (state.panelView === 'items') {
      state.status = `OPEN: ${currentCategory().name.toUpperCase()} INDEX`
    }
    return
  }
  if (event.key === 'ArrowLeft' && state.panelView === 'items') {
    setSelectedItem(category, index - 1)
    return
  }
  if (event.key === 'ArrowRight' && state.panelView === 'items') {
    setSelectedItem(category, index + 1)
    return
  }
  if (key === 'r') {
    randomizeAllTraits()
    return
  }
  if (key === 'e') {
    exportCharacterPng()
    state.status = 'OK: EXPORTED PNG'
    return
  }
  if (key === 'f') {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(() => undefined)
    } else {
      document.exitFullscreen().catch(() => undefined)
    }
  }
})

const update = (dt: number) => {
  state.pulse += dt * 2.5
  for (let i = 0; i < matrix.cols; i += 1) {
    matrix.drops[i] += matrix.speeds[i] * dt
    if (matrix.drops[i] - matrix.trail[i] > matrix.rows) {
      matrix.drops[i] = -Math.floor(hashNoise(i, state.now, 7) * matrix.rows)
      matrix.speeds[i] = 8 + hashNoise(i, state.now, 9) * 12
      matrix.trail[i] = 8 + Math.floor(hashNoise(i, state.now, 11) * 14)
    }
  }
}

const tick = (now: number) => {
  const dt = Math.min(0.05, (now - state.now) / 1000)
  state.now = now
  update(dt)
  render()
  requestAnimationFrame(tick)
}

window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)))
  for (let i = 0; i < steps; i += 1) update(1 / 60)
  render()
}

window.exportCharacterPng = exportCharacterPng

window.render_game_to_text = () => {
  const layout = latestLayout ?? computeLayout()
  return JSON.stringify({
    mode: 'skatehive-trait-studio',
    coordinateSystem: 'origin=(0,0) top-left; +x right; +y down',
    viewport: { width: state.viewportW, height: state.viewportH },
    panelView: state.panelView,
    selectedCategory: currentCategory().id,
    selectedTraits: Object.fromEntries(
      categories.map((category) => {
        const item = selectedItem(category)
        return [category.id, item ? { id: item.id, name: item.name } : null]
      })
    ),
    scroll: {
      categories: state.categoryScroll
    },
    layout: {
      panel: layout.panel,
      previewCard: layout.previewCard,
      inventoryCard: layout.inventoryCard,
      gridViewport: layout.gridViewport,
      compact: layout.compact,
      mobile: layout.mobile
    },
    interactives: buttons.map((button) => ({ id: button.id, kind: button.kind, rect: button.rect }))
  })
}

declare global {
  interface Window {
    advanceTime: (ms: number) => void
    exportCharacterPng: () => void
    render_game_to_text: () => string
  }
}

const bootstrap = async () => {
  resize()
  canvas.style.touchAction = 'none'
  window.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('resize', resize)
  window.visualViewport?.addEventListener('scroll', resize)

  compositeCanvas.width = state.sourceSize
  compositeCanvas.height = state.sourceSize
  randomizeOnLoad()

  const activeUrls = Array.from(new Set(
    categories
      .map((category) => selectedItem(category)?.url)
      .filter((url): url is string => Boolean(url))
  ))
  void Promise.all(activeUrls.map((url) => ensureImageLoaded(url))).then((loaded) => {
    if (!loaded.some(Boolean)) {
      state.status = 'WARN: TRAITS LOADING FROM FALLBACK GATEWAYS'
    }
  })

  state.loading = false
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  state.status = `ERROR: LOAD FAILURE: ${message}`
  state.loading = false
})

requestAnimationFrame(tick)
