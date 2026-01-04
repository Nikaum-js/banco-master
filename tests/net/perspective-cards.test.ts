// Perspectiva de carta ponta a ponta (spec 043, T032/US5). `convergence.test.ts` prova que o
// estado PÚBLICO nunca diverge; este arquivo prova a metade que aquele não cobre — o que cada
// cliente vê da PRÓPRIA mão/baralho, e o que nunca deveria ver da alheia.
//
// Dirige uma partida de 3 com o mesmo agente aleatório do harness 036, checando a cada passo:
// (1) cada cliente conhece a própria mão; (2) a mão alheia é sempre `null` no lugar da carta;
// (3) ninguém prevê o topo do baralho; (4) o comprimento (§12.3) é público e bate nas três
// perspectivas; (5) carta imediata é pública para todos (nunca `null` em lugar nenhum). Duas
// asserções pontuais fecham o resto: jogar revela (`play-hand-card` deixa a carta visível na
// própria mão momentos antes, e pública no log/efeito), descartar não (o log nunca nomeia a
// carta perdida).
import { describe, expect, it } from 'vitest'
import { enumerateActions } from '../sim/engine/actions'
import { pickAction } from '../sim/engine/agent'
import type { SimSession } from '../sim/engine/driver'
import { mulberry32 } from '../sim/engine/rng'
import type { PlayerAction } from '@/game/commands'
import { cardById } from '@/game/cards/catalog'
import { setupGame, settleAuctions, clientOf, publicView, type NetGame } from './harness'

const DECKS = ['acaso', 'tesouro'] as const

