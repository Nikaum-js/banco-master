// A/B determinístico do limiar do Pregão de escassez (§7.5) — o experimento que a D-078 cita.
//
// Roda as MESMAS seeds duas vezes, mudando um único knob (`THEME.LAND_AUCTION_THRESHOLD`) e
// nada mais. Todo o resto do motor é o de produção: mesmo `runGame`, mesma política de agente,
// mesmos checadores de conservação e invariantes. Um par de linhas com a mesma seed só pode
// divergir pelo limiar — é isso que faz a comparação valer alguma coisa.
//
// Uso: bun run scripts/sim-threshold-ab.ts [--games=40] [--counts=2,3,6] [--base-seed=20260731]
//
// Por que mutar `THEME` em vez de parametrizar o motor: o limiar é constante de tema por
// desenho (D-060), e abrir um parâmetro no caminho de produção só para este estudo criaria
// uma configuração que ninguém joga. A mutação vive neste script, fora de `src/`, e cada
// braço roda em processo limpo do ponto de vista do estado do jogo (`runGame` monta a
// sessão do zero por partida).
import { THEME } from '@/game/theme'
import { runGame } from '../tests/sim/engine/runGame'
import type { SimResult } from '../tests/sim/engine/types'
import type { GameState } from '@/game/turn/types'

function argNumber(name: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? Number(arg.slice(name.length + 3)) : fallback
}

function argList(name: string, fallback: number[]): number[] {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.slice(name.length + 3).split(',').map(Number) : fallback
}

const games = argNumber('games', 40)
const counts = argList('counts', [2, 3, 6])
const baseSeed = argNumber('base-seed', 20260731)

interface Arm {
  threshold: number
  playerCount: number
  ok: number
  failed: number
  failures: string[]
  /** Partidas em que um pregão de ESCASSEZ chegou a abrir. */
  scarcityGames: number
  /** Aberturas de pregão de escassez (soma; o re-arme permite mais de uma por partida). */
  scarcityOpens: number
  /** Lotes de pregão de escassez (ou misto) que fecharam COM vencedor. */
  scarcityLotsSold: number
  /** Lotes de pregão de escassez (ou misto) que fecharam sem lance. */
  scarcityLotsUnsold: number
  rounds: number
  durationMs: number
  bankruptcies: number
}

function emptyArm(threshold: number, playerCount: number): Arm {
  return {
    threshold, playerCount, ok: 0, failed: 0, failures: [],
    scarcityGames: 0, scarcityOpens: 0, scarcityLotsSold: 0, scarcityLotsUnsold: 0,
    rounds: 0, durationMs: 0, bankruptcies: 0,
  }
}

// Um pregão conta como de escassez quando a procedência é `scarcity` ou `mixed` — `mixed` é
// um pregão de escassez que recebeu lotes de espólio (D-031), então o gatilho da §7.5 abriu.
function isScarcity(origin: string | undefined): boolean {
  return origin === 'scarcity' || origin === 'mixed'
}

function observeInto(arm: Arm, seen: { opened: boolean }) {
  return (prev: GameState, next: GameState): void => {
    // ABERTURA: não havia pregão e passou a haver com procedência de escassez.
    if (!prev.landAuction && next.landAuction && isScarcity(next.landAuction.origin)) {
      arm.scarcityOpens++
      if (!seen.opened) { arm.scarcityGames++; seen.opened = true }
    }
    // FECHO POR LOTE: lote que estava aberto e sumiu. `settleLot` já decidiu o destino, então
    // o vencedor se lê no título do estado seguinte — não no `highBidder`, que pode ter falido
    // entre o lance e o fecho (aí o lote fica livre e conta como não vendido).
    if (prev.landAuction && isScarcity(prev.landAuction.origin)) {
      const aindaAberto = new Set((next.landAuction?.lots ?? []).map((l) => l.pos))
      for (const lot of prev.landAuction.lots) {
        if (aindaAberto.has(lot.pos)) continue
        if (next.titles[lot.pos]?.ownerId) arm.scarcityLotsSold++
        else arm.scarcityLotsUnsold++
      }
    }
  }
}

