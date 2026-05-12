# Contract — Construção (Fase 1)

Funções puras e comandos que a feature expõe, e como estende o aluguel da 003.

---

## 1. Funções puras (`construction.ts`)

```ts
// Pré-requisitos para construir no grupo de uma cidade (maioria, sem hipoteca).
canBuild(state, pos): boolean

// Próxima cidade válida do grupo para construir (a de menor contagem; uniformidade).
nextBuildTarget(state, group, ownerId): number | null

// Constrói 1 nível na cidade (casa, ou hotel se já tem 4 casas). Puro; no-op se inválido.
buildHouse(state, pos): GameState

// Vende 1 nível (hotel→4 casas ou desmonte forçado; casa→remove). Puro; no-op se inválido.
sellBuilding(state, pos): GameState
```

**Guardas de `buildHouse`** (mapeiam FRs):
- maioria do grupo + nenhuma hipotecada (FR-001) · uniformidade: só a de menor contagem (FR-003) · caixa ≥ custo (FR-004) · estoque disponível (FR-005) · turno do jogador ativo (FR-006).
- 4 casas → hotel: zera `houses`, seta `hotel`, **devolve 4 casas** e **consome 1 hotel** do `bank` (FR-002).

**`sellBuilding`** (FR-009/010/011): credita metade do custo; devolve a construção ao `bank`; hotel→4 casas (consome 4 do estoque) **ou**, se `bank.houses < 4`, **desmonta todos os hotéis do grupo** com crédito só das casas disponíveis (§5.5); respeita uniformidade.

## 2. Cálculo de aluguel (extensão de `rent.ts` da 003)

```ts
// rentCity passa a considerar construção ANTES do escalonamento por posse.
rentCity(square, title, ownedInGroup, groupSize): number
//  title.hotel || title.houses>0  → constructionRent(square, level) × (0.7 parcial | 1.0 completo)
//  senão                          → base / 150% / 200% (regra da 003)

constructionRent(square, level): number   // tabela provisória (tema) — research D3
```

## 3. Comandos (store)

| Comando | Pré-condição | Efeito |
|---|---|---|
| `buildHouse(pos)` | turno do ativo, dono da cidade | aplica `buildHouse` (no-op se inválido); se o pedido exceder `bank.houses` e houver interesse → abre `house-auction` |
| `sellBuilding(pos)` | turno do ativo, dono | aplica `sellBuilding` |
| `declareBuildInterest(playerId)` | `house-auction` aberto | adiciona aos `activeBidders` |
| `placeHouseBid(playerId, amount)` | `house-auction` | lance > atual, ≤ caixa; reinicia `deadline` |
| `closeHouseAuction()` | timer disparou | vencedor paga ao banco, recebe as casas; limpa o slice |

## 4. Portas

Reusa as portas da 003 (`onInsolvency` etc.). Sem portas novas obrigatórias. Custo/tabela de aluguel são **valores de tema** (provisórios no código), não portas.

## 5. Conformidade

- **Determinismo:** build/sell/rent puros; o único não-determinismo (fim do leilão de casas por tempo) isolado no timer do store, testado com fake timers.
- **Serialização:** `houses`/`hotel`/`bank`/`house-auction.deadline` são JSON puro.
- **Não-reabertura:** 002 (FSM) intacto; 003 recebe só adições em `rent.ts`/`resolveRentable.ts`/`types.ts`.
- **Fronteira:** 2º hotel, Skyscraper, Hangar, hipoteca-mutação e negociação **não** entram aqui.
