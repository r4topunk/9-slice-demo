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
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
    const consoleErrors = []
    const pageErrors = []

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS })
    await page.waitForSelector('#canvas', { state: 'visible', timeout: NAV_TIMEOUT_MS })

    const title = await page.title()
    const canvas = await page.$eval('#canvas', (node) => ({
      clientWidth: node.clientWidth,
      clientHeight: node.clientHeight
    }))
    if (canvas.clientWidth < 100 || canvas.clientHeight < 100) {
      throw new Error(`canvas too small: ${canvas.clientWidth}x${canvas.clientHeight}`)
    }

    const homeShot = path.join(OUTPUT_DIR, 'smoke-home.png')
    const controlsShot = path.join(OUTPUT_DIR, 'smoke-controls.png')
    await page.screenshot({ path: homeShot, fullPage: true })

    await page.mouse.click(24, 24)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('KeyD')
    await page.keyboard.press('KeyR')
    await page.waitForTimeout(200)
    await page.screenshot({ path: controlsShot, fullPage: true })

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
          canvas,
          screenshots: [homeShot, controlsShot]
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
