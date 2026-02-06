import { createPanelTexture, DEFAULT_TEXTURE_SIZE } from './procTexture'

export type TextureSource = {
  canvas: HTMLCanvasElement
  label: string
}

const CANDIDATE_URLS = ['/ui-panel.png', '/panel.png']

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })

const imageToCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D context unavailable')
  }
  ctx.drawImage(img, 0, 0)
  return canvas
}

export const loadTextureSource = async (): Promise<TextureSource> => {
  for (const url of CANDIDATE_URLS) {
    try {
      const img = await loadImage(url)
      const canvas = imageToCanvas(img)
      return { canvas, label: `external (${url})` }
    } catch {
      // Try the next candidate.
    }
  }

  return {
    canvas: createPanelTexture(DEFAULT_TEXTURE_SIZE),
    label: 'procedural'
  }
}