function tally(arm: Arm, result: SimResult): void {
  arm.rounds += result.rounds
  arm.durationMs += result.durationMs
  if (result.outcome === 'ok') arm.ok++
  else {
    arm.failed++
    arm.failures.push(`seed ${result.seed}/${result.playerCount}p: ${result.failure?.reason} — ${result.failure?.detail?.slice(0, 160)}`)
  }
  // Duas marcas do harness cobrem os dois destinos da falência (§9.2/§9.3): `declare-bankruptcy`
  // é a que vai a credor-jogador, `declare-bankruptcy-sink` a que vai ao banco (e daí a pregão).
  arm.bankruptcies += (result.coverage['declare-bankruptcy'] ?? 0) + (result.coverage['declare-bankruptcy-sink'] ?? 0)
}

function runArm(threshold: number, playerCount: number): Arm {
  ;(THEME as unknown as { LAND_AUCTION_THRESHOLD: number }).LAND_AUCTION_THRESHOLD = threshold
  const arm = emptyArm(threshold, playerCount)
  for (let i = 0; i < games; i++) {
    const seed = baseSeed + playerCount * 100000 + i
    const seen = { opened: false }
    const result = runGame(seed, playerCount, 3000, observeInto(arm, seen))
    tally(arm, result)
  }
  return arm
}

const original = THEME.LAND_AUCTION_THRESHOLD
const pct = (n: number, d: number): string => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`)
const avg = (n: number, d: number): string => (d === 0 ? '—' : (n / d).toFixed(1))

console.log(`A/B do limiar do Pregão de escassez — ${games} partidas por contagem, seed base ${baseSeed}`)
console.log(`limiar original do tema: ${original}\n`)

const rows: { label: string; a: Arm; b: Arm }[] = []
for (const playerCount of counts) {
  const a = runArm(3, playerCount)
  const b = runArm(6, playerCount)
  rows.push({ label: `${playerCount} jogadores`, a, b })
}
;(THEME as unknown as { LAND_AUCTION_THRESHOLD: number }).LAND_AUCTION_THRESHOLD = original

const header = ['métrica', 'limiar 3', 'limiar 6', 'delta']
const lines: string[][] = []
for (const { label, a, b } of rows) {
  lines.push([`— ${label} —`, '', '', ''])
  lines.push(['partidas ok / falhas', `${a.ok} / ${a.failed}`, `${b.ok} / ${b.failed}`, ''])
  lines.push(['partidas com pregão de escassez', `${a.scarcityGames} (${pct(a.scarcityGames, games)})`, `${b.scarcityGames} (${pct(b.scarcityGames, games)})`, `${b.scarcityGames - a.scarcityGames}`])
  lines.push(['aberturas de pregão (total)', `${a.scarcityOpens}`, `${b.scarcityOpens}`, `${b.scarcityOpens - a.scarcityOpens > 0 ? '+' : ''}${b.scarcityOpens - a.scarcityOpens}`])
  lines.push(['lotes arrematados no pregão', `${a.scarcityLotsSold}`, `${b.scarcityLotsSold}`, `${b.scarcityLotsSold - a.scarcityLotsSold > 0 ? '+' : ''}${b.scarcityLotsSold - a.scarcityLotsSold}`])
  lines.push(['lotes sem lance', `${a.scarcityLotsUnsold}`, `${b.scarcityLotsUnsold}`, `${b.scarcityLotsUnsold - a.scarcityLotsUnsold > 0 ? '+' : ''}${b.scarcityLotsUnsold - a.scarcityLotsUnsold}`])
  lines.push(['rodadas (média)', avg(a.rounds, games), avg(b.rounds, games), `${(b.rounds / games - a.rounds / games).toFixed(1)}`])
  lines.push(['duração ms (média)', avg(a.durationMs, games), avg(b.durationMs, games), `${(b.durationMs / games - a.durationMs / games).toFixed(1)}`])
  lines.push(['falências (média)', avg(a.bankruptcies, games), avg(b.bankruptcies, games), `${(b.bankruptcies / games - a.bankruptcies / games).toFixed(2)}`])
}

const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)))
const row = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i])).join('  ')
console.log(row(header))
console.log(widths.map((w) => '-'.repeat(w)).join('  '))
for (const l of lines) console.log(row(l))

const todasFalhas = rows.flatMap(({ a, b }) => [...a.failures, ...b.failures])
console.log('')
if (todasFalhas.length > 0) {
  console.log(`FALHAS (conservação monetária / invariantes do motor): ${todasFalhas.length}`)
  for (const f of todasFalhas.slice(0, 20)) console.log(`  · ${f}`)
} else {
  console.log('Conservação monetária e invariantes do motor: sem violação nos dois braços.')
}
process.exit(todasFalhas.length === 0 ? 0 : 1)
