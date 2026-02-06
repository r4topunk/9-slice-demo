#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PLAYWRIGHT_SMOKE_PORT || 4173)
const BASE_URL = `http://${HOST}:${PORT}`
const OUTPUT_DIR = path.resolve('output/playwright')
const SERVER_TIMEOUT_MS = 30_000
const NAV_TIMEOUT_MS = 20_000
const MAX_LOG_LINES = 40

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pushLogLine = (target, line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  target.push(trimmed)
  if (target.length > MAX_LOG_LINES) target.shift()
}

const attachLineReader = (stream, target) => {
  if (!stream) return
  stream.setEncoding('utf8')
  let pending = ''
  stream.on('data', (chunk) => {
    pending += chunk
    let newlineIndex = pending.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = pending.slice(0, newlineIndex).replace(/\r$/, '')
      pushLogLine(target, line)
      pending = pending.slice(newlineIndex + 1)
      newlineIndex = pending.indexOf('\n')
    }
  })
  stream.on('end', () => {
    if (pending) pushLogLine(target, pending)
  })
}

const macHostOverride = () => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return null
  const releaseMajor = Number.parseInt(os.release().split('.')[0] || '0', 10)
  if (!Number.isFinite(releaseMajor) || releaseMajor <= 0) return 'mac15-arm64'
  const mappedVersion = Math.max(11, Math.min(releaseMajor - 9, 15))
  return `mac${mappedVersion}-arm64`
}

const maybeSetPlaywrightHostOverride = () => {
  if (process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) return
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return
  const cpus = os.cpus()
  const hasAppleCpuModel = cpus.some((cpu) => cpu.model.includes('Apple'))
  if (hasAppleCpuModel) return
  const override = macHostOverride()
  if (!override) return
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = override
  console.log(`[playwright-smoke] using host override: ${override}`)
}

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
      // Keep polling until timeout.
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

