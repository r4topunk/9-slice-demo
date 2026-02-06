import { drawNineSlice } from './nineslice'
import { createPanelTexture, DEFAULT_TEXTURE_SIZE } from './procTexture'
import { drawBitmapText, measureBitmapText } from './bitmapFont'
import spec from '../assets/pixel-spec.json'

type Rect = { x: number; y: number; w: number; h: number }
type Variant = { id: string; name: string; light: string; base: string; shadow: string }
type Step = [number, number, number, number]
type ButtonKind = 'control' | 'random' | 'swatch'

type PixelSpec = {
  size: number
  palettes: {
    skin: { light: string; base: string; shadow: string }
    hair: { light: string; base: string; shadow: string }
    outline: string
    shirt: Variant[]
    pants: Variant[]
  }
  anchors: Record<string, [number, number]>
  base: Record<string, Step[]>
  shirt: Record<string, Step[]>
  pants: Record<string, Step[]>
  boots: Record<string, Step[]>
}

type Layout = {
  panel: Rect
  header: Rect
  footer: Rect
  avatarPane: Rect
  controlsPane: Rect
  portraitFrame: Rect
  shirtCard: Rect
  pantsCard: Rect
  randomButton: Rect
  infoCard: Rect
  mode: 'wide' | 'stacked'
}

type Button = {
  id: string
  kind: ButtonKind
  label?: string
  rect: Rect
  onClick: () => void
  swatchColor?: string
  active?: boolean
}

const data = spec as unknown as PixelSpec

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')
if (!canvas) throw new Error('Canvas missing')
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('2D context missing')

const panelTexture = createPanelTexture(DEFAULT_TEXTURE_SIZE)
const spriteCanvas = document.createElement('canvas')
spriteCanvas.width = data.size
spriteCanvas.height = data.size
const spriteCtx = spriteCanvas.getContext('2d')
if (!spriteCtx) throw new Error('Sprite context missing')

const buttons: Button[] = []
const state = {
  shirtIndex: 0,
  pantsIndex: 0,
  hoverId: null as string | null,
  lastFrame: performance.now(),
  blinkTimer: 0,
  breatheTimer: 0,
  viewportW: 0,
  viewportH: 0,
  pixelRatio: 1
}

const ui = {
  bgTop: '#2d2117',
  bgMid: '#241a13',
  bgBottom: '#1a130f',
  bgTileA: '#2f241b',
  bgTileB: '#372a1f',
  bgGrid: '#4a3a2b2f',
  panelShadow: '#0000005a',
  cardFill: '#d4c19a',
  cardInner: '#f0e2c2',
  cardShade: '#b59663',
  cardEdge: '#4a3318',
  titleBar: '#2f4a66',
  titleBarHi: '#5f7c99',
  gold: '#b69357',
  textDark: '#24170d',
  textMid: '#3b2816',
  textLight: '#f2e7d2',
  swatchFrame: '#2a1a0f',
  buttonFill: '#7a623d',
  buttonFillHover: '#8b7246',
  buttonBlue: '#3c5672',
  buttonBlueHover: '#4a6887'
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const ir = (value: number) => Math.round(value)

const insetRect = (rect: Rect, padding: number): Rect => ({
  x: ir(rect.x + padding),
  y: ir(rect.y + padding),
  w: Math.max(1, ir(rect.w - padding * 2)),
  h: Math.max(1, ir(rect.h - padding * 2))
})

const shortName = (value: string) => value.toUpperCase().replace(' SHIRT', '').replace(' PANTS', '')

const resize = () => {
  state.pixelRatio = window.devicePixelRatio || 1
  state.viewportW = window.innerWidth
  state.viewportH = window.innerHeight
  canvas.width = Math.round(state.viewportW * state.pixelRatio)
  canvas.height = Math.round(state.viewportH * state.pixelRatio)
  canvas.style.width = `${state.viewportW}px`
  canvas.style.height = `${state.viewportH}px`
  ctx.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0)
}
window.addEventListener('resize', resize)
resize()

