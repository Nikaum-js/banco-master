// Tema "Cidades do Mundo" — fonte ÚNICA dos valores econômicos (018). Módulo folha: só
// constantes, não importa nada do jogo (evita ciclos). Calibrar o balanceamento = editar aqui.
// Os preços/aluguéis-base por cidade vivem no board (`src/lib/boardData.ts`); estes são os
// multiplicadores e knobs globais do tema. Tunável após playtest (SRS §3/§5/§13).
export const THEME = {
  INITIAL_CASH: 2000, // SRS §3.1 (D-017: 1.500 → 2.000 com 48 casas)
  PARKING_SEED: 500, // pote do Free Parking — semente/reabastecimento (007/D-006)

  GO_PASS: 200, // passar pelo GO = $200; CAIR exatamente no GO = $400 (2×) — substitui o GO Progressivo

  HOUSE_RENT_MULT: [5, 15, 45, 80] as const, // aluguel = base × mult (1..4 casas)
  HOTEL_RENT_MULT: 100, // 1º hotel
  HOTEL2_RENT_MULT: 175, // 2º hotel — cobra MAIS que o 1º (§14.4); degrau real, não escassez
  SKYSCRAPER_RENT_MULT: 250, // Skyscraper — aluguel fixo, o maior da propriedade (011/§13.7)

  AIRPORT_RENT: [25, 50, 100, 200] as const, // por nº de aeroportos do dono (§2.4)
  UTILITY_MULT: [4, 10, 20] as const, // × valor dos dados, por nº de utilidades (§2.5)

  HANGAR_COST: 100, // melhoria de aeroporto (§13.6); venda = metade
  BUILD_COST_RATIO: 0.5, // custo de construção = round(preço × ratio)

  MORTGAGE_RATIO: 0.5, // hipoteca = metade do preço (§6.1)
  UNMORTGAGE_SURCHARGE: 0.1, // deshipoteca = hipoteca × (1 + surcharge) (§6.2)
  TRANSFER_FEE_RATIO: 0.1, // taxa de manter hipotecada na transferência (§6.3)

  JAIL_FINE: 50, // multa de prisão (§7)

  // D-003 (Speed Die) SUSPENSO pós-playtest: gerava confusão (3º dado + Mr.Banco/
  // Ônibus/Triple). false = jogo rola sempre 2 dados. Reversível: voltar a true
  // reativa o motor (código e testes do Speed Die preservados). Ver DECISIONS.
  SPEED_DIE_ENABLED: false,

  TAX: { renda: 200, luxo: 100 }, // referência (fonte ativa = `amount` das casas tax no board)
} as const