const attachPageErrorCollectors = (page, label, consoleErrors, pageErrors) => {
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    consoleErrors.push(`${label}: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    pageErrors.push(`${label}: ${error.message}`)
  })
}

const readTextState = async (page) => {
  const payload = await page.evaluate(() => {
    const render = window.render_game_to_text
    return typeof render === 'function' ? render() : ''
  })
  if (!payload) return null
  return JSON.parse(payload)
}

const centerOfRect = (rect) => ({
  x: rect.x + rect.w * 0.5,
  y: rect.y + rect.h * 0.5
})

const categoryButtonIds = (state) => {
  if (!state?.interactives) return []
  return state.interactives
    .filter((button) => button.kind === 'category')
    .map((button) => button.id)
    .sort()
}

const main = async () => {
  let browser
  let devServer
  const serverStdout = []
  const serverStderr = []

  try {
    maybeSetPlaywrightHostOverride()
    await mkdir(OUTPUT_DIR, { recursive: true })

    devServer = spawn(
      'pnpm',
      ['exec', 'vite', '--host', HOST, '--port', String(PORT), '--strictPort'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    attachLineReader(devServer.stdout, serverStdout)
    attachLineReader(devServer.stderr, serverStderr)

    await waitForServer(BASE_URL, SERVER_TIMEOUT_MS, devServer)

    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const consoleErrors = []
    const pageErrors = []
    const screenshots = []

    let title = ''
    let desktopCanvas
    let mobileCanvas

    const desktopContext = await browser.newContext({
      viewport: { width: 1366, height: 900 }
    })
    const desktopPage = await desktopContext.newPage()
    attachPageErrorCollectors(desktopPage, 'desktop', consoleErrors, pageErrors)

    await desktopPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS })
    await desktopPage.waitForSelector('#canvas', { state: 'visible', timeout: NAV_TIMEOUT_MS })

    title = await desktopPage.title()
    desktopCanvas = await desktopPage.$eval('#canvas', (node) => ({
      clientWidth: node.clientWidth,
      clientHeight: node.clientHeight
    }))
    if (desktopCanvas.clientWidth < 100 || desktopCanvas.clientHeight < 100) {
      throw new Error(`desktop canvas too small: ${desktopCanvas.clientWidth}x${desktopCanvas.clientHeight}`)
    }

    const homeShot = path.join(OUTPUT_DIR, 'smoke-home.png')
    const controlsShot = path.join(OUTPUT_DIR, 'smoke-controls.png')
    await desktopPage.screenshot({ path: homeShot, fullPage: true })
    screenshots.push(homeShot)

    await desktopPage.mouse.click(24, 24)
    await desktopPage.keyboard.press('ArrowRight')
    await desktopPage.keyboard.press('KeyD')
    await desktopPage.keyboard.press('KeyR')
    await desktopPage.waitForTimeout(200)
    await desktopPage.screenshot({ path: controlsShot, fullPage: true })
    screenshots.push(controlsShot)

    await desktopContext.close()

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    })
    const mobilePage = await mobileContext.newPage()
    attachPageErrorCollectors(mobilePage, 'mobile', consoleErrors, pageErrors)

    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS })
    await mobilePage.waitForSelector('#canvas', { state: 'visible', timeout: NAV_TIMEOUT_MS })

    mobileCanvas = await mobilePage.$eval('#canvas', (node) => ({
      clientWidth: node.clientWidth,
      clientHeight: node.clientHeight
    }))
    if (mobileCanvas.clientWidth < 100 || mobileCanvas.clientHeight < 100) {
      throw new Error(`mobile canvas too small: ${mobileCanvas.clientWidth}x${mobileCanvas.clientHeight}`)
    }

    const mobileState = await readTextState(mobilePage)
    if (!mobileState?.layout?.mobile) {
      throw new Error('mobile layout flag not enabled in render_game_to_text payload')
    }

    const mobileHomeShot = path.join(OUTPUT_DIR, 'smoke-mobile-home.png')
    await mobilePage.screenshot({ path: mobileHomeShot, fullPage: true })
    screenshots.push(mobileHomeShot)

    const firstCategory = mobileState.interactives?.find((button) => button.kind === 'category')
    if (!firstCategory?.rect) {
      throw new Error('mobile scenario could not find category button')
    }
    await mobilePage.touchscreen.tap(...Object.values(centerOfRect(firstCategory.rect)))
    await mobilePage.waitForTimeout(150)

    const itemsState = await readTextState(mobilePage)
    if (itemsState?.panelView !== 'items') {
      throw new Error('mobile scenario failed to enter trait items view')
    }

    const firstItem = itemsState.interactives?.find((button) => button.kind === 'item')
    if (firstItem?.rect) {
      await mobilePage.touchscreen.tap(...Object.values(centerOfRect(firstItem.rect)))
    }
    const buyButton = itemsState.interactives?.find((button) => button.id === 'buy-selected')
    if (buyButton?.rect) {
      await mobilePage.touchscreen.tap(...Object.values(centerOfRect(buyButton.rect)))
    }

    await mobilePage.waitForTimeout(200)
    const mobileItemsShot = path.join(OUTPUT_DIR, 'smoke-mobile-items.png')
    await mobilePage.screenshot({ path: mobileItemsShot, fullPage: true })
    screenshots.push(mobileItemsShot)

    await mobileContext.close()

    const mobileShortContext = await browser.newContext({
      viewport: { width: 390, height: 420 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    })
    const mobileShortPage = await mobileShortContext.newPage()
    attachPageErrorCollectors(mobileShortPage, 'mobile-short', consoleErrors, pageErrors)

    await mobileShortPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS })
    await mobileShortPage.waitForSelector('#canvas', { state: 'visible', timeout: NAV_TIMEOUT_MS })

    const shortStateStart = await readTextState(mobileShortPage)
    if (!shortStateStart?.layout?.mobile) {
      throw new Error('short mobile layout flag not enabled in render_game_to_text payload')
    }

    const shortGrid = shortStateStart.layout?.gridViewport
    const shortStartIds = categoryButtonIds(shortStateStart)
    const totalTypes = Object.keys(shortStateStart.selectedTraits ?? {}).length

    if (shortGrid && totalTypes > shortStartIds.length) {
      const dragX = shortGrid.x + shortGrid.w * 0.5
      const dragStartY = shortGrid.y + shortGrid.h * 0.75
      const dragEndY = shortGrid.y + shortGrid.h * 0.25
      await mobileShortPage.mouse.move(dragX, dragStartY)
      await mobileShortPage.mouse.down()
      await mobileShortPage.mouse.move(dragX, dragEndY, { steps: 10 })
      await mobileShortPage.mouse.up()
      await mobileShortPage.waitForTimeout(120)

      const shortStateAfter = await readTextState(mobileShortPage)
      const shortEndIds = categoryButtonIds(shortStateAfter)
      if (shortStartIds.join('|') === shortEndIds.join('|')) {
        throw new Error('trait type scroll failed in short mobile viewport')
      }
    }

    const mobileShortShot = path.join(OUTPUT_DIR, 'smoke-mobile-short-types.png')
    await mobileShortPage.screenshot({ path: mobileShortShot, fullPage: true })
    screenshots.push(mobileShortShot)

    await mobileShortContext.close()

    if (pageErrors.length) {
      throw new Error(`page errors: ${pageErrors.join(' | ')}`)
    }
    if (consoleErrors.length) {
      throw new Error(`console errors: ${consoleErrors.join(' | ')}`)
    }

    console.log('[playwright-smoke] OK')
    console.log(
      JSON.stringify(
        {
          baseUrl: BASE_URL,
          title,
          canvas: { desktop: desktopCanvas, mobile: mobileCanvas },
          screenshots
        },
        null,
        2
      )
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[playwright-smoke] FAILED: ${message}`)
    if (serverStdout.length) {
      console.error('[playwright-smoke] vite stdout (tail):')
      for (const line of serverStdout) console.error(line)
    }
    if (serverStderr.length) {
      console.error('[playwright-smoke] vite stderr (tail):')
      for (const line of serverStderr) console.error(line)
    }
    process.exitCode = 1
  } finally {
    if (browser) await browser.close().catch(() => {})
    await stopProcess(devServer)
  }
}

await main()
