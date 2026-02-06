export type EthPriceSnapshot = {
  usd: number
  fetchedAtMs: number
  source: 'coingecko' | 'coinbase-spot'
}

export type HistoricalEthPriceSnapshot = {
  usd: number
  date: string
  fetchedAtMs: number
  source: 'coingecko-history'
}

const COINGECKO_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
const COINBASE_SPOT_PRICE_URL = 'https://api.coinbase.com/v2/prices/ETH-USD/spot'

const COINGECKO_HISTORY_URL = (dateDdMmYyyy: string) =>
  `https://api.coingecko.com/api/v3/coins/ethereum/history?date=${dateDdMmYyyy}&localization=false`

let currentSnapshot: EthPriceSnapshot | null = null
let currentInflight: Promise<EthPriceSnapshot> | null = null
const historicalByDate = new Map<string, HistoricalEthPriceSnapshot>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const toDdMmYyyy = (dateIsoYyyyMmDd: string) => {
  const [year, month, day] = dateIsoYyyyMmDd.split('-')
  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${dateIsoYyyyMmDd}`)
  }
  return `${day}-${month}-${year}`
}

const parseCurrentPrice = (payload: unknown) => {
  const value = (payload as { ethereum?: { usd?: number } })?.ethereum?.usd
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Invalid ETH/USD payload from price API')
  }
  return value
}

const parseCoinbaseSpotPrice = (payload: unknown) => {
  const amountRaw = (payload as { data?: { amount?: string } })?.data?.amount
  const value = typeof amountRaw === 'string' ? Number.parseFloat(amountRaw) : Number.NaN
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Invalid ETH/USD payload from Coinbase spot API')
  }
  return value
}

const parseHistoricalPrice = (payload: unknown) => {
  const value = (payload as { market_data?: { current_price?: { usd?: number } } })?.market_data?.current_price?.usd
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Invalid ETH/USD payload from historical API')
  }
  return value
}

export const getGlobalEthUsdPrice = async (ttlMs = 120_000): Promise<EthPriceSnapshot> => {
  const now = Date.now()
  if (currentSnapshot && now - currentSnapshot.fetchedAtMs < ttlMs) {
    return currentSnapshot
  }

  if (currentInflight) return currentInflight

  currentInflight = (async () => {
    let response: Response | null = null
    let coingeckoError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(COINGECKO_PRICE_URL, { headers: { accept: 'application/json' } })
      if (response.ok) break
      if (response.status !== 429 || attempt === 2) {
        coingeckoError = new Error(`ETH/USD request failed: ${response.status}`)
        break
      }
      await sleep((attempt + 1) * 600)
    }

    if (response && response.ok) {
      const payload = (await response.json()) as unknown
      const usd = parseCurrentPrice(payload)
      currentSnapshot = { usd, fetchedAtMs: Date.now(), source: 'coingecko' }
      return currentSnapshot
    }

    const spotResponse = await fetch(COINBASE_SPOT_PRICE_URL, { headers: { accept: 'application/json' } })
    if (!spotResponse.ok) {
      throw coingeckoError ?? new Error(`ETH/USD spot fallback failed: ${spotResponse.status}`)
    }
    const spotPayload = (await spotResponse.json()) as unknown
    const usd = parseCoinbaseSpotPrice(spotPayload)
    currentSnapshot = { usd, fetchedAtMs: Date.now(), source: 'coinbase-spot' }
    return currentSnapshot
  })().finally(() => {
    currentInflight = null
  })

  return currentInflight
}

export const getHistoricalEthUsdPrice = async (
  dateIsoYyyyMmDd: string
): Promise<HistoricalEthPriceSnapshot> => {
  const cached = historicalByDate.get(dateIsoYyyyMmDd)
  if (cached) return cached

  const apiDate = toDdMmYyyy(dateIsoYyyyMmDd)
  let response: Response | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(COINGECKO_HISTORY_URL(apiDate), { headers: { accept: 'application/json' } })
    if (response.ok) break
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`ETH/USD history request failed (${dateIsoYyyyMmDd}): ${response.status}`)
    }
    await sleep((attempt + 1) * 800)
  }
  if (!response || !response.ok) {
    throw new Error(`ETH/USD history request failed (${dateIsoYyyyMmDd})`)
  }

  const payload = (await response.json()) as unknown
  const usd = parseHistoricalPrice(payload)
  const snapshot: HistoricalEthPriceSnapshot = {
    usd,
    date: dateIsoYyyyMmDd,
    fetchedAtMs: Date.now(),
    source: 'coingecko-history'
  }
  historicalByDate.set(dateIsoYyyyMmDd, snapshot)
  return snapshot
}

export const clearEthPriceCache = () => {
  currentSnapshot = null
  currentInflight = null
  historicalByDate.clear()
}