const drawSteps = (target: CanvasRenderingContext2D, steps: Step[], color: string) => {
  target.fillStyle = color
  for (const [x, y, w, h] of steps) {
    target.fillRect(x, y, w, h)
  }
}

const drawLayer = (target: CanvasRenderingContext2D, layer: Record<string, Step[]>, palette: Variant) => {
  drawSteps(target, layer.light, palette.light)
  drawSteps(target, layer.base, palette.base)
  drawSteps(target, layer.shadow, palette.shadow)
  drawSteps(target, layer.pattern, '#ffffff2a')
}

const buildSprite = () => {
  const shirt = data.palettes.shirt[state.shirtIndex]
  const pants = data.palettes.pants[state.pantsIndex]
  const blinkPhase = state.blinkTimer % 3.2
  const eyesOpen = blinkPhase < 2.82
  const eyeY = data.anchors.headCenter[1] + 2
  const leftEyeX = data.anchors.headCenter[0] - 4
  const rightEyeX = data.anchors.headCenter[0] + 2

  spriteCtx.clearRect(0, 0, data.size, data.size)

  drawSteps(spriteCtx, data.base.outline, data.palettes.outline)
  drawSteps(spriteCtx, data.base.skinLight, data.palettes.skin.light)
  drawSteps(spriteCtx, data.base.skinBase, data.palettes.skin.base)
  drawSteps(spriteCtx, data.base.skinShadow, data.palettes.skin.shadow)
  drawSteps(spriteCtx, data.base.hairLight, data.palettes.hair.light)
  drawSteps(spriteCtx, data.base.hairBase, data.palettes.hair.base)
  drawSteps(spriteCtx, data.base.hairShadow, data.palettes.hair.shadow)

  drawLayer(spriteCtx, data.shirt, shirt)
  drawLayer(spriteCtx, data.pants, pants)

  drawSteps(spriteCtx, data.boots.outline, data.palettes.outline)
  drawSteps(spriteCtx, data.boots.fill, '#2f2520')

  spriteCtx.fillStyle = '#1b120f'
  if (eyesOpen) {
    spriteCtx.fillRect(leftEyeX, eyeY, 2, 2)
    spriteCtx.fillRect(rightEyeX, eyeY, 2, 2)
  } else {
    spriteCtx.fillRect(leftEyeX, eyeY + 1, 2, 1)
    spriteCtx.fillRect(rightEyeX, eyeY + 1, 2, 1)
  }

  spriteCtx.fillStyle = '#b57f59'
  spriteCtx.fillRect(data.anchors.headCenter[0], eyeY + 1, 1, 2)

  spriteCtx.fillStyle = '#6f4b34'
  spriteCtx.fillRect(data.anchors.headCenter[0] - 2, eyeY + 5, 4, 1)

  spriteCtx.fillStyle = data.palettes.skin.shadow
  spriteCtx.fillRect(data.anchors.headCenter[0] - 2, eyeY + 7, 4, 1)
}

