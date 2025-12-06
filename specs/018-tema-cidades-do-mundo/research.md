# Research: Tema "Cidades do Mundo" — valores oficiais

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION.

## R1 — `theme.ts` como fonte única (folha)

**Decisão**: `src/game/theme.ts` exporta um objeto/constantes com todos os knobs econômicos:
`INITIAL_CASH=2000`, `BANK={houses:40,hotels:16,skyscrapers:4}`, `PARKING_SEED=500`, `GO_BONUS={min:100,max:400}`, `HOUSE_RENT_MULT=[5,15,45,80]`, `HOTEL_RENT_MULT=100`, `SKYSCRAPER_RENT_MULT=250`, `AIRPORT_RENT=[25,50,100,200]`, `UTILITY_MULT=[4,10,20]`, `HANGAR_COST=100`, `BUILD_COST_RATIO=0.5`, `MORTGAGE_RATIO=0.5`, `UNMORTGAGE_SURCHARGE=0.1`, `TRANSFER_FEE_RATIO=0.1`, `JAIL_FINE=50`, `TAX={renda:200,luxo:100}`.

**Rationale**: um lugar para calibrar (o sentido de "oficializar o tema, tunável"). Folha (sem importar módulos do jogo) → sem ciclo; todos podem importar.

## R2 — Módulos derivam, exports preservados (zero regressão)

**Decisão**: cada módulo mantém seu **export atual**, agora derivado de `theme.ts`:
- `construction.ts`: `export const HANGAR_COST = THEME.HANGAR_COST`; `buildCost = round(price * THEME.BUILD_COST_RATIO)`.
- `balancing.ts`: `export const PARKING_SEED = THEME.PARKING_SEED`; `goBonus` usa `THEME.GO_BONUS`.
- `turnMachine.ts`: `export const JAIL_FINE = THEME.JAIL_FINE`.
- `rent.ts`: consts internas = `THEME.*`.
- `mortgage.ts`: razões de `THEME`.
- `store.ts`: `cash`, `bank`, `centerPot` (seed) de `THEME`.

**Rationale**: preservar os nomes/exports evita tocar nos importadores (`effects`/`falencia`/`taxMan`/testes). Valores idênticos ⇒ **a suíte 002–017 passa sem edição** = prova de não-regressão (SC-002).

## R3 — Tax amounts e seed do board

**Decisão**: os valores de imposto vivem no `boardData` (campo `amount` das casas `tax`); referenciados em `theme.ts` como `TAX={renda,luxo}` para documentação/calibração, mas a **fonte** continua o `boardData` (o handler de imposto lê `square.amount`). Para evitar duplicação divergente, `theme.ts` apenas documenta; não duplico a fonte do `amount`.

**Rationale**: o imposto é por-casa (no board), não um knob global; centralizá-lo duplicaria a fonte. `theme.ts` documenta o valor de referência sem ser a fonte ativa.

## R4 — Polimento: nomes de aeroporto únicos

**Decisão**: renomear os 4 aeroportos para nomes próprios de aeroporto (IATA preservado), removendo as colisões "Nova York" (pos 6 vs cidade pos 37) e "Tóquio" (pos 30 vs cidade pos 13). Ex.: JFK→"Aeroporto JFK", LHR→"Aeroporto Heathrow", NRT→"Aeroporto Narita", SYD→"Aeroporto de Sydney".

**Rationale**: um tema final não deve ter casas homônimas. Não afeta valores nem testes (nenhum teste lê `name`).

## R5 — Sem rebalanceamento nesta entrega

**Decisão**: a centralização **preserva** os números atuais. Ajustes de balanceamento de verdade (mudar mults/preços) ficam como tuning futuro no `theme.ts` (agora trivial num ponto só).

**Rationale**: não há tabela-alvo no SRS (tunável pós-playtest); mudar números agora geraria churn de testes sem critério objetivo. Oficializar ≠ rebalancear. A infra de tuning (theme.ts) é o entregável durável.

## R6 — `docs/TEMA.md`

**Decisão**: ficha de referência do tema: a tabela de cidades (preço/aluguel-base por grupo), aeroportos, utilidades, impostos, e a tabela de knobs do `theme.ts`.

**Rationale**: a "ficha do tema" que o SRS §5.2 menciona; ponto de consulta para calibração e para futuros temas.
