/**
 * CARD 01 — "Dinheiro zerado após retirar uma carta rara do Tesouro".
 *
 * Sequência relatada: jogador PRESO → rolou os dados → caiu numa casa de carta → sacou uma
 * carta RARA → percebeu o saldo em zero.
 *
 * O que a reprodução mostrou, e que este arquivo trava:
 *
 *   • Nenhuma carta rara move o caixa para zero. As raras do relato são `boicote` (Acaso, mão),
 *     `crise-imobiliaria` (Acaso, imediata, 5% do patrimônio), `saia-prisao`, `bunker-fiscal` e
 *     `boom-economico` (Tesouro). Quatro delas não tocam o caixa; a quinta cobra 5%.
 *
 *     Nota de vocabulário: a D-075 renomeou esse nível para ÉPICA (o nome "rara" passou a designar
 *     o nível abaixo). O relato original diz "rara", e o texto acima o preserva como foi escrito;
 *     as asserções abaixo falam a linguagem de hoje. Só o rótulo mudou — as mesmas cinco cartas,
 *     o mesmo efeito, a mesma conclusão.
 *   • Saindo da prisão (pos 12) com 6+5, o jogador para na **pos 23**, que é uma casa de
 *     **Acaso** — o `resolution=card-reveal` do log é consistente com isso, e `card-reveal` só
 *     abre para carta de MÃO (`cardRevealResolve`), que por definição não move dinheiro.
 *   • O log do relato mostra, imediatamente antes, a passagem de `seat=0` para `seat=1`. É ali
 *     que o Fiscal roda (§13.8) — a única cobrança do jogo que debita fora da vez, e que era
 *     completamente muda até a D-063. Um débito do Fiscal na virada, somado à multa de fiança,
 *     é o que produz "o saldo caiu e nada explica".
 *
 * Portanto: este arquivo prova que o caminho prisão→carta é INERTE para o caixa, e que a carta
 * é aplicada UMA vez (incluindo em replay). A narração do débito que de fato acontecia está em
 * `tests/game/balancing/taxManNarracao.test.ts` — e a evidência de que os dois cards
 * compartilham a mesma causa raiz está documentada no topo daquele arquivo.
 */
import { describe, it, expect } from 'vitest'
import { createSeedState, buildPorts, buildResolve } from '@/game/setup'
import { jailDecision, rollDice, resolvePending } from '@/game/turn/turnMachine'
import { confirmCardReveal } from '@/game/cards/draw'
import { cardById } from '@/game/cards/catalog'
import { recordingCtx, replayCtx } from '@/net/recorder'
import { THEME } from '@/game/theme'
import { BOARD, jailPos } from '@/lib/boardData'
import { rngFromDice } from '../turn/_helpers'
import type { TurnCtx } from '@/game/turn/turnMachine'
import type { GameState } from '@/game/turn/types'

const CARTA_DO_RELATO_DE_MAO = 'boicote-1' // Acaso, épica (ex-rara, D-075), modo 'mao'

function ctxComDados(values: number[]): TurnCtx {
  return { rng: rngFromDice(values), ports: buildPorts(), resolve: buildResolve(), now: () => 0, speedDie: false }
}

// A mesa do incidente: p1 preso no 12, deck de Acaso com a carta rara no topo.
function presoComCartaRaraNoTopo(): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.players[0].pos = jailPos()
  g.players[0].jail = { inJail: true, attempts: 0 }
  g.turn.state = 'prisao-decisao'
  g.decks.acaso = [CARTA_DO_RELATO_DE_MAO, ...g.decks.acaso.filter((c) => c !== CARTA_DO_RELATO_DE_MAO)]
  return g
}