const computeLayout = (): Layout => {
  const margin = 20
  const maxW = 1120
  const maxH = 760
  const panelW = Math.min(maxW, state.viewportW - margin * 2)
  const panelH = Math.min(maxH, state.viewportH - margin * 2)

  const panel: Rect = {
    x: ir((state.viewportW - panelW) * 0.5),
    y: ir((state.viewportH - panelH) * 0.5),
    w: ir(panelW),
    h: ir(panelH)
  }

  const headerH = 54
  const footerH = 48
  const content: Rect = {
    x: panel.x + 16,
    y: panel.y + headerH + 10,
    w: panel.w - 32,
    h: panel.h - headerH - footerH - 20
  }

  const wide = content.w >= 850 && content.h >= 340
  const gap = 14
  let avatarPane: Rect
  let controlsPane: Rect

  if (wide) {
    const avatarW = ir(content.w * 0.56)
    avatarPane = { x: content.x, y: content.y, w: avatarW, h: content.h }
    controlsPane = {
      x: content.x + avatarW + gap,
      y: content.y,
      w: content.w - avatarW - gap,
      h: content.h
    }
  } else {
    const avatarH = Math.max(230, ir(content.h * 0.54))
    avatarPane = { x: content.x, y: content.y, w: content.w, h: avatarH }
    controlsPane = {
      x: content.x,
      y: content.y + avatarH + gap,
      w: content.w,
      h: Math.max(180, content.h - avatarH - gap)
    }
  }

  const controlsInner = insetRect(controlsPane, 10)
  const sectionGap = 10
  const randomH = 32
  const infoH = 42
  const controlH = clamp(ir((controlsInner.h - randomH - infoH - sectionGap * 3) * 0.5), 88, 132)
  const startY = controlsInner.y

  const shirtCard: Rect = {
    x: controlsInner.x,
    y: startY,
    w: controlsInner.w,
    h: controlH
  }

  const pantsCard: Rect = {
    x: controlsInner.x,
    y: shirtCard.y + shirtCard.h + sectionGap,
    w: controlsInner.w,
    h: controlH
  }

  const randomButton: Rect = {
    x: controlsInner.x,
    y: pantsCard.y + pantsCard.h + sectionGap,
    w: controlsInner.w,
    h: randomH
  }

  const infoCard: Rect = {
    x: controlsInner.x,
    y: randomButton.y + randomButton.h + sectionGap,
    w: controlsInner.w,
    h: Math.max(infoH, controlsInner.y + controlsInner.h - (randomButton.y + randomButton.h + sectionGap))
  }

  return {
    panel,
    header: { x: panel.x + 14, y: panel.y + 10, w: panel.w - 28, h: 40 },
    footer: { x: panel.x + 14, y: panel.y + panel.h - 44, w: panel.w - 28, h: 36 },
    avatarPane,
    controlsPane,
    portraitFrame: insetRect(avatarPane, 12),
    shirtCard,
    pantsCard,
    randomButton,
    infoCard,
    mode: wide ? 'wide' : 'stacked'
  }
}

const drawBackground = () => {
  const grad = ctx.createLinearGradient(0, 0, 0, state.viewportH)
  grad.addColorStop(0, ui.bgTop)
  grad.addColorStop(0.58, ui.bgMid)
  grad.addColorStop(1, ui.bgBottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, state.viewportW, state.viewportH)

  const tile = 32
  for (let y = 0; y < state.viewportH; y += tile) {
    for (let x = 0; x < state.viewportW; x += tile) {
      const odd = ((x / tile) + (y / tile)) % 2 === 1
      ctx.fillStyle = odd ? ui.bgTileB : ui.bgTileA
      ctx.fillRect(x, y, tile, tile)
    }
  }

  ctx.fillStyle = ui.bgGrid
  for (let y = 0; y < state.viewportH; y += tile) {
    ctx.fillRect(0, y, state.viewportW, 1)
  }
  for (let x = 0; x < state.viewportW; x += tile) {
    ctx.fillRect(x, 0, 1, state.viewportH)
  }
}

const drawPanelShadow = (rect: Rect) => {
  ctx.fillStyle = ui.panelShadow
  ctx.fillRect(rect.x + 8, rect.y + 10, rect.w, rect.h)
}

const drawCardPanel = (rect: Rect, tileCenter = false) => {
  drawNineSlice(
    ctx,
    panelTexture,
    { x: 0, y: 0, w: panelTexture.width, h: panelTexture.height },
    rect,
    { left: 10, right: 10, top: 10, bottom: 10 },
    { pixelSnap: true, tileCenter }
  )
  ctx.fillStyle = ui.cardFill
  ctx.fillRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12)
  ctx.fillStyle = ui.cardInner
  ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, 3)
  ctx.fillStyle = ui.cardShade
  ctx.fillRect(rect.x + 8, rect.y + rect.h - 11, rect.w - 16, 3)
}

const addButton = (button: Button) => {
  buttons.push(button)
}

