import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const HOST = '127.0.0.1'
const PORT = 4174
const URL = `http://${HOST}:${PORT}/play`
const RUNS = 3

const BUDGET = {
  performance: 82,
  firstContentfulPaintMs: 3_200,
  largestContentfulPaintMs: 4_000,
  totalBlockingTimeMs: 200,
  cumulativeLayoutShift: 0.1,
} as const

interface LighthouseReport {
  runtimeError?: { code?: string; message?: string }
  categories: { performance: { score: number | null } }
  audits: Record<string, { numericValue?: number }>
}

interface Measurement {
  performance: number
  firstContentfulPaintMs: number
  largestContentfulPaintMs: number
  totalBlockingTimeMs: number
  cumulativeLayoutShift: number
}

function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.floor(ordered.length / 2)]
}

function auditValue(report: LighthouseReport, id: string): number {
  const value = report.audits[id]?.numericValue
  if (typeof value !== 'number') throw new Error(`Lighthouse não informou a métrica ${id}.`)
  return value
}

function runLighthouse(outputPath: string, chromePath: string): Promise<void> {
  const args = [
    'lighthouse',
    URL,
    '--only-categories=performance',
    '--output=json',
    `--output-path=${outputPath}`,
    `--chrome-path=${chromePath}`,
    '--chrome-flags=--headless=new --no-sandbox',
    '--form-factor=mobile',
    '--quiet',
  ]

  return new Promise((resolve, reject) => {
    const child = spawn('bunx', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''

    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.stderr.on('data', (chunk) => { output += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Lighthouse terminou com código ${String(code)}.\n${output.slice(-4_000)}`))
    })
  })
}

async function readMeasurement(path: string): Promise<Measurement> {
  const report = JSON.parse(await readFile(path, 'utf8')) as LighthouseReport
  if (report.runtimeError) {
    throw new Error(`${report.runtimeError.code ?? 'LIGHTHOUSE_ERROR'}: ${report.runtimeError.message ?? ''}`)
  }

  const score = report.categories.performance.score
  if (typeof score !== 'number') throw new Error('Lighthouse não calculou a nota de performance.')

  return {
    performance: Math.round(score * 100),
    firstContentfulPaintMs: auditValue(report, 'first-contentful-paint'),
    largestContentfulPaintMs: auditValue(report, 'largest-contentful-paint'),
    totalBlockingTimeMs: auditValue(report, 'total-blocking-time'),
    cumulativeLayoutShift: auditValue(report, 'cumulative-layout-shift'),
  }
}

function formatMs(value: number): string {
  return `${Math.round(value)}ms`
}

const tempDir = await mkdtemp(join(tmpdir(), 'magnata-lighthouse-'))
const server = await preview({
  logLevel: 'error',
  preview: { host: HOST, port: PORT, strictPort: true },
})

try {
  const chromePath = process.env.CHROME_PATH || chromium.executablePath()
  const measurements: Measurement[] = []

  for (let run = 1; run <= RUNS; run += 1) {
    const outputPath = join(tempDir, `run-${run}.json`)
    await runLighthouse(outputPath, chromePath)
    const measurement = await readMeasurement(outputPath)
    measurements.push(measurement)
    console.log(
      `Lighthouse ${run}/${RUNS}: ${measurement.performance} · FCP ${formatMs(measurement.firstContentfulPaintMs)} · LCP ${formatMs(measurement.largestContentfulPaintMs)} · TBT ${formatMs(measurement.totalBlockingTimeMs)} · CLS ${measurement.cumulativeLayoutShift.toFixed(3)}`,
    )
  }

  const result = {
    performance: median(measurements.map((item) => item.performance)),
    firstContentfulPaintMs: median(measurements.map((item) => item.firstContentfulPaintMs)),
    largestContentfulPaintMs: median(measurements.map((item) => item.largestContentfulPaintMs)),
    totalBlockingTimeMs: median(measurements.map((item) => item.totalBlockingTimeMs)),
    cumulativeLayoutShift: median(measurements.map((item) => item.cumulativeLayoutShift)),
  }

  console.log(
    `Mediana: ${result.performance} · FCP ${formatMs(result.firstContentfulPaintMs)} · LCP ${formatMs(result.largestContentfulPaintMs)} · TBT ${formatMs(result.totalBlockingTimeMs)} · CLS ${result.cumulativeLayoutShift.toFixed(3)}`,
  )

  const failures = [
    result.performance < BUDGET.performance && `performance ${result.performance} < ${BUDGET.performance}`,
    result.firstContentfulPaintMs > BUDGET.firstContentfulPaintMs && `FCP ${formatMs(result.firstContentfulPaintMs)} > ${formatMs(BUDGET.firstContentfulPaintMs)}`,
    result.largestContentfulPaintMs > BUDGET.largestContentfulPaintMs && `LCP ${formatMs(result.largestContentfulPaintMs)} > ${formatMs(BUDGET.largestContentfulPaintMs)}`,
    result.totalBlockingTimeMs > BUDGET.totalBlockingTimeMs && `TBT ${formatMs(result.totalBlockingTimeMs)} > ${formatMs(BUDGET.totalBlockingTimeMs)}`,
    result.cumulativeLayoutShift > BUDGET.cumulativeLayoutShift && `CLS ${result.cumulativeLayoutShift.toFixed(3)} > ${BUDGET.cumulativeLayoutShift}`,
  ].filter(Boolean)

  if (failures.length > 0) throw new Error(`Orçamento Lighthouse excedido:\n- ${failures.join('\n- ')}`)
} finally {
  await new Promise<void>((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve())
  })
  await rm(tempDir, { recursive: true, force: true })
}
