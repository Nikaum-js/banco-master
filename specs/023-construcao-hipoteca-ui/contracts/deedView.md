# Contrato — `deedView` + predicados puros (023)

## Predicados puros do motor (fonte única de regra)

Extraídos das guardas inline existentes; cada comando passa a delegar ao seu predicado. **Sem mudança de comportamento.**

```ts
// economy/construction.ts
export function canBuildHouse(state: GameState, pos: number): boolean
export function canSellBuilding(state: GameState, pos: number): boolean
export function canBuildHangar(state: GameState, pos: number): boolean
export function canSellHangar(state: GameState, pos: number): boolean
// economy/mortgage.ts
export function canMortgage(state: GameState, pos: number): boolean
export function canUnmortgage(state: GameState, pos: number): boolean
```

### Regras encapsuladas (espelho das guardas atuais)

- **canBuildHouse**: `canBuild(state,pos)` (dono ativo + maioria do grupo + nada hipotecado no grupo) **e** `cityLevel(pos) < 7` **e** `cityLevel(pos) === min(nível do grupo)` (uniformidade) **e** `cash ≥ buildCost` **e** estoque do banco do tipo do próximo nível (`houses`/`hotels`/`skyscrapers`) **e**, se alvo = arranha-céu (cur 6→7), grupo **completo**.
- **canSellBuilding**: `kind==='property'` + dono ativo + `cityLevel>0` + `cityLevel(pos) === max(nível do grupo)` (vende da de maior nível).
- **canBuildHangar**: `kind==='airport'` + dono ativo + não-hipotecado + sem hangar + `cash ≥ HANGAR_COST`.
- **canSellHangar**: `kind==='airport'` + dono ativo + com hangar.
- **canMortgage**: dono ativo + não-hipotecada + (cidade) sem construção no grupo (`groupHasConstruction` falso).
- **canUnmortgage**: dono ativo + hipotecada + `cash ≥ unmortgageCost`.

**Invariante (testável):** delegar não muda o resultado dos comandos → toda a suíte 004/005/011 segue verde após o refactor.

## `deedView(game: GameState, pos: number): DeedView | null`

Função **pura**. `null` se `BOARD[pos].kind` não for `property`/`airport`/`utility`.

### Mapeamento

| Campo | Origem |
|---|---|
| `owner` | `game.titles[pos].ownerId` |
| `ownedByActive` | `owner === game.players[turnOrder[activeSeat]].id` |
| `mortgaged` / `level` / `hangar` | `title.mortgaged` / `cityLevel(title)` / `title.hangar` |
| `price`/`buildCost`/`mortgageValue`/`unmortgageCost` | `BOARD[pos]` + `buildCost`/`mortgageValue`/`unmortgageCost` |
| `flags.podeConstruir` | `canBuildHouse(game,pos)` |
| `flags.podeVender` | `canSellBuilding(game,pos)` |
| `flags.podeConstruirHangar` | `canBuildHangar(game,pos)` |
| `flags.podeVenderHangar` | `canSellHangar(game,pos)` |
| `flags.podeHipotecar` | `canMortgage(game,pos)` |
| `flags.podeDeshipotecar` | `canUnmortgage(game,pos)` |
| `buildBlock` | quando `ownedByActive && property && !podeConstruir`: 1º motivo em {maioria, hipoteca-no-grupo, topo, uniformidade, grupo-incompleto, estoque, caixa}; senão `null` |

### Invariantes

- **Determinística** e **não-mutante** (só lê).
- Toda flag `true` ⇒ `ownedByActive === true` (gating por jogador da vez espelha o motor).
- `flags.podeX === canX(game,pos)` para cada ação (sem divergência UI↔motor).

## Comandos disparados pelos popovers (já existentes)

| Ação no popover | Habilitada por | Comando |
|---|---|---|
| Construir | `podeConstruir` | `buildHouse(pos)` |
| Vender | `podeVender` | `sellBuilding(pos)` |
| Construir Hangar | `podeConstruirHangar` | `buildHangar(pos)` |
| Vender Hangar | `podeVenderHangar` | `sellHangar(pos)` |
| Hipotecar | `podeHipotecar` | `mortgageProperty(pos)` |
| Deshipotecar | `podeDeshipotecar` | `unmortgageProperty(pos)` |

## Cobertura de teste (Vitest, `tests/game/ui/deedView.test.ts`) — SC-005

1. Dono ativo, maioria, cidade de menor nível, caixa+estoque → `podeConstruir=true`.
2. Cidade de nível maior que outra do grupo → `podeConstruir=false`, `buildBlock='uniformidade'`.
3. Banco sem estoque do tipo → `podeConstruir=false`, `buildBlock='estoque'`.
4. Alvo arranha-céu sem grupo completo → `false`, `buildBlock='grupo-incompleto'`.
5. Nível>0 na de maior nível → `podeVender=true`.
6. Cidade com construção no grupo → `podeHipotecar=false`.
7. Hipotecada sem caixa → `podeDeshipotecar=false`; com caixa → `true`.
8. Aeroporto próprio sem/with hangar → `podeConstruirHangar`/`podeVenderHangar`.
9. Propriedade de terceiro/livre → todas as flags `false`, `ownedByActive=false`.
