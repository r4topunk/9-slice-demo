#!/usr/bin/env node

import {
  getGlobalEthUsdPrice,
  getHistoricalEthUsdPrice
} from './lib/eth-price-store.mjs'

const DEFAULT_PROPOSALS = [
  {
    id: 'P-101',
    title: 'Rewards Program Q1',
    requestedEth: 12.5,
    createdAt: '2025-12-15'
  },
  {
    id: 'P-102',
    title: 'Community Grants',
    requestedEth: 5,
    createdAt: '2026-01-10'
  },
  {
    id: 'P-103',
    title: 'Infra Budget',
    requestedEth: 23.75,
    createdAt: '2026-01-28'
  }
]

const usage = () => {
  console.log(`\nUsage:\n  node scripts/proposal-usdc-poc.mjs [--mode both|current|historical]\n\nModes:\n  current     Option B - use one global ETH/USD price for all proposals\n  historical  Option A - use ETH/USD by proposal date\n  both        prints both views\n`)
}

const readArg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  return process.argv[index + 1] ?? fallback
}

const mode = readArg('--mode', 'both')
if (!['both', 'current', 'historical'].includes(mode)) {
  usage()
  process.exit(1)
}

const usd = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value)

const renderRows = (label, rows, totalUsd) => {
  console.log(`\n=== ${label} ===`)
  console.log('ID      | ETH      | ETH/USD   | Requested USD | Source')
  console.log('--------|----------|-----------|----------------|-----------------------')
  for (const row of rows) {
    const line = `${row.id.padEnd(7)} | ${row.requestedEth
      .toFixed(4)
      .padStart(8)} | ${row.ethUsd.toFixed(2).padStart(9)} | ${usd(row.requestedUsd).padStart(14)} | ${(row.priceSource ?? 'n/a').padEnd(21)}`
    console.log(line)
  }
  console.log(`TOTAL   |          |           | ${usd(totalUsd)} |`)
}

const renderCardPayload = (label, rows, totalUsd) => {
  const cards = rows.map((row) => ({
    id: row.id,
    title: row.title,
    requestedEth: row.requestedEth,
    requestedUsd: Number(row.requestedUsd.toFixed(2)),
    ethUsd: Number(row.ethUsd.toFixed(2))
  }))
  console.log(`\nCard payload (${label}):`)
  console.log(JSON.stringify({ cards, totalRequestedUsd: Number(totalUsd.toFixed(2)) }, null, 2))
}

const runCurrentMode = async (proposals) => {
  const snapshot = await getGlobalEthUsdPrice()
  const rows = proposals.map((proposal) => ({
    ...proposal,
    ethUsd: snapshot.usd,
    requestedUsd: proposal.requestedEth * snapshot.usd,
    priceSource: snapshot.source
  }))
  const totalUsd = rows.reduce((sum, row) => sum + row.requestedUsd, 0)

  renderRows(
    `Option B - Global Current Price (${snapshot.source}, fetched ${new Date(snapshot.fetchedAtMs).toISOString()})`,
    rows,
    totalUsd
  )
  renderCardPayload('global-current-price', rows, totalUsd)
}

const runHistoricalMode = async (proposals) => {
  const rows = []
  for (const proposal of proposals) {
    let snapshot
    let priceSource = 'coingecko-history'
    try {
      snapshot = await getHistoricalEthUsdPrice(proposal.createdAt)
    } catch {
      snapshot = await getGlobalEthUsdPrice()
      priceSource = `fallback-${snapshot.source}`
    }
    rows.push({
      ...proposal,
      ethUsd: snapshot.usd,
      requestedUsd: proposal.requestedEth * snapshot.usd,
      priceSource
    })
  }

  const totalUsd = rows.reduce((sum, row) => sum + row.requestedUsd, 0)
  renderRows('Option A - Historical Price by Proposal Date', rows, totalUsd)
  renderCardPayload('historical-by-proposal-date', rows, totalUsd)
}

const main = async () => {
  const proposals = DEFAULT_PROPOSALS

  if (mode === 'current' || mode === 'both') {
    await runCurrentMode(proposals)
  }

  if (mode === 'historical' || mode === 'both') {
    await runHistoricalMode(proposals)
  }

  console.log('\nPOC done: use this output to decide which pricing model should be on proposal cards.')
}

main().catch((error) => {
  console.error('proposal-usdc-poc failed:', error)
  process.exit(1)
})