async function driveAndCheck(playerCount: number, seed: number, steps: number): Promise<{ sawHiddenMao: boolean; sawImediata: boolean; sawPlay: boolean; sawDiscard: boolean }> {
  const net: NetGame = await setupGame(playerCount, seed)
  const pickRng = mulberry32(seed * 3 + 1)

  let sawHiddenMao = false
  let sawImediata = false
  let sawPlay = false
  let sawDiscard = false

  // Cartas cuja identidade já é PÚBLICA por algum caminho legítimo (D9/D10): imediata (o
  // `draw` grava o id sem redação — nunca é `mao`) ou de MÃO já JOGADA (`play-hand-card` —
  // jogar é revelar). Uma vez aqui, ver essa carta reciclada ao fundo do baralho não é
  // vazamento — a mesa já sabe qual é. Lido do aceito CRU (o que a difusão de fato carrega),
  // não deduzido do estado — é a fonte da verdade que a própria redação usa.
  const revealed = new Set<string>()
  // E cartas que um jogador ESPECÍFICO já teve na própria mão (sacou, ou reagiu com ela) — ele
  // continua sabendo qual é depois de usada/descartada; não é vazamento para SI MESMO. Por uid,
  // a partir do que a própria cópia privada de cada um entrega.
  const everOwnedBy = new Map<string, Set<string>>()
  for (const p of net.players) {
    everOwnedBy.set(p.uid, new Set())
    p.transport.onBroadcast((cmd) => {
      const a = cmd.action as { kind: string; cardId?: string | null }
      const mine = everOwnedBy.get(p.uid)!
      if ((a.kind === 'play-hand-card' || a.kind === 'discard-card') && a.cardId) mine.add(a.cardId)
      for (const id of cmd.resolved.draws) if (id !== null) mine.add(id)
    })
  }
  net.players[0].transport.onBroadcast((cmd) => {
    const a = cmd.action as { kind: string; cardId?: string | null }
    if (a.kind === 'play-hand-card' && a.cardId) revealed.add(a.cardId)
    for (const id of cmd.resolved.draws) if (id !== null && cardById(id).mode === 'imediato') revealed.add(id)
  })

  for (let s = 0; s < steps && net.host.game().phase !== 'ended'; s++) {
    settleAuctions(net)
    if (net.host.game().phase === 'ended') break
    const points = enumerateActions({ game: net.host.game() } as unknown as SimSession)
    if (points.length === 0) break
    const { actorId, action } = pickAction(pickRng, points)
    if (action.kind === 'play-hand-card') sawPlay = true
    if (action.kind === 'discard-card') sawDiscard = true
    clientOf(net, actorId).send(action as PlayerAction)

    const hostGame = net.host.game()
    const lastLog = hostGame.log.at(-1)
    if (lastLog?.kind === 'card-immediate') sawImediata = true

    // Convergência do estado PÚBLICO — a mesma invariante de convergence.test.ts, verificada
    // aqui de novo porque é o que ancora as checagens de perspectiva que seguem.
    const ref = JSON.stringify(publicView(hostGame))
    for (const p of net.players) {
      const g = p.client.game()
      if (!g) continue
      expect(JSON.stringify(publicView(g))).toBe(ref)
    }

    const hostUid = net.players[0].uid // setupGame: idents[0] é sempre o anfitrião

    for (const p of net.players) {
      const g = p.client.game()
      if (!g) continue
      const isHostView = p.uid === hostUid // §10.3 — exceção conhecida: a autoridade vê tudo

      for (const hp of hostGame.players) {
        const cp = g.players.find((x) => x.id === hp.id)!
        // §12.3 — comprimento é verdade pública, igual na autoridade e em toda perspectiva.
        expect(cp.hand.length).toBe(hp.hand.length)

        if (hp.id === p.playerId || isHostView) {
          // A própria mão: sempre real (D9 — a cópia privada chega). A do anfitrião TAMBÉM —
          // ele recebe `secrets` inteiro (D6/§10.3), não só a própria entrada.
          expect(cp.hand).toEqual(hp.hand)
        } else {
          // Mão ALHEIA, vista por quem NÃO é a autoridade: toda entrada visível só pode ser
          // carta IMEDIATA (nunca fica na mão — então isto nunca deveria disparar) ou `null`.
          // Ver uma carta de MODO 'mao' alheia seria o vazamento que a spec existe para fechar.
          for (const cid of cp.hand) {
            if (cid === null) { sawHiddenMao = true; continue }
            expect(cardById(cid).mode).toBe('imediato')
          }
        }
      }

      // Ninguém prevê o baralho — EXCETO a autoridade (§10.3, mesma exceção). Numa perspectiva
      // não-autoridade, uma posição pode ficar visível DEPOIS de uma carta IMEDIATA (ou uma de
      // MÃO já JOGADA/descartada pelo PRÓPRIO dono) ser reciclada ao fundo — a identidade dela
      // já é pública por outro caminho; o que continua oculto é a de MÃO que ninguém revelou.
      for (const deckId of DECKS) {
        expect(g.decks[deckId].length).toBe(hostGame.decks[deckId].length)
        if (isHostView) { expect(g.decks[deckId]).toEqual(hostGame.decks[deckId]); continue }
        for (const cid of g.decks[deckId]) {
          if (cid !== null) expect(revealed.has(cid) || everOwnedBy.get(p.uid)!.has(cid)).toBe(true)
        }
      }
    }
  }

  return { sawHiddenMao, sawImediata, sawPlay, sawDiscard }
}

