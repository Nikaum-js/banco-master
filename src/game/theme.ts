// Tema "Cidades do Mundo" — fonte ÚNICA dos valores econômicos (018). Módulo folha: só
// constantes (importa apenas o TIPO GroupKey — sem runtime, sem ciclo). Calibrar o
// balanceamento = editar aqui. Preços/aluguéis-base por cidade vivem no board
// (`src/lib/boardData.ts`); estes são os multiplicadores/tiers e knobs globais. (SRS §3/§5/§13).
import type { GroupKey } from '@/lib/boardData'

export const THEME = {
  INITIAL_CASH: 2000, // SRS §3.1 (D-017: 1.500 → 2.000 com 48 casas)
  PARKING_SEED: 500, // pote do Free Parking — semente/reabastecimento (007/D-006)

  GO_PASS: 200, // passar pelo GO = $200; CAIR exatamente no GO = $400 (2×) — substitui o GO Progressivo

  // Custo de construção de casa — TIER FIXO por grupo (032/D-024). Não proporcional ao preço.
  // Sweet spot em orange/red: casa barata pro aluguel que rende.
  HOUSE_COST: {
    brown: 40, skyblue: 60, pink: 90, purple: 110, orange: 110,
    red: 130, yellow: 160, green: 200, navy: 240,
    platinum: 300, // Emirados (super-luxo) — tier mais caro (033)
  } satisfies Record<GroupKey, number>,

  // Multiplicadores de aluguel POR GRUPO (032/D-024) — base × mult. Curva clássica:
  // grupos baratos têm mult grande, caros pequeno (hotel-topo navy ~$1.800 vs brown ~$360).
  // [1ª..4ª casa], hotel, 2º hotel (>hotel), arranha-céu (topo).
  RENT_MULT: {
    brown:   { houses: [7, 18, 41, 51], hotel: 60, hotel2: 78, skyscraper: 96 },
    skyblue: { houses: [6, 16, 35, 44], hotel: 52, hotel2: 68, skyscraper: 83 },
    pink:    { houses: [5, 13, 30, 37], hotel: 44, hotel2: 57, skyscraper: 70 },
    purple:  { houses: [5, 13, 30, 37], hotel: 44, hotel2: 57, skyscraper: 70 },
    orange:  { houses: [5, 13, 30, 37], hotel: 44, hotel2: 57, skyscraper: 70 },
    red:     { houses: [5, 13, 29, 36], hotel: 42, hotel2: 55, skyscraper: 67 },
    yellow:  { houses: [5, 14, 31, 38], hotel: 45, hotel2: 59, skyscraper: 72 },
    green:   { houses: [5, 12, 28, 35], hotel: 41, hotel2: 53, skyscraper: 66 },
    navy:    { houses: [4, 11, 24, 31], hotel: 36, hotel2: 47, skyscraper: 58 },
    platinum: { houses: [4, 10, 22, 27], hotel: 32, hotel2: 42, skyscraper: 50 }, // Emirados (super-luxo): topo ~$1.900-2.300, ROI baixo (033)
  } satisfies Record<GroupKey, { houses: readonly [number, number, number, number]; hotel: number; hotel2: number; skyscraper: number }>,

  AIRPORT_RENT: [25, 50, 100, 200] as const, // por nº de aeroportos do dono (§2.4)
  UTILITY_MULT: [4, 10, 20] as const, // × valor dos dados, por nº de utilidades (§2.5)

  HANGAR_COST: 100, // melhoria de aeroporto (§13.6); venda = metade

  MORTGAGE_RATIO: 0.5, // hipoteca = metade do preço (§6.1)
  UNMORTGAGE_SURCHARGE: 0.1, // deshipoteca = hipoteca × (1 + surcharge) (§6.2)
  TRANSFER_FEE_RATIO: 0.1, // taxa de manter hipotecada na transferência (§6.3)

  JAIL_FINE: 50, // multa de prisão (§7)

  // Leilão de escassez de TERRENOS (031, §7.3): dispara quando restam ≤ este nº de
  // terrenos sem dono (e ≥2 vivos). Cada lote tem seu PRÓPRIO cronômetro (fecha sozinho).
  LAND_AUCTION_THRESHOLD: 3,
  LAND_AUCTION_SECONDS: 8, // janela por lote (reinicia só com lance NAQUELE lote)

  // D-003 (Speed Die) SUSPENSO pós-playtest: gerava confusão (3º dado + Mr.Banco/
  // Ônibus/Triple). false = jogo rola sempre 2 dados. Reversível: voltar a true
  // reativa o motor (código e testes do Speed Die preservados). Ver DECISIONS.
  SPEED_DIE_ENABLED: false,

  TAX: { renda: 200, luxo: 100 }, // referência (fonte ativa = `amount` das casas tax no board)
} as const
