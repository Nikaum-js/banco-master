# Data Model: Tema "Cidades do Mundo"

**Sem estado novo no `GameState`.** Esta feature centraliza constantes (compile-time) e ajusta dados estáticos do board.

## `theme.ts` (knobs do tema — fonte única)

| Constante | Valor (oficial, tunável) | Consumidor |
|---|---|---|
| `INITIAL_CASH` | 2000 | `store` (seed `cash`) |
| `BANK` | `{ houses:40, hotels:16, skyscrapers:4 }` | `store` (seed `bank`) |
| `PARKING_SEED` | 500 | `balancing` (`centerPot`/coleta) |
| `GO_BONUS` | `{ min:100, max:400 }` | `balancing.goBonus` |
| `HOUSE_RENT_MULT` | `[5,15,45,80]` | `rent.rentCity` |
| `HOTEL_RENT_MULT` | 100 | `rent.rentCity` (hotel/2º hotel) |
| `SKYSCRAPER_RENT_MULT` | 250 | `rent.rentCity` |
| `AIRPORT_RENT` | `[25,50,100,200]` | `rent.rentAirport` |
| `UTILITY_MULT` | `[4,10,20]` | `rent.rentUtility` |
| `HANGAR_COST` | 100 | `construction` |
| `BUILD_COST_RATIO` | 0.5 | `construction.buildCost` (`round(price·ratio)`) |
| `MORTGAGE_RATIO` | 0.5 | `mortgage.mortgageValue` |
| `UNMORTGAGE_SURCHARGE` | 0.1 | `mortgage.unmortgageCost` |
| `TRANSFER_FEE_RATIO` | 0.1 | `mortgage.transferKeepFee` |
| `JAIL_FINE` | 50 | `turnMachine` |
| `TAX` (ref.) | `{ renda:200, luxo:100 }` | documentação (fonte ativa = `boardData.amount`) |

## Board (`boardData`) — dados estáticos

- 28 cidades: `price`/`rent` (base) por grupo (escada $60–400). **Inalterados.**
- 4 aeroportos: `iata` preservado; `name` → **nome próprio** (sem colidir com cidades). `rent` é decorativo (aluguel vem de `AIRPORT_RENT`).
- 3 utilidades, 2 impostos (`amount`), cantos, cartas, Bus Ticket. **Inalterados.**
- Comentário do cabeçalho: "PROVISÓRIA" → valores oficiais do tema (tunáveis em `theme.ts`).

## Invariantes

- **Valores observáveis idênticos** após a centralização (suíte 002–017 verde sem edição).
- Exports atuais dos módulos preservados (importadores intactos).
- 0 nomes de casa duplicados no `BOARD`.
- `theme.ts` é folha (não importa módulos do jogo) → sem ciclos.
- Snapshot serializável inalterado (constantes não entram no estado).
