// 058/US7 — o cronômetro do pregão.
//
// Relato da jogatina: "o cronômetro pareceu crescer conforme as pessoas davam lances e
// chegou a exibir uns 30 segundos". A janela do SRS §7.3 é de 24s por lote.
//
// São DOIS fatos, e só um é bug:
//   · a DURAÇÃO TOTAL do pregão crescer porque cada lance válido reinicia AQUELE lote em
//     24s é o soft-close previsto — não se mexe nele aqui;
//   · o NÚMERO EXIBIDO passar de 24s é defeito de sincronia, e é o que estes testes fecham.
//
// A causa: `lot.deadline` é epoch do HOST, e o pregão subtraía o `Date.now()` LOCAL sem
// corrigir o deslocamento de relógio — apesar de o comentário de topo do arquivo afirmar
// que corrigia. O leilão comum (`ModalLayer`) e a região viva já consumiam `clockOffsetMs`;
// o pregão foi o único que ficou de fora.
import { describe, it, expect } from 'vitest'
import { readLot, LAND_AUCTION_WINDOW_SECONDS } from '@/game/ui/landAuction/lotView'
import type { LandLot } from '@/game/economy/types'
import { LAND_AUCTION_WINDOW } from '@/game/economy/landAuction'

const HOST_NOW = 1_800_000_000_000

function lot(patch: Partial<LandLot> = {}): LandLot {
  return { pos: 1, currentBid: 0, highBidder: null, deadline: HOST_NOW + LAND_AUCTION_WINDOW, ...patch }
}

describe('cronômetro do lote (058/US7)', () => {
  it('mostra a janela cheia quando o relógio está alinhado', () => {
    const v = readLot(lot(), HOST_NOW, 'p1', 1000, 0)!
    expect(v.secs).toBe(LAND_AUCTION_WINDOW_SECONDS)
  })

  it('NUNCA passa da janela, por mais atrasado que o relógio do cliente esteja', () => {
    // O cliente acha que são 6s atrás do host: `deadline - now` daria 30s — o número exato
    // do relato. Corrigido pelo offset, dá 24; e o teto garante 24 mesmo se a amostra
    // de offset estiver ruim.
    for (const skewMs of [0, 1_000, 6_000, 60_000, 3_600_000]) {
      const v = readLot(lot(), HOST_NOW - skewMs, 'p1', 1000, 0)!
      expect(v.secs, `skew ${skewMs}ms`).toBeLessThanOrEqual(LAND_AUCTION_WINDOW_SECONDS)
      expect(v.frac, `skew ${skewMs}ms`).toBeLessThanOrEqual(1)
    }
  })

  it('nunca fica negativo nem retrocede além de zero depois do prazo vencido', () => {
    for (const skewMs of [1, 30_000, 600_000]) {
      const v = readLot(lot(), HOST_NOW + LAND_AUCTION_WINDOW + skewMs, 'p1', 1000, 0)!
      expect(v.secs).toBeGreaterThanOrEqual(0)
      expect(v.frac).toBeGreaterThanOrEqual(0)
      expect(v.encerrado).toBe(true)
    }
  })

  it('o prazo decorre monotonicamente entre a janela cheia e zero', () => {
    let anterior = Number.POSITIVE_INFINITY
    for (let decorrido = 0; decorrido <= LAND_AUCTION_WINDOW; decorrido += 1_000) {
      const v = readLot(lot(), HOST_NOW + decorrido, 'p1', 1000, 0)!
      expect(v.secs).toBeLessThanOrEqual(anterior)
      anterior = v.secs
    }
    expect(anterior).toBe(0)
  })

  it('o prazo é POR LOTE: ler um lote não depende do prazo do outro', () => {
    const recemReiniciado = readLot(lot({ pos: 1, deadline: HOST_NOW + LAND_AUCTION_WINDOW }), HOST_NOW, 'p1', 1000, 0)!
    const jaCorrendo = readLot(lot({ pos: 3, deadline: HOST_NOW + 5_000 }), HOST_NOW, 'p1', 1000, 0)!
    expect(recemReiniciado.secs).toBe(LAND_AUCTION_WINDOW_SECONDS)
    expect(jaCorrendo.secs).toBe(5)
  })
})