const drawButton = (button: Button) => {
  const hover = button.id === state.hoverId

  if (button.kind === 'swatch') {
    if (!button.swatchColor) return
    ctx.fillStyle = ui.swatchFrame
    ctx.fillRect(button.rect.x, button.rect.y, button.rect.w, button.rect.h)
    ctx.fillStyle = button.swatchColor
    ctx.fillRect(button.rect.x + 2, button.rect.y + 2, button.rect.w - 4, button.rect.h - 4)
    if (button.active || hover) {
      ctx.strokeStyle = button.active ? '#f7e6bf' : ui.titleBarHi
      ctx.lineWidth = 2
      ctx.strokeRect(button.rect.x - 1, button.rect.y - 1, button.rect.w + 2, button.rect.h + 2)
    }
    return
  }

  drawNineSlice(
    ctx,
    panelTexture,
    { x: 0, y: 0, w: panelTexture.width, h: panelTexture.height },
    button.rect,
    { left: 10, right: 10, top: 10, bottom: 10 },
    { pixelSnap: true, tileCenter: false }
  )

  ctx.fillStyle = button.kind === 'random'
    ? hover ? ui.buttonBlueHover : ui.buttonBlue
    : hover ? ui.buttonFillHover : ui.buttonFill
  ctx.fillRect(button.rect.x + 4, button.rect.y + 4, button.rect.w - 8, button.rect.h - 8)
  ctx.fillStyle = '#ffffff20'
  ctx.fillRect(button.rect.x + 5, button.rect.y + 5, button.rect.w - 10, 2)

  const label = button.label ?? ''
  const scale = button.kind === 'random' ? 2 : 2
  const textW = measureBitmapText(label, scale)
  drawBitmapText(ctx, label, button.rect.x + (button.rect.w - textW) * 0.5, button.rect.y + 8, {
    scale,
    color: ui.textLight,
    pixelSnap: true
  })
}

const drawHeader = (layout: Layout) => {
  ctx.fillStyle = ui.cardEdge
  ctx.fillRect(layout.header.x, layout.header.y, layout.header.w, layout.header.h)
  ctx.fillStyle = ui.titleBar
  ctx.fillRect(layout.header.x + 2, layout.header.y + 2, layout.header.w - 4, 18)
  ctx.fillStyle = ui.titleBarHi
  ctx.fillRect(layout.header.x + 3, layout.header.y + 3, layout.header.w - 6, 2)
  ctx.fillStyle = ui.gold
  ctx.fillRect(layout.header.x + 2, layout.header.y + 21, layout.header.w - 4, 2)

  drawBitmapText(ctx, 'TIBIA OUTFIT STUDIO', layout.header.x + 8, layout.header.y + 6, {
    scale: 2,
    color: ui.textLight,
    pixelSnap: true
  })
  drawBitmapText(ctx, '64X64 CLASSIC LOOK', layout.header.x + 8, layout.header.y + 25, {
    scale: 2,
    color: ui.textDark,
    pixelSnap: true
  })
}

const drawFooter = (layout: Layout) => {
  const line1 = 'LEFT RIGHT SHIRT   A D PANTS'
  const line2 = layout.mode === 'wide' ? 'R RANDOM   F FULLSCREEN' : 'R RANDOM'
  const line1W = measureBitmapText(line1, 1)
  const line2W = measureBitmapText(line2, 1)

  ctx.fillStyle = ui.cardEdge
  ctx.fillRect(layout.footer.x, layout.footer.y, layout.footer.w, layout.footer.h)
  ctx.fillStyle = '#2b3d50'
  ctx.fillRect(layout.footer.x + 2, layout.footer.y + 2, layout.footer.w - 4, layout.footer.h - 4)
  ctx.fillStyle = ui.gold
  ctx.fillRect(layout.footer.x + 2, layout.footer.y + 2, layout.footer.w - 4, 1)

  drawBitmapText(ctx, line1, ir(layout.footer.x + (layout.footer.w - line1W) * 0.5), layout.footer.y + 6, {
    scale: 1,
    color: ui.textLight,
    pixelSnap: true
  })
  drawBitmapText(ctx, line2, ir(layout.footer.x + (layout.footer.w - line2W) * 0.5), layout.footer.y + 18, {
    scale: 1,
    color: ui.textLight,
    pixelSnap: true
  })
}

