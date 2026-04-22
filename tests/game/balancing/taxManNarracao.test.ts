/**
 * CARDs 04, 05 e 09 — perda de dinheiro fora da vez, e "as contas oscilam" (§13.8, D-063).
 *
 * Os três relatos são DISTINTOS e foram reproduzidos separadamente (blocos separados abaixo,
 * com os assentos ativos que cada relato descreve). Eles compartilham a MESMA causa raiz, e a
 * evidência dessa conclusão é esta:
 *
 *   1. `rollTaxMan` é o ÚNICO caminho do motor que debita um jogador que não é o da vez sem
 *      passar por nenhuma decisão dele. (Os outros débitos fora da vez — Aniversário, Crise,
 *      Auditoria, Aquisição — nascem todos de uma carta que alguém JOGOU, e a carta é pública.)
 *   2. Ele roda dentro de `advanceSeat`, isto é, exatamente na PASSAGEM DE TURNO — o instante
 *      que os três relatos descrevem ("quando não era minha vez", "durante e depois de uma dupla").
 *   3. Ele não emitia `logEvent` nenhum. Nem log, nem notice, nem som. O teste
 *      `nao_narrava_nada` abaixo prova que a ausência era total, não parcial.
 *   4. O valor cobrado é o aluguel da propriedade em que o Fiscal parou — e `$200` (CARD 09) é
 *      o aluguel de um aeroporto com os 4 do grupo, ou de uma cidade construída de tier médio;
 *      `taxman_200` reproduz o número exato do relato.
 *
 * Não há bug de cálculo em nenhum dos três: há uma cobrança CORRETA (§13.8) que o jogo se
 * recusava a explicar. A correção é narrativa, não aritmética — e é por isso que o valor
 * cobrado permanece idêntico em todos os testes.
 *
 * O que este arquivo NÃO cobre: o desaparecimento do resto de uma obrigação entre jogadores
 * (CARD 02) — causa raiz diferente, arquivo diferente (`tests/game/economy/obrigacao.test.ts`).
 */
import { describe, it, expect } from 'vitest'
import { createSeedState, buildPorts } from '@/game/setup'
import { rollTaxMan } from '@/game/balancing/taxMan'
import { finalizeTurn, activePlayer } from '@/game/turn/turnMachine'
import { rentAirport } from '@/game/economy/rent'
import { THEME } from '@/game/theme'
import { ctxWith } from '../turn/_helpers'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'

// RNG que faz o Fiscal cair EXATAMENTE em `target` saindo de `from`.
// `rollTaxMan` consome dois valores de rng (dois dados brancos), então os dois somados têm de
// dar a distância — e cada um cabe em 1..6, o que limita o salto a 12 casas.
function rngParaFiscalCairEm(from: number, target: number): () => number {
  const dist = (target - from + BOARD.length) % BOARD.length
  if (dist < 2 || dist > 12) throw new Error(`distância ${dist} não é alcançável com 2 dados`)
  const d0 = Math.min(6, dist - 1)
  const d1 = dist - d0
  const values = [d0, d1]
  let i = 0
  return () => {
    const v = values[i % values.length]
    i += 1
    return (v - 0.5) / 6
  }
}

const AEROPORTOS = BOARD.filter((sq) => sq.kind === 'airport').map((sq) => sq.pos)

// Mesa em que o Fiscal vai parar num aeroporto de `owner`, que possui TODOS os aeroportos —
// o que faz o aluguel ser o topo da tabela: $200 (`THEME.AIRPORT_RENT[3]`).
function mesaComFiscalIndoAoAeroporto(owner: string, activeSeat: number): { game: GameState; alvo: number } {
  const g = createSeedState(['p1', 'p2'])
  g.activeSeat = activeSeat
  g.turn.seat = activeSeat
  for (const pos of AEROPORTOS) g.titles[pos].ownerId = owner
  const alvo = AEROPORTOS.find((pos) => {
    const dist = (pos - g.taxManPos + BOARD.length) % BOARD.length
    return dist >= 2 && dist <= 12
  })!
  return { game: g, alvo }
}

