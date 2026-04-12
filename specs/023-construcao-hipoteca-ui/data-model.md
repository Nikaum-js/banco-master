# Data Model — UI de construção e hipoteca (023)

Nenhuma entidade do **motor** muda de forma. Introduz-se **um tipo de apresentação** (`DeedView`, somente-leitura) e **predicados puros** extraídos das guardas existentes.

## `DeedView` (novo — camada de UI)

`deedView(game, pos): DeedView | null` — `null` quando a casa não é gerenciável (não é property/airport/utility).

```ts
// src/game/ui/deed/deedView.ts
export interface DeedFlags {
  podeConstruir: boolean
  podeVender: boolean
  podeConstruirHangar: boolean
  podeVenderHangar: boolean
  podeHipotecar: boolean
  podeDeshipotecar: boolean
}

export type BuildBlock =
  | 'maioria'          // não tem a maioria do grupo
  | 'hipoteca-no-grupo'// alguma cidade do grupo hipotecada
  | 'uniformidade'     // existe cidade de nível menor no grupo (construa lá primeiro)
  | 'estoque'          // banco sem casa/hotel/arranha-céu do tipo necessário
  | 'grupo-incompleto' // arranha-céu exige grupo completo
  | 'caixa'            // sem caixa para o custo
  | 'topo'             // já é arranha-céu (nível máximo)
  | null               // pode construir (ou não-aplicável)

export interface DeedView {
  pos: number
  kind: 'property' | 'airport' | 'utility'
  owner: string | null        // null = livre
  ownedByActive: boolean       // dono === jogador da vez (habilita ações)
  mortgaged: boolean
  level: number                // cityLevel 0–7 (property); 0 p/ airport/utility
  hangar: boolean              // airport
  price: number
  buildCost: number            // property (custo de 1 nível)
  mortgageValue: number        // crédito ao hipotecar
  unmortgageCost: number       // custo de resgate (metade × 1,10)
  flags: DeedFlags
  buildBlock: BuildBlock       // motivo de "podeConstruir=false" (p/ a dica), quando aplicável
}
```

### Derivação (validação)

- `owner = game.titles[pos].ownerId`; `ownedByActive = owner === jogadorDaVez(game)`.
- Flags **só** podem ser `true` se `ownedByActive` (o motor gateia por `activePlayer`). Para livre/terceiro: todas `false`, `buildBlock = null`.
- Cada flag vem do predicado puro correspondente do motor (ver contrato): `podeConstruir = canBuildHouse(game,pos)`, etc.
- `buildBlock` é computado quando `ownedByActive && kind==='property' && !podeConstruir`, inspecionando as sub-condições na ordem: maioria → hipoteca-no-grupo → topo → uniformidade → grupo-incompleto → estoque → caixa.
- `level = cityLevel(title)`; `hangar = title.hangar`; `mortgaged = title.mortgaged`.
- Puro e somente-leitura: não muta `game`. Reconstruível do estado serializável.

## Predicados puros (motor — extraídos das guardas existentes)

Cada um encapsula a guarda que o comando correspondente já fazia inline; o **comando passa a delegar** (comportamento idêntico).

| Predicado | Arquivo | Encapsula a guarda de |
|---|---|---|
| `canBuildHouse(state, pos): boolean` | `economy/construction.ts` | `buildHouse` (canBuild + nível<7 + uniformidade-min + caixa + estoque + gate por nível + grupo completo p/ arranha-céu) |
| `canSellBuilding(state, pos): boolean` | `economy/construction.ts` | `sellBuilding` (property + dono + nível>0 + uniformidade-max) |
| `canBuildHangar(state, pos): boolean` | `economy/construction.ts` | `buildHangar` (airport + dono + não-hipotecado + sem hangar + caixa) |
| `canSellHangar(state, pos): boolean` | `economy/construction.ts` | `sellHangar` (airport + dono + com hangar) |
| `canMortgage(state, pos): boolean` | `economy/mortgage.ts` | `mortgageProperty` (dono + não-hipotecada + sem construção no grupo p/ cidade) |
| `canUnmortgage(state, pos): boolean` | `economy/mortgage.ts` | `unmortgageProperty` (dono + hipotecada + caixa p/ resgate) |

Invariante do refactor: para todo estado, `comando(state,pos) !== state` ⇔ `canX(state,pos) === true` (a menos de `paused`, já tratado no comando). Os testes 004/005/011 existentes validam que o comportamento não mudou.

## Entidades existentes (apenas consumidas/refatoradas)

- **`Title`** (`economy/types.ts`): `ownerId`, `houses`, `hotel`, `hotel2`, `skyscraper`, `hangar`, `mortgaged` — lido por `deedView`; **não** muda de forma.
- **Marcas do tabuleiro** `BuildingMark`/`MortgageMark` (`boards/shared.tsx`): passam a ler `game.titles[pos]` (estado real) em vez de `MOCK_BUILDINGS`/`MOCK_MORTGAGED`.