const drawSelectionChip = (x: number, y: number, color: string) => {
  ctx.fillStyle = ui.swatchFrame
  ctx.fillRect(x, y, 12, 12)
  ctx.fillStyle = color
  ctx.fillRect(x + 2, y + 2, 8, 8)
  ctx.fillStyle = '#ffffff55'
  ctx.fillRect(x + 3, y + 3, 2, 1)
}

const drawAvatarPane = (layout: Layout) => {
  drawCardPanel(layout.avatarPane)
  const frame = insetRect(layout.portraitFrame, 4)

  ctx.fillStyle = '#2a3d52'
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h)

  const tile = 18
  for (let y = frame.y; y < frame.y + frame.h; y += tile) {
    for (let x = frame.x; x < frame.x + frame.w; x += tile) {
      const odd = ((x - frame.x) / tile + (y - frame.y) / tile) % 2 === 1
      ctx.fillStyle = odd ? '#2f4760' : '#35506a'
      ctx.fillRect(x, y, tile, tile)
    }
  }

  ctx.fillStyle = '#ffffff1f'
  for (let y = frame.y; y < frame.y + frame.h; y += tile) {
    ctx.fillRect(frame.x, y, frame.w, 1)
  }

  const maxScaleW = Math.floor((frame.w - 30) / data.size)
  const maxScaleH = Math.floor((frame.h - 38) / data.size)
  const maxScale = data.size <= 64 ? 9 : 5
  const fitScale = Math.max(1, Math.min(maxScaleW, maxScaleH))
  const scale = clamp(fitScale, 1, maxScale)

  const spriteW = data.size * scale
  const spriteH = data.size * scale
  const spriteX = ir(frame.x + (frame.w - spriteW) * 0.5)
  const spriteY = ir(frame.y + (frame.h - spriteH) * 0.5)

  const shadowW = Math.max(20, ir(spriteW * 0.48))
  const shadowH = Math.max(5, ir(scale * 0.9))
  ctx.fillStyle = '#06070755'
  ctx.fillRect(spriteX + ir((spriteW - shadowW) * 0.5), spriteY + spriteH - shadowH - 1, shadowW, shadowH)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(spriteCanvas, spriteX, spriteY, spriteW, spriteH)

  drawBitmapText(ctx, 'PREVIEW 64X64', frame.x + 8, frame.y + 8, {
    scale: 2,
    color: '#dce7f5',
    pixelSnap: true
  })

  const shirt = data.palettes.shirt[state.shirtIndex]
  const pants = data.palettes.pants[state.pantsIndex]
  drawSelectionChip(frame.x + frame.w - 34, frame.y + 10, shirt.base)
  drawSelectionChip(frame.x + frame.w - 18, frame.y + 10, pants.base)
}

const addControlButtons = (
  cardRect: Rect,
  baseId: 'shirt' | 'pants',
  palette: Variant[],
  selected: number,
  onPrev: () => void,
  onNext: () => void,
  onPick: (index: number) => void
) => {
  const pad = 10
  const buttonH = 28
  const buttonY = cardRect.y + cardRect.h - buttonH - 8
  const buttonW = Math.max(74, ir((cardRect.w - pad * 3) * 0.5))
  const leftX = cardRect.x + pad
  const rightX = leftX + buttonW + pad

  addButton({
    id: `${baseId}-prev`,
    kind: 'control',
    label: 'PREV',
    rect: { x: leftX, y: buttonY, w: buttonW, h: buttonH },
    onClick: onPrev
  })

  addButton({
    id: `${baseId}-next`,
    kind: 'control',
    label: 'NEXT',
    rect: { x: rightX, y: buttonY, w: buttonW, h: buttonH },
    onClick: onNext
  })

  const swatchSize = 16
  const swatchGap = 8
  const swatchY = buttonY - swatchSize - 10
  const rowW = palette.length * swatchSize + (palette.length - 1) * swatchGap
  const startX = ir(cardRect.x + (cardRect.w - rowW) * 0.5)

  palette.forEach((item, index) => {
    addButton({
      id: `${baseId}-swatch-${item.id}`,
      kind: 'swatch',
      rect: { x: startX + index * (swatchSize + swatchGap), y: swatchY, w: swatchSize, h: swatchSize },
      swatchColor: item.base,
      active: selected === index,
      onClick: () => onPick(index)
    })
  })
}

