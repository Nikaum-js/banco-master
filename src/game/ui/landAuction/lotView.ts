// LEITURA DE UM LOTE DO PREGÃO — view-model puro (058/US7).
//
// Extraído do `LandAuctionLayer` por dois motivos, e o segundo é o que importa: exportar um
// não-componente de um arquivo de componente reabre o aviso de `react-refresh` que a sessão
// de 2026-07-25 zerou; e o defeito que esta extração conserta só é testável em node se a
// leitura do relógio não exigir montar React.
//
// ---------------------------------------------------------------------------------------
// O DEFEITO DO CRONÔMETRO
//
// `lot.deadline` é epoch do **host**. O pregão calculava `deadline - Date.now()` com o
// relógio LOCAL, sem corrigir o deslocamento — apesar de o comentário de topo do
// `LandAuctionLayer` afirmar, desde a 031, que o prazo era "corrigido pelo offset de relógio
// do host". Não era: `net/client.ts` estima `clockOffsetMs` a cada comando aceito,
// `roomStore` o publica, `ModalLayer` (leilão comum) e `LiveRegion` o consomem — o pregão
// foi o único que ficou de fora.
//
// Com o relógio do cliente N segundos atrás do host, o cronômetro exibia `24 + N`. Foi o que
// a jogatina viu como "cresceu até uns 30 segundos".
//
// A correção tem DUAS camadas, de propósito:
//   1. o chamador passa `now` já corrigido (`Date.now() + clockOffsetMs`);
//   2. o valor exibido é fechado dentro da janela aqui dentro.
//
// A segunda não é redundância: o offset é uma ESTIMATIVA por amostra, e um teto explícito é
// o que torna "nunca passa de 24s" uma propriedade do código em vez de uma consequência da
// qualidade da amostra.
//
// O QUE NÃO MUDA: um lance válido continua reiniciando o prazo daquele lote em 24s
// (SRS §7.3, soft-close). Isso é regra do motor (`placeLandBid`) e o motor não é tocado.
import type { LandLot } from '@/game/economy/types'
import { LAND_AUCTION_WINDOW } from '@/game/economy/landAuction'
import { type Square } from '@/lib/boardData'
import { deedPresentation } from '@/game/ui/deed/presentation'
import { countryName } from '@/boards/glyphs/countries'
import { activeBoard } from '@/game/ui/theme/boardTheme'

/** Teto do que o cronômetro pode exibir, em segundos. Deriva do tema, nunca de literal. */
export const LAND_AUCTION_WINDOW_SECONDS = Math.round(LAND_AUCTION_WINDOW / 1000)

const INCREMENTS = [10, 50, 100] as const
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export { INCREMENTS }

// --------------------------------------------------------------------------------------
// Leitura de um lote — tudo que os dois layouts precisam saber, derivado uma vez só.
// --------------------------------------------------------------------------------------
export interface LotView {
  lot: LandLot
  sq: Square
  name: string
  origem: string
  accent: string
  price: number
  secs: number
  frac: number
  urgente: boolean
  encerrado: boolean
  liderando: boolean
  /** Rótulo textual do estado. Nunca só cor: é ele que vai ao leitor de tela e ao chip. */
  estado: string
  cashAvail: number
  committed: number
  minimo: number
  podeMinimo: boolean
}

export function readLot(
  lot: LandLot,
  now: number,
  bidder: string,
  cash: number,
  committed: number,
): LotView | null {
  const sq = activeBoard()[lot.pos]
  const deed = deedPresentation(sq)
  if (!deed) return null
  // Fechado dentro de [0, janela]: o piso impede cronômetro negativo com relógio adiantado,
  // e o teto impede o "30 segundos" com relógio atrasado. Ver o bloco de topo.
  const remainingMs = Math.max(0, Math.min(LAND_AUCTION_WINDOW, lot.deadline - now))
  const encerrado = lot.deadline - now <= 0
  const liderando = lot.highBidder === bidder
  const cashAvail = cash - committed
  const minimo = lot.currentBid + INCREMENTS[0]
  return {
    lot,
    sq,
    name: deed.name,
    origem: deed.flagCode ? countryName(deed.flagCode) : (deed.subtitle ?? ''),
    accent: deed.accent,
    price: deed.price,
    secs: Math.ceil(remainingMs / 1000),
    frac: clamp01(remainingMs / LAND_AUCTION_WINDOW),
    // Alerta proporcional à janela, não um 3 fixo herdado dos 8s: um quarto do prazo é o
    // ponto em que "dá tempo de pensar" vira "decide agora", em qualquer janela que o tema
    // configure.
    urgente: remainingMs <= LAND_AUCTION_WINDOW * 0.25,
    encerrado,
    liderando,
    estado: encerrado
      ? (lot.highBidder ? 'Arrematado, fechando' : 'Sem lance, fica livre')
      : liderando ? 'Você lidera'
      : lot.highBidder ? 'Lance de rival'
      : 'Sem lance',
    cashAvail,
    committed,
    minimo,
    podeMinimo: minimo <= cashAvail && !encerrado,
  }
}
