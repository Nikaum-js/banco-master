# Data Model: Cartas — efeitos temporários

## Entidades

### TempEffect (novo — `economy/types.ts`)

```ts
export interface TempEffect {
  kind: 'apagao' | 'greve' | 'boicote' | 'imunidade-temp'
  ownerId: string        // quem originou (clock da expiração: passagem dele pelo GO)
  pos: number | null     // propriedade (boicote/imunidade-temp) ou null (apagao/greve, board-wide)
  lapsRemaining: number  // voltas restantes (apagao/greve: 1; boicote/imunidade-temp: 2)
}
```

### GameState (modificado — `turn/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `tempEffects` | `TempEffect[]` | Efeitos temporários ativos. Seed `[]`. Serializável. Distinto de `immunities` (014). |

## Helpers (`economy/tempEffects.ts`)

| Função | Papel |
|---|---|
| `apagaoActive(state)` | há efeito `apagao`? |
| `greveActive(state)` | há efeito `greve`? |
| `isBoycotted(state, pos)` | há `boicote` naquela propriedade? |
| `isTempImmune(state, pos)` | há `imunidade-temp` naquela propriedade? |
| `addTempEffect(state, e)` | registra (push) |
| `tickTempEffects(state, ownerId)` | decrementa os do `ownerId`; remove `≤ 0` |

## Transições

```text
Sacar Apagão  (imediato) → addTempEffect { apagao,  owner=sacador, pos:null, laps:1 }
Sacar Greve   (imediato) → addTempEffect { greve,   owner=sacador, pos:null, laps:1 }
Jogar Boicote (mão+alvo) → [alvo de outro, não imune] addTempEffect { boicote, owner=jogador, pos:alvo, laps:2 }
Jogar Imunid. (mão+alvo) → [alvo próprio] addTempEffect { imunidade-temp, owner=jogador, pos:alvo, laps:2 }

afterPassGo(ownerId) → chargeLoanInterest + tickImmunities + tickTempEffects(ownerId)
```

## Aplicação no aluguel (resolveRentable + taxMan)

| Condição | Efeito |
|---|---|
| `isBoycotted(pos)` | aluguel **$0** (ninguém paga) |
| utilidade + `greveActive` | aluguel **$0** |
| aeroporto + `apagaoActive` | sem dobra do Hangar (×1) |
| `isTempImmune(pos)` | bloqueia **Boicote** sobre `pos` (e ofensivas no 016) |

## Invariantes

- `lapsRemaining` decrementa só no GO do `ownerId`; removido em 0.
- `tempEffects` separado de `immunities` (014) — semânticas distintas.
- Boicote só sobre propriedade de outro, não imune; Imunidade Temporária só sobre própria.
- Tax Man e aluguel normal aplicam os mesmos efeitos (consistência).
- Estado JSON puro/serializável (princípio VII).
