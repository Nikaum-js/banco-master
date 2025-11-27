# Research: Construção avançada (2º hotel, Hangar, Skyscraper)

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION pendentes.

## R1 — Ladder de cidade estendido (0..7) e reuso de uniformidade

**Decisão**: `cityLevel(title)`: `skyscraper→7`, `hotel2→6`, `hotel→5`, senão `houses` (0–4). `buildHouse`/`sellBuilding` (004) passam a percorrer o ladder inteiro: construir no nível **mínimo** do grupo, vender do **máximo** (uniformidade existente). Os flags `hotel` permanecem `true` nos níveis 6/7 (2º hotel e Skyscraper são construídos sobre o hotel).

**Rationale**: reuso máximo do 004 (uniformidade, estoque, venda-a-metade). Manter `hotel=true` nos níveis superiores preserva `groupHasConstruction` (005) e a leitura de aluguel-com-hotel sem mudanças.

**Alternativas**: comandos separados `buildSecondHotel`/`buildSkyscraper` (rejeitado — duplicaria uniformidade/estoque; o store já chama `buildHouse(pos)` repetidamente para subir o nível).

## R2 — 2º hotel (§14)

**Decisão**: nível 5→6. Pré: `title.hotel && !title.hotel2`, `cityLevel==min` do grupo (todas as possuídas ≥ hotel), `bank.hotels ≥ 1`, caixa ≥ custo (= custo do hotel = `buildCost`). Efeito: `hotel2=true`, `bank.hotels-=1`. **Aluguel inalterado** (rentCity trata 2º hotel como hotel). Venda (6→5): `hotel2=false`, `bank.hotels+=1`, reembolso metade.

**Rationale**: §14 — o valor é a escassez no estoque de hotéis, não o aluguel. Grupo parcial é permitido (todas as possuídas com hotel), coerente com o 70% do 004.

## R3 — Hangar (§13.6)

**Decisão**: flag `hangar` em `Title` de aeroporto (fora do ladder de cidade). `buildHangar(state, pos)`: aeroporto do jogador ativo, **não** hipotecado, sem Hangar, caixa ≥ `HANGAR_COST` ($100 provisório) → `hangar=true`, debita $100. `sellHangar`: `hangar=false`, credita $50. Aluguel: `resolveRentable` dobra `rentAirport(count)` quando o aeroporto tem Hangar. Hipoteca/falência: o flag segue o aeroporto (sem aluguel se hipotecado; vai junto na falência).

**Rationale**: §13.6 — melhoria individual por aeroporto, vetor de progresso independente do gate de grupos. Comandos próprios porque aeroporto não está no ladder de cidade.

**Alternativas**: representar Hangar como "casa" no aeroporto (rejeitado — aeroporto não tem `houses`; flag é mais claro e serializável).

## R4 — Skyscraper (§13.7)

**Decisão**: nível 6→7. Pré: **grupo completo** (`groupOwnedCount == groupSize`), todas as cidades do grupo no nível 6 (2º hotel), `bank.skyscrapers ≥ 1`, caixa ≥ custo (= `buildCost` provisório, "igual ou superior ao 2º hotel"). Efeito: `skyscraper=true`, `bank.skyscrapers-=1` (**nada de hotéis volta** — clarify). Venda (7→6): `skyscraper=false`, `bank.skyscrapers+=1`, reembolso metade; **sem** mexer em `bank.hotels`/`bank.houses`.

**Rationale**: §13.7 + clarify (Skyscraper é marcador de topo). O gate de **grupo completo** distingue do build de casas (maioria, D-004) — é luxo de topo, não o caminho-base (princípio V intacto).

## R5 — Aluguel: Skyscraper fixo + ×3 de grupo (§13.7)

**Decisão**: `rentCity(base, ownedInGroup, size, build?, groupHasSkyscraper?)` (novos params **opcionais** → retrocompatível):
- `build?.skyscraper` → aluguel **fixo** = `base * SKYSCRAPER_RENT_MULT` (provisório 250; o maior da propriedade). Grupo é completo por pré-requisito.
- senão, cálculo atual (2º hotel = mesmo de hotel via `build.hotel`); então, se `groupHasSkyscraper` e não-Skyscraper → resultado **×3**.

`resolveRentable` calcula `groupHasSkyscraper = groupHasSkyscraper(state, square.group)` e passa, além de `{houses, hotel, hotel2, skyscraper}`.

**Rationale**: §13.7 — Skyscraper tem aluguel fixo alto; as demais do grupo triplicam enquanto houver Skyscraper. Params opcionais não quebram chamadas/tests existentes do `rentCity`.

**Alternativas**: tabela própria por propriedade (rejeitado nesta versão — provisório de tema; multiplicador fixo basta e é substituível).

## R6 — Aeroporto com Hangar no aluguel

**Decisão**: em `resolveRentable`, `amount = rentAirport(count) * (title.hangar ? 2 : 1)`. Hipotecado → sem aluguel (regra existente, antes do cálculo).

**Rationale**: §13.6 — dobra o aluguel **daquele** aeroporto; a base segue a contagem de aeroportos do dono (003).

## R7 — Falência e netWorth contam os novos níveis

**Decisão**: `declareBankruptcy` (008): ao limpar a propriedade, devolver `bank.hotels += 1` se `hotel2`, `bank.skyscrapers += 1` se `skyscraper` (além do hotel/casas atuais); `hangar` de aeroporto não tem estoque (segue o aeroporto). `liquidationValue` (008) e `netWorth` (006/`cards/effects`) somam o valor de venda do 2º hotel/Skyscraper/Hangar.

**Rationale**: consistência — sem isso, falência "perderia" peças do estoque e o netWorth subcontaria patrimônio (afetando GO progressivo/ranking e cartas baseadas em netWorth).

## R8 — Valores de tema provisórios

**Decisão**: `HANGAR_COST = 100` (SRS §13.6), Skyscraper custo = `buildCost(sq)` (igual ao nível, "≥ 2º hotel" satisfeito), `SKYSCRAPER_RENT_MULT = 250` (base×250, provisório, maior que hotel=100), `bank.skyscrapers = 4` (limite global provisório, recurso escasso).

**Rationale**: segue o padrão de provisório do 004/`boardData` (escada de preços, `buildCost=price/2`, mults de aluguel). O tema final substitui os números sem mudar a regra. Documentado para o tema "Cidades do Mundo".