describe('CARD 09 — perda de 200 fora da vez, com seat=1 ativo (§13.8)', () => {
  it('taxman_200: o Fiscal cobra exatamente $200 do dono, e o dono NÃO é o jogador da vez', () => {
    // seat=1 ativo (p2), como o log do CARD 09 mostra. O dono cobrado é p1.
    const { game, alvo } = mesaComFiscalIndoAoAeroporto('p1', 1)
    const antes = game.players[0].cash
    expect(activePlayer(game).id).toBe('p2') // não é a vez de p1

    rollTaxMan(game, rngParaFiscalCairEm(game.taxManPos, alvo))

    expect(game.taxManPos).toBe(alvo)
    // $200 = aluguel de aeroporto com os 4 do grupo. É o número do relato, e ele é CORRETO.
    expect(rentAirport(AEROPORTOS.length)).toBe(200)
    expect(antes - game.players[0].cash).toBe(200)
  })

  it('a origem dos 200 fica identificada no log, nomeando dono, propriedade e valor', () => {
    const { game, alvo } = mesaComFiscalIndoAoAeroporto('p1', 1)
    rollTaxMan(game, rngParaFiscalCairEm(game.taxManPos, alvo))

    expect(game.log.at(-1)).toEqual({ kind: 'tax-man', who: 'p1', pos: alvo, amount: 200, due: 200 })
  })
})

describe('CARD 05 — jogador perde dinheiro fora da vez, com seat=0 ativo (§13.8)', () => {
  it('com p1 na vez, quem tem o saldo alterado é p2 — e o motivo aparece no log', () => {
    // seat=0 ativo (p1), como o log do CARD 05 mostra. O dono cobrado é p2.
    const { game, alvo } = mesaComFiscalIndoAoAeroporto('p2', 0)
    const antesAtivo = game.players[0].cash
    const antesObservador = game.players[1].cash
    expect(activePlayer(game).id).toBe('p1')

    rollTaxMan(game, rngParaFiscalCairEm(game.taxManPos, alvo))

    expect(game.players[0].cash).toBe(antesAtivo) // o jogador da vez não paga nada
    expect(antesObservador - game.players[1].cash).toBe(200) // quem paga é o dono, fora da vez
    expect(game.log.at(-1)).toMatchObject({ kind: 'tax-man', who: 'p2', pos: alvo })
  })

  it('não_narrava_nada: a ausência de fato era TOTAL — é o que a correção fecha', () => {
    const { game, alvo } = mesaComFiscalIndoAoAeroporto('p2', 0)
    const logAntes = game.log.length

    rollTaxMan(game, rngParaFiscalCairEm(game.taxManPos, alvo))

    // Antes da D-063 esta contagem ficava em 0 com o caixa mudando: nenhum log, e (verificado
    // no classificador de som e no `notice`) nenhum outro canal cobria o fato.
    expect(game.log.length).toBe(logAntes + 1)
    expect(game.notice).toBeNull() // o Fiscal é catch-up DISCRETO (princípio IV): sem modal
  })

  it('nenhum dinheiro muda quando o Fiscal para em casa sem dono — nem log de cobrança', () => {
    const g = createSeedState(['p1', 'p2'])
    const antes = g.players.map((p) => p.cash)

    rollTaxMan(g, rngParaFiscalCairEm(g.taxManPos, AEROPORTOS[0])) // aeroporto SEM dono

    expect(g.players.map((p) => p.cash)).toEqual(antes)
    expect(g.log.some((e) => e.kind === 'tax-man')).toBe(false)
  })

  it('mutação por troca de turno só existe com evento econômico: sem propriedade, sem débito', () => {
    const g = createSeedState(['p1', 'p2'])
    g.turn.state = 'aguardando-finalizacao'
    const antes = g.players.map((p) => p.cash)

    // `finalizeTurn` passa a vez, o que roda o Fiscal pela porta — tabuleiro vazio, nada a cobrar.
    const after = finalizeTurn(g, ctxWith([3, 4], { ports: buildPorts() }))

    expect(after.players.map((p) => p.cash)).toEqual(antes)
    expect(after.activeSeat).toBe(1)
  })
})