const drawControlsPane = (layout: Layout) => {
  drawCardPanel(layout.controlsPane)
  drawCardPanel(layout.shirtCard)
  drawCardPanel(layout.pantsCard)
  drawCardPanel(layout.infoCard)

  const shirt = data.palettes.shirt[state.shirtIndex]
  const pants = data.palettes.pants[state.pantsIndex]

  drawBitmapText(ctx, 'SHIRT', layout.shirtCard.x + 10, layout.shirtCard.y + 10, {
    scale: 2,
    color: ui.textMid,
    pixelSnap: true
  })
  drawBitmapText(ctx, shortName(shirt.name), layout.shirtCard.x + 10, layout.shirtCard.y + 30, {
    scale: 2,
    color: ui.textDark,
    pixelSnap: true
  })
  drawSelectionChip(layout.shirtCard.x + layout.shirtCard.w - 28, layout.shirtCard.y + 10, shirt.base)

  drawBitmapText(ctx, 'PANTS', layout.pantsCard.x + 10, layout.pantsCard.y + 10, {
    scale: 2,
    color: ui.textMid,
    pixelSnap: true
  })
  drawBitmapText(ctx, shortName(pants.name), layout.pantsCard.x + 10, layout.pantsCard.y + 30, {
    scale: 2,
    color: ui.textDark,
    pixelSnap: true
  })
  drawSelectionChip(layout.pantsCard.x + layout.pantsCard.w - 28, layout.pantsCard.y + 10, pants.base)

  addControlButtons(
    layout.shirtCard,
    'shirt',
    data.palettes.shirt,
    state.shirtIndex,
    () => {
      state.shirtIndex = (state.shirtIndex + data.palettes.shirt.length - 1) % data.palettes.shirt.length
    },
    () => {
      state.shirtIndex = (state.shirtIndex + 1) % data.palettes.shirt.length
    },
    (index) => {
      state.shirtIndex = index
    }
  )

  addControlButtons(
    layout.pantsCard,
    'pants',
    data.palettes.pants,
    state.pantsIndex,
    () => {
      state.pantsIndex = (state.pantsIndex + data.palettes.pants.length - 1) % data.palettes.pants.length
    },
    () => {
      state.pantsIndex = (state.pantsIndex + 1) % data.palettes.pants.length
    },
    (index) => {
      state.pantsIndex = index
    }
  )

  addButton({
    id: 'randomize',
    kind: 'random',
    label: 'RANDOM OUTFIT',
    rect: layout.randomButton,
    onClick: () => {
      state.shirtIndex = Math.floor(Math.random() * data.palettes.shirt.length)
      state.pantsIndex = Math.floor(Math.random() * data.palettes.pants.length)
    }
  })

  drawBitmapText(ctx, 'CURRENT OUTFIT', layout.infoCard.x + 10, layout.infoCard.y + 10, {
    scale: 2,
    color: ui.textMid,
    pixelSnap: true
  })
  drawBitmapText(ctx, `${shortName(shirt.name)} AND ${shortName(pants.name)}`, layout.infoCard.x + 10, layout.infoCard.y + 30, {
    scale: 2,
    color: ui.textDark,
    pixelSnap: true
  })
  drawSelectionChip(layout.infoCard.x + layout.infoCard.w - 44, layout.infoCard.y + 28, shirt.base)
  drawSelectionChip(layout.infoCard.x + layout.infoCard.w - 28, layout.infoCard.y + 28, pants.base)
}

