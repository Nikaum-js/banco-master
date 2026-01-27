# Data Model: Log de eventos real

## LogEntry (novo — `economy/types.ts`)

```ts
export interface LogEntry { who: string; what: string } // sem timestamp; recência = ordem
```

## GameState (modificado — `turn/types.ts`)

| Campo | Tipo | Regra |
|---|---|---|
| `log` | `LogEntry[]` | eventos; seed `[]`; **bounded em 50** (FIFO). Serializável. |

## `logEvent(state, who, what)` (`src/game/log.ts`)

`state.log.push({ who, what }); if (state.log.length > 50) state.log.shift()`. Muta o clone.

## Emissões (núcleo do turno)

roll · GO (+bônus) · compra · aluguel pago · imposto pago · pagar dívida · falência · saque (só o deck).

## Invariantes

- `log.length ≤ 50`.
- Saque nunca expõe a carta (só Acaso/Tesouro).
- Aditivo: asserções de teste field-level não quebram.
- Determinístico/serializável (princípio VII).
