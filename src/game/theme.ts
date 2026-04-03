// Tema "Cidades do Mundo" — fonte ÚNICA dos valores econômicos (018). Módulo folha: só
// constantes (importa apenas o TIPO GroupKey — sem runtime, sem ciclo). Calibrar o
// balanceamento = editar aqui. Preços/aluguéis-base por cidade vivem no board
// (`src/lib/boardData.ts`); estes são os multiplicadores/tiers e knobs globais. (SRS §3/§5/§13).
import type { GroupKey } from '@/lib/boardData'

export const THEME = {
  // D-076 — a mesa de 3 jogadores tem de conseguir COMPRAR o tabuleiro na largada. Com $2.000 ela
  // cobria 70% do Atlas e 62% da Fuligem: a primeira volta acabava com metade das casas sem dono,
  // e o jogo virava fila de leilão antes de virar jogo. $3.000 põe 3 jogadores em ~101%/107% e 4 em
  // ~135%/142% — o excedente do quarto assento é o que financia construção, que é onde o jogo mora.
  INITIAL_CASH: 3000, // SRS §3.1 (D-017: 1.500 → 2.000 com 48 casas; D-076: → 3.000)
  PARKING_SEED: 750, // pote do Free Parking — semente/reabastecimento (007/D-006; D-076 acompanha a escala)

  // $250 ao passar; $500 ao CAIR exatamente no GO (2×). A subida (D-076) é sobre RENDA POR TURNO,
  // não por volta: o Atlas tem 48 casas, então uma volta custa ~6,9 turnos contra os ~5,7 de um
  // tabuleiro de 40 — a $200 ele pagava $29/turno, um terço abaixo do padrão do gênero. A Fuligem,
  // com 40 casas, recebe $44/turno, sustentando o prêmio de ~10% dentro de cada tier equivalente.
  GO_PASS: 250,

  // Custo BASE de construção — TIER por grupo (032/D-024). Não proporcional ao preço.
  // Sweet spot em orange/red: casa barata pro aluguel que rende.
  // É o custo do NÍVEL 1; os demais escalam por `BUILD_LEVEL_MULT` (D-081).
  HOUSE_COST: {
    brown: 40, skyblue: 60, pink: 90, purple: 110, orange: 110,
    red: 130, yellow: 160, green: 200, navy: 240,
    platinum: 300, // Emirados (super-luxo) — tier mais caro (033)
  } satisfies Record<GroupKey, number>,

  // Custo POR NÍVEL da escada, como multiplicador sobre HOUSE_COST (D-081). Índice 0 = 1ª casa,
  // índice 6 = arranha-céu.
  //
  // Era FLAT: os sete níveis custavam o tier do grupo. Com a escada de 7 níveis (011) e o
  // aluguel superlinear, isso invertia a curva de retorno — o topo virava o melhor negócio do
  // tabuleiro. No laranja, o arranha-céu custava $110 e acrescentava $286 de aluguel por batida
  // (ROI marginal 2,6x), enquanto a 1ª casa rendia 0,6x. Um país completo no topo se pagava em
  // 1,9 visitas de adversário. A D-076 tinha piorado isso sem tocar aqui: subir o caixa inicial
  // 2.000 → 3.000 barateou construir ~33% em termos reais, da noite pro dia.
  //
  // A curva agora tem retorno DECRESCENTE no topo, que é onde a decisão precisa doer:
  //  - níveis 1–2 intactos — a entrada continua barata, ninguém trava fora do jogo;
  //  - a 3ª casa segue o sweet spot do gênero (ROI ~2,7x no laranja), de propósito;
  //  - hotel/2º hotel/arranha caem pra 0,5–1,0x de ROI imediato: viram investimento de longo
  //    prazo, não lucro automático. O arranha-céu continua valendo muito porque triplica o
  //    aluguel das outras cidades do país (§13.7) — bônus que não entra nessa conta.
  // Efeito agregado: payback do país completo no topo vai de ~1,9 para ~3,3 visitas.
  BUILD_LEVEL_MULT: [1, 1, 1.25, 1.5, 2, 2.5, 3] as const,

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

  AIRPORT_RENT: [30, 60, 125, 250] as const, // por nº de aeroportos do dono (§2.4; D-076 acompanha o preço 200 → 250)
  UTILITY_MULT: [4, 10, 20] as const, // × valor dos dados, por nº de utilidades (§2.5)

  // MINAS (D-071, mapa Fuligem) — títulos sem aluguel. O valor vem exclusivamente do
  // bônus passivo de cada metal: qual delas vale mais depende da carteira do dono.
  //
  // Fatores como multiplicador direto (1.5 = +50%). O ferro é o único que age no CUSTO e
  // não no aluguel, por isso é < 1.
  // O cobre MUDOU DE ALVO em relação ao desenho original: ele dobrava o aluguel das
  // utilidades, mas as minas entraram por TROCA e as utilidades saíram do mapa Fuligem —
  // um passivo sem alvo é um passivo morto. Agora ele age em propriedades construídas.
  // O estanho, por sua vez, reduz as duas cobranças econômicas que mais pressionam caixa:
  // impostos e aluguéis pagos.
  MINE_BONUS: {
    ferro: 0.75, // suas construções custam 25% menos — a estrutura é do seu ferro
    carvao: 1.5, // aluguel das SUAS ferrovias +50% — a locomotiva queima seu carvão
    cobre: 1.25, // aluguel das propriedades com QUALQUER construção +25%
    estanho: 0.85, // impostos e aluguéis que VOCÊ paga −15%
  } as const,

  HANGAR_COST: 125, // melhoria de aeroporto (§13.6); venda = metade

  MORTGAGE_RATIO: 0.5, // hipoteca = metade do preço (§6.1)
  UNMORTGAGE_SURCHARGE: 0.1, // deshipoteca = hipoteca × (1 + surcharge) (§6.2)
  TRANSFER_FEE_RATIO: 0.1, // taxa de manter hipotecada na transferência (§6.3)

  JAIL_FINE: 50, // multa de prisão (§7)

  // Pregão simultâneo (§7.3) — DUAS procedências: escassez de terrenos (§7.5) e espólio do
  // falido (§9.2). Cada lote tem seu PRÓPRIO cronômetro e fecha sozinho.
  // 6, não 3 (D-078): a ≤3 o pregão chegava quando a partida já estava decidida — três lotes
  // num tabuleiro de 35 (Atlas) ou 30 (Fuligem) é 9% do inventário, e o resto do jogo já tinha
  // acontecido esperando alguém CAIR neles. Seis é o ponto em que ainda há tabuleiro para
  // disputar e o evento coletivo vira clímax em vez de formalidade.
  LAND_AUCTION_THRESHOLD: 6, // escassez: dispara quando restam ≤ este nº de terrenos sem dono (e ≥2 vivos)
  // 24s, não 8s (D-060): oito segundos é menos que o tempo de ler o nome da cidade, achá-la no
  // tabuleiro e conferir o próprio caixa — o jogador não decidia, reagia. Foi a queixa que
  // motivou a D-059 a remover o mecanismo inteiro; a D-060 o traz de volta consertando ISTO.
  LAND_AUCTION_SECONDS: 24, // janela por lote (reinicia só com lance NAQUELE lote)

  // D-003 (Speed Die) SUSPENSO pós-playtest: gerava confusão (3º dado + Mr.Magnata/
  // Ônibus/Triple). false = jogo rola sempre 2 dados. Reversível: voltar a true
  // reativa o motor (código e testes do Speed Die preservados). Ver DECISIONS.
  SPEED_DIE_ENABLED: false,

  TAX: { renda: 250, luxo: 150 }, // referência (fonte ativa = `amount` das casas tax no board)
} as const
