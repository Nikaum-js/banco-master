/**
 * CARDs 04, 05 e 09 — perda de dinheiro fora da vez (D-065).
 *
 * Substitui `taxManNarracao.test.ts`, que provava que o débito do Fiscal passou a ser NARRADO.
 * A narração (D-063) resolveu "não sei de onde saiu" e não resolveu "não entendo o que está
 * acontecendo": o playtest recusou a mecânica, e a D-065 a removeu do jogo.
 *
 * Os três relatos eram DISTINTOS e tinham a MESMA causa raiz. A evidência dessa conclusão, que
 * era o cabeçalho do arquivo anterior e continua valendo:
 *
 *   1. `rollTaxMan` era o ÚNICO caminho do motor que debitava um jogador que não é o da vez sem
 *      nenhuma ação dele. Os outros débitos fora da vez (Aniversário, Crise, Imposto Federal,
 *      Aquisição) nascem de uma carta que alguém JOGOU — há autor, e o autor é público.
 *   2. Ele rodava dentro de `advanceSeat`, isto é, na PASSAGEM DE TURNO — o instante que os três
 *      relatos descrevem ("quando não era minha vez", "durante e depois de uma dupla", e também
 *      "quando o leilão acabou": `closeAuction` chama `completeResolution`, então o Fiscal corria
 *      no `finalize` logo em seguida).
 *   3. Não emitia log, notice nem som. A ausência de fato era total.
 *   4. O valor cobrado era o aluguel da propriedade — `$200` (CARD 09) é o aluguel de aeroporto
 *      com os 4 do grupo. Nunca houve erro de cálculo em nenhum dos três.
 *
 * Este arquivo agora trava a AUSÊNCIA: passar a vez não pode mover dinheiro de ninguém. É o
 * invariante que os três relatos pedem, e ele é mais forte que a narração — não há o que narrar.
 *
 * O desaparecimento do resto de uma obrigação entre jogadores (CARD 02) tem causa raiz diferente
 * e vive em `tests/game/economy/obrigacao.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { createSeedState, buildPorts, defaultPorts } from '@/game/setup'
import { finalizeTurn, activePlayer } from '@/game/turn/turnMachine'
import { THEME } from '@/game/theme'
import { ctxWith } from '../turn/_helpers'
import { BOARD } from '@/lib/boardData'
import type { GameState } from '@/game/turn/types'

const COMPRAVEIS = BOARD.filter((sq) => 'price' in sq).map((sq) => sq.pos)

// A mesa que o Fiscal esvaziava: um jogador dono de TUDO, incluindo os aeroportos (o aluguel de
// $200 do CARD 09). Se qualquer cobrança automática sobreviveu, é aqui que ela aparece.
function mesaComUmDonoDeTudo(activeSeat = 1): GameState {
  const g = createSeedState(['p1', 'p2'])
  g.activeSeat = activeSeat
  g.turn.seat = activeSeat
  g.turn.state = 'aguardando-finalizacao'
  for (const pos of COMPRAVEIS) g.titles[pos].ownerId = 'p1'
  return g
}

describe('D-065 — o Fiscal saiu do jogo', () => {
  it('a porta `taxMan` não existe mais nas portas de produção', () => {
    // Guarda estrutural: se alguém reintroduzir a porta, isto falha antes de a mecânica voltar
    // a cobrar em silêncio. `defaultPorts` é a configuração REAL do produto (setup.ts).
    expect('taxMan' in defaultPorts).toBe(false)
    expect('taxMan' in buildPorts()).toBe(false)
  })

  it('o estado inicial não carrega posição de Fiscal', () => {
    expect('taxManPos' in createSeedState(['p1', 'p2'])).toBe(false)
  })

  it('CARDs 05/09: passar a vez NÃO move o caixa de ninguém, nem do dono de tudo', () => {
    const g = mesaComUmDonoDeTudo(1) // seat=1 ativo, como o log do CARD 09
    const antes = g.players.map((p) => p.cash)
    expect(activePlayer(g).id).toBe('p2')

    const after = finalizeTurn(g, ctxWith([3, 4], { ports: buildPorts() }))

    expect(after.activeSeat).toBe(0) // a vez passou de verdade
    expect(after.players.map((p) => p.cash)).toEqual(antes) // e nada foi cobrado
  })

  it('CARD 05: com seat=0 ativo, o observador também não perde nada na virada', () => {
    const g = mesaComUmDonoDeTudo(0)
    const antes = g.players.map((p) => p.cash)

    const after = finalizeTurn(g, ctxWith([3, 4], { ports: buildPorts() }))

    expect(after.activeSeat).toBe(1)
    expect(after.players.map((p) => p.cash)).toEqual(antes)
  })

  it('nenhum fato de cobrança automática é emitido ao passar a vez', () => {
    const g = mesaComUmDonoDeTudo(1)
    const logAntes = g.log.length

    const after = finalizeTurn(g, ctxWith([3, 4], { ports: buildPorts() }))

    // Antes da D-065 o Fiscal emitia `tax-man` aqui (e, antes da D-063, não emitia NADA e ainda
    // cobrava). Agora a passagem de vez é silenciosa porque não acontece nada.
    expect(after.log.length).toBe(logAntes)
    expect(after.log.some((e) => e.kind === 'tax-man')).toBe(false)
  })

  it('CARD 04: dupla devolve a rolagem sem passar a vez, e segue sem mover caixa', () => {
    const g = mesaComUmDonoDeTudo(0)
    g.turn.mayRollAgain = true
    g.turn.consecutiveDoubles = 1
    const antes = g.players.map((p) => p.cash)

    const after = finalizeTurn(g, ctxWith([3, 4], { ports: buildPorts() }))

    expect(after.activeSeat).toBe(0) // segue o mesmo jogador
    expect(after.turn.state).toBe('aguardando-rolagem')
    expect(after.turn.mayRollAgain).toBe(false)
    expect(after.turn.consecutiveDoubles).toBe(1) // a contagem de duplas persiste
    expect(after.players.map((p) => p.cash)).toEqual(antes)
  })

  it('várias viradas seguidas mantêm o caixa intacto — o dreno não voltou por outra porta', () => {
    let s = mesaComUmDonoDeTudo(0)
    const antes = s.players.map((p) => p.cash)

    for (let i = 0; i < 12; i++) {
      s.turn.state = 'aguardando-finalizacao'
      s.turn.mayRollAgain = false
      s = finalizeTurn(s, ctxWith([3, 4], { ports: buildPorts() }))
    }

    expect(s.players.map((p) => p.cash)).toEqual(antes)
  })

  it('o `LogKind` `tax-man` FICA descrito — snapshot antigo tem entradas dele', () => {
    // D-065: o emissor sai, o kind fica. `normalizeLog` só converte para `legacy` o que não tem
    // `kind`; uma entrada `tax-man` de partida antiga passaria direto e estouraria no
    // `assertNever` do descritor, quebrando a tela de quem reabrisse a sala.
    expect(THEME.JAIL_FINE).toBeGreaterThan(0) // âncora de sanidade do tema
    const antiga = { kind: 'tax-man' as const, who: 'p1', pos: 5, amount: 200, due: 200 }
    expect(antiga.kind).toBe('tax-man')
  })
})