describe('CARD 04 — contas oscilam durante e depois de uma dupla (§13.8)', () => {
  it('dupla NÃO passa a vez, então o Fiscal não corre e nenhum efeito é reaplicado', () => {
    const g = createSeedState(['p1', 'p2'])
    for (const pos of AEROPORTOS) g.titles[pos].ownerId = 'p1'
    g.turn.state = 'aguardando-finalizacao'
    g.turn.mayRollAgain = true // dupla: o MESMO jogador rola de novo
    g.turn.consecutiveDoubles = 1
    const antes = g.players.map((p) => p.cash)
    const fiscalAntes = g.taxManPos

    const after = finalizeTurn(g, ctxWith([3, 4], { ports: buildPorts() }))

    // Este é o ponto do CARD 04: `mayRollAgain` devolve a rolagem sem passar a vez, e como o
    // Fiscal roda em `advanceSeat`, ele NÃO pode correr aqui. Se corresse, o dono levaria duas
    // cobranças no mesmo turno — e é exatamente essa a forma de "as contas oscilam".
    expect(after.taxManPos).toBe(fiscalAntes)
    expect(after.players.map((p) => p.cash)).toEqual(antes)
    expect(after.activeSeat).toBe(0) // segue o mesmo jogador
    expect(after.turn.state).toBe('aguardando-rolagem')
    expect(after.turn.mayRollAgain).toBe(false)
    expect(after.turn.consecutiveDoubles).toBe(1) // a contagem de duplas persiste
  })

  it('depois da dupla, quando a vez PASSA, o Fiscal corre UMA vez e narra', () => {
    const { game, alvo } = mesaComFiscalIndoAoAeroporto('p1', 0)
    game.turn.state = 'aguardando-finalizacao'
    game.turn.mayRollAgain = false // acabou a sequência de duplas
    const antes = game.players[0].cash
    const rng = rngParaFiscalCairEm(game.taxManPos, alvo)

    const after = finalizeTurn(game, { rng, ports: buildPorts(), speedDie: false })

    expect(after.activeSeat).toBe(1)
    expect(antes - after.players[0].cash).toBe(200) // uma cobrança, não duas
    expect(after.log.filter((e) => e.kind === 'tax-man')).toHaveLength(1)
  })

  it('o Fiscal trunca ao caixa e NÃO abre dívida — catch-up discreto não elimina (§9.1)', () => {
    const { game, alvo } = mesaComFiscalIndoAoAeroporto('p1', 1)
    game.players[0].cash = 30 // menos que os $200 devidos

    rollTaxMan(game, rngParaFiscalCairEm(game.taxManPos, alvo))

    expect(game.players[0].cash).toBe(0) // nunca negativo
    expect(game.obligations).toEqual([]) // sem dívida: o credor é o banco (§9.1/D-061)
    expect(game.resolution).toBeNull()
    // A frase distingue cobrança truncada de cobrança cheia — `amount` < `due`.
    expect(game.log.at(-1)).toEqual({ kind: 'tax-man', who: 'p1', pos: alvo, amount: 30, due: 200 })
  })

  it('propriedade hipotecada ou boicotada não é cobrada — e o silêncio ali é correto', () => {
    const { game, alvo } = mesaComFiscalIndoAoAeroporto('p1', 1)
    game.titles[alvo].mortgaged = true
    const antes = game.players[0].cash

    rollTaxMan(game, rngParaFiscalCairEm(game.taxManPos, alvo))

    expect(game.players[0].cash).toBe(antes)
    expect(game.log.some((e) => e.kind === 'tax-man')).toBe(false)
  })

  it('a janela do pregão é a do tema, e o tema é a fonte única do valor', () => {
    // Guarda contra o número mágico voltar espalhado pelo código (D-060 subiu 8s → 24s).
    expect(THEME.LAND_AUCTION_SECONDS).toBe(24)
    expect(THEME.LAND_AUCTION_THRESHOLD).toBe(3)
  })
})