describe('CARD 01 — prisão → rolagem → carta rara não zera o saldo', () => {
  it('a casa alcançada é de carta, e a carta do topo é do nível do relato e de mão', () => {
    expect(BOARD[jailPos() + 11].kind).toBe('acaso')
    const carta = cardById(CARTA_DO_RELATO_DE_MAO)
    expect(carta.rarity).toBe('epica') // o nível que o relato chamava de "rara" (D-075)
    expect(carta.mode).toBe('mao')
  })

  it('o incidente completo: sai da prisão pagando, rola 6+5, saca a rara — e o caixa só perde a fiança', () => {
    const g = presoComCartaRaraNoTopo()
    const inicial = g.players[0].cash

    let s = jailDecision(g, 'pay', ctxComDados([6, 5]))
    expect(s.players[0].cash).toBe(inicial - THEME.JAIL_FINE) // única saída legítima aqui

    s = rollDice(s, ctxComDados([6, 5]))
    expect(s.players[0].pos).toBe(23)

    s = resolvePending(s, ctxComDados([6, 5]))
    expect(s.resolution).toEqual({ kind: 'card-reveal', deckId: 'acaso', cardId: CARTA_DO_RELATO_DE_MAO })

    const depois = confirmCardReveal(s, buildPorts())

    // O ponto do card: a resolução da carta rara NÃO move caixa nenhum.
    expect(depois.players[0].cash).toBe(inicial - THEME.JAIL_FINE)
    expect(depois.players[1].cash).toBe(inicial)
    expect(depois.players[0].cash).not.toBe(0)
  })

  it('nenhum caixa vira NaN, undefined ou negativo em nenhum passo da sequência', () => {
    const g = presoComCartaRaraNoTopo()
    let s = jailDecision(g, 'pay', ctxComDados([6, 5]))
    s = rollDice(s, ctxComDados([6, 5]))
    s = resolvePending(s, ctxComDados([6, 5]))
    s = confirmCardReveal(s, buildPorts())

    for (const p of s.players) {
      expect(Number.isFinite(p.cash)).toBe(true)
      expect(Number.isInteger(p.cash)).toBe(true)
      expect(p.cash).toBeGreaterThanOrEqual(0)
    }
  })

  it('a carta é aplicada UMA vez: entra na mão uma vez e sai do deck uma vez', () => {
    const g = presoComCartaRaraNoTopo()
    const deckAntes = g.decks.acaso.length

    let s = jailDecision(g, 'pay', ctxComDados([6, 5]))
    s = rollDice(s, ctxComDados([6, 5]))
    s = resolvePending(s, ctxComDados([6, 5]))
    s = confirmCardReveal(s, buildPorts())

    expect(s.players[0].hand).toEqual([CARTA_DO_RELATO_DE_MAO])
    expect(s.decks.acaso).toHaveLength(deckAntes - 1)
    expect(s.decks.acaso).not.toContain(CARTA_DO_RELATO_DE_MAO) // não voltou ao fundo: está na mão
    expect(s.log.filter((e) => e.kind === 'card-draw')).toHaveLength(1)
  })

  it('confirmar a revelação DUAS vezes é no-op: o slot já foi limpo, não há segunda aplicação', () => {
    const g = presoComCartaRaraNoTopo()
    let s = jailDecision(g, 'pay', ctxComDados([6, 5]))
    s = rollDice(s, ctxComDados([6, 5]))
    s = resolvePending(s, ctxComDados([6, 5]))

    const uma = confirmCardReveal(s, buildPorts())
    const duas = confirmCardReveal(uma, buildPorts())

    expect(duas).toBe(uma) // identidade: nem clonou
    expect(duas.players[0].hand).toEqual([CARTA_DO_RELATO_DE_MAO])
  })

  it('replay do comando (host → cliente) converge byte a byte: o efeito não duplica', () => {
    // Mesmo mecanismo da produção (spec 037/043): o host aplica com `recordingCtx` e o cliente
    // reproduz com `replayCtx`. Se o saque fosse consumido duas vezes, ou se o cliente sacasse
    // do próprio deck, os dois estados divergiriam aqui — e é essa divergência que a UI
    // mostraria como saldo "oscilando".
    const g = presoComCartaRaraNoTopo()
    const base = jailDecision(g, 'pay', ctxComDados([6, 5]))
    const rolado = rollDice(base, ctxComDados([6, 5]))

    const { ctx, drain } = recordingCtx(ctxComDados([6, 5]))
    const noHost = resolvePending(rolado, ctx)
    const gravado = drain()

    const noCliente = resolvePending(rolado, replayCtx(ctxComDados([6, 5]), gravado))

    expect(noCliente).toEqual(noHost)
    expect(gravado.draws).toEqual([CARTA_DO_RELATO_DE_MAO]) // UM saque, não dois
    expect(noHost.players.map((p) => p.cash)).toEqual(noCliente.players.map((p) => p.cash))
  })

  it('sair da prisão com a carta "Saia da Prisão" não cobra fiança nem mexe no caixa', () => {
    const g = presoComCartaRaraNoTopo()
    const inicial = g.players[0].cash

    const s = jailDecision(g, 'card', ctxComDados([6, 5]))

    expect(s.players[0].jail.inJail).toBe(false)
    expect(s.players[0].cash).toBe(inicial)
  })

  it('a carta rara IMEDIATA do mesmo deck não cobra de quem a sacou (D-064)', () => {
    // `crise-imobiliaria` é a única rara de Acaso que move dinheiro. Fica aqui para o card ter a
    // alternativa auditada, não só a hipótese que passou.
    //
    // A D-064 mudou a carta: antes cobrava 5% de TODOS (inclusive de quem sacou), agora cobra 10%
    // só dos ADVERSÁRIOS. Isso fortalece a conclusão do CARD 01 em vez de enfraquecê-la — quem
    // saca a carta no caminho prisão→Acaso não perde nada por ela, nem 5%.
    const g = presoComCartaRaraNoTopo()
    g.decks.acaso = ['crise-imobiliaria-1', ...g.decks.acaso]
    g.players[0].cash = 1_000
    g.players[1].cash = 1_000

    let s = jailDecision(g, 'pay', ctxComDados([6, 5]))
    s = rollDice(s, ctxComDados([6, 5]))
    s = resolvePending(s, ctxComDados([6, 5]))

    // Imediata NÃO abre `card-reveal` (`cardRevealResolve` aplica direto) — o log do relato
    // mostrava `card-reveal`, o que já a descartava como a carta do incidente.
    expect(s.resolution).toBeNull()
    // Quem sacou: só a fiança saiu do caixa dele. Nada da carta.
    expect(s.players[0].cash).toBe(1_000 - THEME.JAIL_FINE)
    // O adversário paga 10% do patrimônio dele — e o débito é NARRADO (D-063).
    expect(1_000 - s.players[1].cash).toBe(Math.round(1_000 * 0.1))
    expect(s.log.some((e) => e.kind === 'card-collect' && e.who === 'p2')).toBe(true)
  })
})
