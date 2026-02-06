#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PLAYWRIGHT_ICON_PORT || 4174)
const BASE_URL = `http://${HOST}:${PORT}`
const OUTPUT_DIR = path.resolve('output/playwright')
const NAV_TIMEOUT_MS = 20_000
const SERVER_TIMEOUT_MS = 30_000
const TARGET_CATEGORY = (process.argv[2] || process.env.PLAYWRIGHT_ICON_CATEGORY || 'heads').trim()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitForServer = async (url, timeoutMs, devServer) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (devServer.exitCode !== null) {
      throw new Error(`vite exited early with code ${devServer.exitCode}`)
    }
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) return
    } catch {
      // keep polling
    }
    await sleep(250)
  }
  throw new Error(`timed out waiting for ${url}`)
}

const stopProcess = async (child) => {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(3_000)
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

const main = async () => {
  let browser
  let devServer
  try {
    await mkdir(OUTPUT_DIR, { recursive: true })
    devServer = spawn(
      'pnpm',
      ['exec', 'vite', '--host', HOST, '--port', String(PORT), '--strictPort'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    await waitForServer(BASE_URL, SERVER_TIMEOUT_MS, devServer)

    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS })
    await page.waitForSelector('#canvas', { state: 'visible', timeout: NAV_TIMEOUT_MS })
    await page.waitForTimeout(250)

    const title = await page.title()
    const state = await page.evaluate(() => {
      const payload = window.render_game_to_text?.()
      return payload ? JSON.parse(payload) : null
    })

    const categoryKeys = Object.keys(state?.selectedTraits ?? {})
    const categoryIndex = categoryKeys.indexOf(TARGET_CATEGORY)
    const defaultIndex = Math.max(0, categoryKeys.indexOf('heads'))
    const expectedId = `category-${categoryIndex >= 0 ? categoryIndex : defaultIndex}`
    const targetCategory = state?.interactives?.find(
      (button) => button.kind === 'category' && button.id === expectedId
    )
    if (!targetCategory?.rect) {
      throw new Error(`category button not found for "${TARGET_CATEGORY}"`)
    }

    const canvasBounds = await page.$eval('#canvas', (node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    })

    const safeCategory = TARGET_CATEGORY.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'heads'
    const fullShot = path.join(OUTPUT_DIR, `icon-loop-${safeCategory}-full.png`)
    const categoryShot = path.join(OUTPUT_DIR, `icon-loop-${safeCategory}.png`)
    await page.screenshot({ path: fullShot, fullPage: true })

    const pad = 14
    const clip = {
      x: Math.max(0, canvasBounds.x + targetCategory.rect.x - pad),
      y: Math.max(0, canvasBounds.y + targetCategory.rect.y - pad),
      width: Math.min(canvasBounds.w, targetCategory.rect.w + pad * 2),
      height: Math.min(canvasBounds.h, targetCategory.rect.h + pad * 2)
    }
    await page.screenshot({ path: categoryShot, clip })

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: BASE_URL,
          title,
          category: TARGET_CATEGORY,
          files: { full: fullShot, category: categoryShot },
          categoryRect: targetCategory.rect
        },
        null,
        2
      )
    )
  } finally {
    if (browser) await browser.close().catch(() => {})
    await stopProcess(devServer)
  }
}

await main()
