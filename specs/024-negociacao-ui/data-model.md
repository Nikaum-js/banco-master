# Data Model — Negociação na UI (024)

Acrescenta **um campo** ao `GameState` e **move** os tipos de troca para o módulo de tipos compartilhado (sem mudar a forma). Predicado + reducers puros novos.

## Tipos de troca (movidos para `economy/types.ts`)

`Trade` e `ImmunityGrant` saem de `economy/trade.ts` para `economy/types.ts` (que `turn/types.ts` já importa) — assim o `GameState` pode referenciá-los sem ciclo. **A forma não muda:**

```ts
// economy/types.ts (movidos; idênticos)
export interface ImmunityGrant { pos: number; laps: number | null }
export interface Trade {
  fromId: string
  toId: string
  fromProps: number[]
  fromCash: number
  toProps: number[]
  toCash: number
  fromImmunities?: ImmunityGrant[]
  toImmunities?: ImmunityGrant[]
}
```

`trade.ts` passa a `import type { Trade, ImmunityGrant } from './types'`.

## `GameState.pendingTrade` (novo campo)

```ts
// turn/types.ts
pendingTrade: Trade | null // 024 — proposta pendente (uma por vez); null = nenhuma
```

- Seed em `createSeedState`: `pendingTrade: null`.
- Serializável (princípio VII) — sobrevive a recarga/reconexão.
- **Não** é uma `resolution` de turno: não bloqueia o jogador da vez.

## Predicado + reducers (motor — puros)

```ts
// economy/trade.ts
export function validateTrade(state: GameState, trade: Trade): boolean // guarda extraída de executeTrade
export function tradableProps(state: GameState, ownerId: string): number[] // props do dono SEM construção
export function proposeTrade(state: GameState, trade: Trade): GameState   // grava pendente se válida e não há outra
export function acceptTrade(state: GameState): GameState                  // executa se ainda válida; limpa
export function rejectTrade(state: GameState): GameState                  // limpa a pendente
```

### Regras de derivação (validação)

- **validateTrade** (espelha as guardas atuais do `executeTrade`): `fromId !== toId`; ambos existem e não-eliminados; `fromCash`/`toCash` inteiros ≥ 0; `from` possui todas as `fromProps` **sem construção** e `to` possui todas as `toProps` **sem construção**; `from.cash ≥ fromCash` e `to.cash ≥ toCash`; imunidades válidas (§8.4: própria, mantida — não na lista oferecida —, `laps` null ou inteiro > 0); e as taxas de 10% das hipotecadas recebidas **não** deixam nenhum saldo final negativo.
- **proposeTrade**: se `state.pendingTrade !== null` → no-op (uma por vez). Se `!validateTrade` → no-op. Senão clona e seta `pendingTrade = trade`.
- **acceptTrade**: se `pendingTrade === null` → no-op. Se `!validateTrade(state, pendingTrade)` → no-op (proposta obsoleta; pode ser recusada). Senão: `executeTrade(state, pendingTrade)` e, no resultado, `pendingTrade = null`.
- **rejectTrade**: se `pendingTrade === null` → no-op; senão clona e `pendingTrade = null`.
- **tradableProps**: posições de `property`/`airport`/`utility` cujo `ownerId === ownerId` e (cidade) `cityLevel === 0`. Usado pelos seletores do compositor; imunidades concedíveis = próprias **não** incluídas nas props oferecidas.
- Todos **puros**; `pendingTrade` só muda via esses reducers.

### Limpeza por eliminação

- Se a proposta pendente envolve um jogador que foi eliminado (proponente ou destinatário), ela deixa de ser válida (`validateTrade` falha por jogador eliminado) → `acceptTrade` vira no-op; a UI permite recusar. (MVP: não há limpeza automática proativa; a invalidez já protege contra troca indevida.)

## Entidades existentes (consumidas/refatoradas)

- **`executeTrade`** (013): inalterado no comportamento; passa a delegar a `validateTrade` para a guarda.
- **Imunidade** (014): criada pela troca aceita (`fromImmunities`/`toImmunities` → `state.immunities`), já implementado em `executeTrade`.
- **Título / Player.cash**: transferidos pela troca aceita (já implementado).
