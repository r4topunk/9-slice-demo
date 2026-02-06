import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const catalogPath = path.join(rootDir, 'assets', 'skatehive-links-catalog.json')
const outputRoot = path.join(rootDir, 'public', 'skatehive')

const gatewayPrefixes = [
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/'
]

const timeoutMs = 20000
const maxPasses = 3

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const parseIpfsPath = (url) => {
  if (typeof url !== 'string' || !url) return null
  if (url.startsWith('ipfs://')) {
    return url.slice('ipfs://'.length).replace(/^\/+/, '')
  }

  const marker = '/ipfs/'
  const markerIndex = url.indexOf(marker)
  if (markerIndex >= 0) {
    return url.slice(markerIndex + marker.length).replace(/^\/+/, '')
  }

  return null
}

const candidateUrlsFor = (url) => {
  const ipfsPath = parseIpfsPath(url)
  if (!ipfsPath) return [url]

  const candidates = [...gatewayPrefixes.map((prefix) => `${prefix}${ipfsPath}`), url]
  return [...new Set(candidates)]
}

const fetchWithTimeout = async (url) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'user-agent': 'skatehive-mirror/1.0'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

const ensureDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

const loadCatalog = async () => {
  const raw = await fs.readFile(catalogPath, 'utf8')
  return JSON.parse(raw)
}

const allItems = (catalog) => {
  const rows = []
  for (const category of catalog.categories ?? []) {
    for (const item of category.items ?? []) {
      const sourceUrl = item.url
      const sourcePath = parseIpfsPath(sourceUrl)

      if (!sourcePath) {
        throw new Error(`Unable to parse IPFS path for ${sourceUrl}`)
      }

      const parts = sourcePath.split('/').filter(Boolean)
      if (parts.length < 3) {
        throw new Error(`Unexpected IPFS path format for ${sourceUrl}`)
      }

      const folder = category.folder || parts[1]
      const filename = parts[parts.length - 1]
      const relPath = path.posix.join(folder, filename)
      const localUrl = `/${path.posix.join('skatehive', relPath)}`
      const filePath = path.join(outputRoot, folder, filename)

      rows.push({ category, item, sourceUrl, relPath, localUrl, filePath })
    }
  }
  return rows
}

const downloadOne = async (entry) => {
  const candidates = candidateUrlsFor(entry.sourceUrl)
  let lastError = null

  for (const candidate of candidates) {
    try {
      const res = await fetchWithTimeout(candidate)
      if (!res.ok) {
        lastError = new Error(`${res.status} ${res.statusText}`)
        continue
      }

      const body = await res.arrayBuffer()
      if (!body.byteLength) {
        lastError = new Error('empty response body')
        continue
      }

      await ensureDir(entry.filePath)
      await fs.writeFile(entry.filePath, Buffer.from(body))
      return { ok: true, source: candidate, size: body.byteLength }
    } catch (err) {
      lastError = err
    }
  }

  return { ok: false, error: lastError }
}

const run = async () => {
  const catalog = await loadCatalog()
  const entries = allItems(catalog)
  let pending = [...entries]
  let pass = 1

  console.log(`Found ${entries.length} assets to mirror.`)

  while (pending.length > 0 && pass <= maxPasses) {
    console.log(`\nPass ${pass}/${maxPasses} - pending ${pending.length}`)
    const nextPending = []

    for (let i = 0; i < pending.length; i += 1) {
      const entry = pending[i]
      const label = `${i + 1}/${pending.length} ${entry.relPath}`
      const result = await downloadOne(entry)

      if (result.ok) {
        process.stdout.write(`OK   ${label} (${result.size} bytes)\n`)
      } else {
        process.stdout.write(`FAIL ${label} (${result.error?.message || 'unknown error'})\n`)
        nextPending.push(entry)
        await sleep(350)
      }

      await sleep(75)
    }

    pending = nextPending
    pass += 1
  }

  if (pending.length > 0) {
    throw new Error(`Failed to download ${pending.length} assets after ${maxPasses} passes.`)
  }

  for (const entry of entries) {
    entry.item.url = entry.localUrl
  }

  const updated = `${JSON.stringify(catalog, null, 2)}\n`
  await fs.writeFile(catalogPath, updated, 'utf8')
  console.log(`\nCatalog updated with local URLs at ${path.relative(rootDir, catalogPath)}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
