// Tabela de aluguel do title deed — adaptador de view sobre a FONTE ÚNICA
// (`rentLadder`, 032): mapeia a escada do motor para o formato que os deeds desenham.
// Não recalcula nada — só delega, garantindo que UI e cobrança nunca divergem.
import { rentLadder } from '@/game/economy/rent'
import type { GroupKey } from '@/lib/boardData'

export function computeRents(group: GroupKey, base: number) {
  const l = rentLadder(group, base)
  return {
    base,
    house1: l.house[0],
    house2: l.house[1],
    house3: l.house[2],
    house4: l.house[3],
    hotel: l.hotel,
    hotel2: l.hotel2,
    skyscraper: l.skyscraper,
  }
}