describe('perspectiva de carta (043, US5) — a mão para de trafegar', () => {
  // Timeout explícito: este caso dirige 2000 passos de uma partida de 3 e leva ~5s numa
  // máquina livre — exatamente o teto padrão do Vitest. Rodando junto da suíte inteira em
  // paralelo, ele estourava por centésimos e reprovava o gate sem nenhuma regressão real
  // (visto duas vezes em 2026-07-27, sempre verde quando isolado). A folga é do RELÓGIO,
  // não da asserção: se a perspectiva quebrar, ele continua falhando na asserção.
  it('3 jogadores: mão própria real, alheia oculta, baralho nunca previsto, convergência pública mantida', async () => {
    const { sawHiddenMao, sawImediata } = await driveAndCheck(3, 1, 2000)
    expect(sawHiddenMao).toBe(true) // exercitou o caso que a spec existe para cobrir
    expect(sawImediata).toBe(true) // carta imediata continua pública (§12.2)
  }, 30_000)

  it('jogar uma carta a revela no aceito difundido (D10 — jogar é revelar)', async () => {
    // Um `play-hand-card` legítimo o suficiente para o gate de `enumerateActions` (036) topar
    // com ele em pouco tempo é raro construir à mão sem duplicar regra de negócio (Boicote
    // exige propriedade alheia; Imunidade exige propriedade própria) — dirigir a partida é mais
    // barato aqui do que montar o cenário. Só o suficiente pra observar UM `play-hand-card`.
    const net = await setupGame(3, 42)
    const pickRng = mulberry32(42 * 3 + 1)

    const seenByUid = new Map<string, { seq: number; cardId: unknown }[]>()
    for (const p of net.players) {
      seenByUid.set(p.uid, [])
      p.transport.onBroadcast((cmd) => {
        const a = cmd.action as { kind: string; cardId?: unknown }
        if (a.kind === 'play-hand-card') seenByUid.get(p.uid)!.push({ seq: cmd.seq, cardId: a.cardId })
      })
    }

    // 6000 passos, não 2000: a D-074 reduziu as cartas de MÃO a 1 cópia cada (Aquisição Hostil
    // e Bunker Fiscal caíram de 2), então topar com um `play-hand-card` legítimo ficou mais raro
    // — a busca precisa de mais tabuleiro. A asserção continua sendo sobre PERSPECTIVA; o número
    // de passos é só o tamanho da varredura até o cenário aparecer.
    for (let s = 0; s < 6000 && net.host.game().phase !== 'ended'; s++) {
      settleAuctions(net)
      if (net.host.game().phase === 'ended') break
      const points = enumerateActions({ game: net.host.game() } as unknown as SimSession)
      if (points.length === 0) break
      const { actorId, action } = pickAction(pickRng, points)
      clientOf(net, actorId).send(action as PlayerAction)
    }

    let sawRevealedPlay = false
    for (const p of net.players) {
      for (const entry of seenByUid.get(p.uid)!) {
        expect(entry.cardId).not.toBeNull() // TODOS veem o id real, dono ou não (D10)
        sawRevealedPlay = true
      }
    }
    expect(sawRevealedPlay).toBe(true)
  })

  it('descartar chega redigido a quem não é o dono (D10 — descartar não revela)', async () => {
    // Descarte forçado (4ª carta) é raro no passeio aleatório — construído direto: a mão do
    // jogador ATIVO já cheia (043, sem depender de sorte para chegar lá), como
    // `revelacao.test.ts` faz no nível do motor. Aqui o que se prova é o TRANSPORTE: o aceito
    // que chega a quem não é o dono tem `cardId: null` (D10); o dono recebe a cópia real.
    const net = await setupGame(2, 5)
    const g = net.host.game()
    const activeId = g.players[g.turnOrder[g.activeSeat]].id
    const active = g.players.find((p) => p.id === activeId)!
    const bystander = net.players.find((p) => p.playerId !== activeId)!
    const actor = net.players.find((p) => p.playerId === activeId)!

    active.hand = ['boicote-1', 'boicote-2', 'confisco-geral-1', 'imposto-federal-1']
    g.resolution = { kind: 'card-discard', deckId: 'acaso', drawnId: 'imposto-federal-1' }

    const seenByBystander: unknown[] = []
    bystander.transport.onBroadcast((cmd) => {
      const a = cmd.action as { kind: string; cardId?: unknown }
      if (a.kind === 'discard-card') seenByBystander.push(a.cardId)
    })
    const seenByOwner: unknown[] = []
    actor.transport.onBroadcast((cmd) => {
      const a = cmd.action as { kind: string; cardId?: unknown }
      if (a.kind === 'discard-card') seenByOwner.push(a.cardId)
    })

    actor.client.send({ kind: 'discard-card', cardId: 'boicote-1', deck: 'acaso' })

    expect(seenByBystander.length).toBeGreaterThan(0)
    for (const cid of seenByBystander) expect(cid).toBeNull() // D10: quem não é o dono só vê null
    expect(seenByOwner).toContain('boicote-1') // o dono recebe a cópia privada, íntegra
  })
})
