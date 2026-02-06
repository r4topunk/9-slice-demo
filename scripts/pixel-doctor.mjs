import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSpec, parseArgs, writeFileSafe } from './pixel-utils.mjs'
import { analyzeProportion } from './pixel-proportion-check.mjs'
import { analyzeStyle } from './pixel-style-check.mjs'

const toMarkdown = (proportion, style, overallScore) => {
  const rows = [
    ...proportion.metrics.map((metric) => ({
      section: 'proportion',
      label: metric.label,
      status: metric.status,
      value: metric.value,
      target: metric.target
    })),
    ...style.metrics.map((metric) => ({
      section: 'style',
      label: metric.label,
      status: metric.status,
      value: metric.value,
      target: metric.target
    }))
  ]

  const header = [
    '# Pixel Doctor Report',
    '',
    `- Proportion profile: ${proportion.profileName}`,
    `- Style profile: ${style.styleName}`,
    `- Overall score: ${overallScore}/100`,
    ''
  ].join('\n')

  const tableHead = [
    '| Section | Metric | Status | Value | Target |',
    '| --- | --- | --- | ---: | --- |'
  ].join('\n')

  const tableRows = rows
    .map((row) => {
      const [min, max] = row.target
      return `| ${row.section} | ${row.label} | ${row.status.toUpperCase()} | ${row.value.toFixed(3)} | ${min.toFixed(3)}..${max.toFixed(3)} |`
    })
    .join('\n')

  const suggestions = [
    ...proportion.suggestions.map((item) => `- ${item}`),
    ...style.suggestions.map((item) => `- ${item}`)
  ]

  const suggestionBlock = suggestions.length
    ? ['## Suggested Next Tweaks', '', ...suggestions, ''].join('\n')
    : '## Suggested Next Tweaks\n\n- No immediate fixes suggested.\n'

  return `${header}${tableHead}\n${tableRows}\n\n${suggestionBlock}`
}

const runCli = () => {
  const args = parseArgs(process.argv, {
    proportion: 'balanced',
    style: 'clean',
    output: 'output/pixel-art/proportion-style-report.md'
  })

  const spec = loadSpec()
  const proportion = analyzeProportion(spec, String(args.proportion))
  const style = analyzeStyle(spec, String(args.style))
  const overallScore = Math.round((proportion.score + style.score) * 0.5)

  console.log(
    `[pixel-doctor] proportion=${proportion.profileName} style=${style.styleName} score=${overallScore}/100`
  )
  console.log(
    `- Proportion score: ${proportion.score}/100 (${proportion.metrics.filter((m) => m.status !== 'ok').length} warnings)`
  )
  console.log(`- Style score: ${style.score}/100 (${style.metrics.filter((m) => m.status !== 'ok').length} warnings)`)

  if (!args['no-write']) {
    const report = toMarkdown(proportion, style, overallScore)
    const saved = writeFileSafe(String(args.output), report)
    console.log(`- Report: ${saved}`)
  }

  if (args.strict) {
    const hasWarn =
      proportion.metrics.some((metric) => metric.status !== 'ok') ||
      style.metrics.some((metric) => metric.status !== 'ok')
    if (hasWarn) process.exitCode = 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) runCli()