const render = () => {
  buttons.length = 0
  drawBackground()
  buildSprite()

  const layout = computeLayout()
  drawPanelShadow(layout.panel)
  drawNineSlice(
    ctx,
    panelTexture,
    { x: 0, y: 0, w: panelTexture.width, h: panelTexture.height },
    layout.panel,
    { left: 12, right: 12, top: 12, bottom: 12 },
    { pixelSnap: true, tileCenter: false }
  )

  drawHeader(layout)
  drawAvatarPane(layout)
  drawControlsPane(layout)
  drawFooter(layout)

  for (const button of buttons) {
    drawButton(button)
  }
}

const updateHover = (x: number, y: number) => {
  state.hoverId = null
  for (let i = buttons.length - 1; i >= 0; i -= 1) {
    const button = buttons[i]
    if (x >= button.rect.x && x <= button.rect.x + button.rect.w && y >= button.rect.y && y <= button.rect.y + button.rect.h) {
      state.hoverId = button.id
      break
    }
  }
  canvas.style.cursor = state.hoverId ? 'pointer' : 'default'
}

canvas.addEventListener('mousemove', (event) => {
  const bounds = canvas.getBoundingClientRect()
  updateHover(event.clientX - bounds.left, event.clientY - bounds.top)
})

canvas.addEventListener('mouseleave', () => {
  state.hoverId = null
  canvas.style.cursor = 'default'
})

canvas.addEventListener('click', (event) => {
  const bounds = canvas.getBoundingClientRect()
  const x = event.clientX - bounds.left
  const y = event.clientY - bounds.top

  for (let i = buttons.length - 1; i >= 0; i -= 1) {
    const button = buttons[i]
    if (x >= button.rect.x && x <= button.rect.x + button.rect.w && y >= button.rect.y && y <= button.rect.y + button.rect.h) {
      button.onClick()
      break
    }
  }
})

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase()
  if (event.key === 'ArrowLeft') {
    state.shirtIndex = (state.shirtIndex + data.palettes.shirt.length - 1) % data.palettes.shirt.length
  }
  if (event.key === 'ArrowRight') {
    state.shirtIndex = (state.shirtIndex + 1) % data.palettes.shirt.length
  }
  if (key === 'a') {
    state.pantsIndex = (state.pantsIndex + data.palettes.pants.length - 1) % data.palettes.pants.length
  }
  if (key === 'd') {
    state.pantsIndex = (state.pantsIndex + 1) % data.palettes.pants.length
  }
  if (key === 'r') {
    state.shirtIndex = Math.floor(Math.random() * data.palettes.shirt.length)
    state.pantsIndex = Math.floor(Math.random() * data.palettes.pants.length)
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
  state.blinkTimer += dt
  state.breatheTimer += dt
}

const tick = (now: number) => {
  const dt = Math.min(0.05, (now - state.lastFrame) / 1000)
  state.lastFrame = now
  update(dt)
  render()
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)))
  for (let i = 0; i < steps; i += 1) update(1 / 60)
  render()
}

window.render_game_to_text = () => {
  const layout = computeLayout()
  const shirt = data.palettes.shirt[state.shirtIndex]
  const pants = data.palettes.pants[state.pantsIndex]
  return JSON.stringify({
    mode: 'dress-up',
    coordinateSystem: 'origin=(0,0) top-left; +x right; +y down',
    viewport: { width: state.viewportW, height: state.viewportH },
    layout: {
      panel: layout.panel,
      avatarPane: layout.avatarPane,
      controlsPane: layout.controlsPane,
      mode: layout.mode
    },
    sprite: { size: data.size, anchors: data.anchors },
    selected: { shirt: shirt.id, shirtName: shirt.name, pants: pants.id, pantsName: pants.name },
    interactives: buttons.map((button) => ({ id: button.id, rect: button.rect, kind: button.kind }))
  })
}

declare global {
  interface Window {
    advanceTime: (ms: number) => void
    render_game_to_text: () => string
  }
}
