# Data Model — Sistema de Cartas (Fase 1)

Estende o estado da 005. Serializável (decks/mão = ids; contadores = números).

---

## Extensão de `GameState`

| Campo | Tipo | Notas |
|---|---|---|
| `decks` | `{ acaso: string[]; tesouro: string[] }` | **NOVO** — ids ordenados; topo = índice 0; semente embaralhada |

`resolution` ganha as variantes de carta (abaixo).

## Extensão de `Player`

| Campo | Tipo | Notas |
|---|---|---|
| `hand` | `string[]` | **NOVO** — ids de cartas de mão (≤ 3) |
| `busTickets` | number | **NOVO** — contador separado (concedido por Passagem de Ônibus; uso = spec Bus Tickets) |
| `nextPurchaseDiscount` | number | **NOVO** — 0 normal; 0,2 após Investidor Anjo (consumido na próxima compra) |

## Extensão de `ResolutionSlice`

```
| { kind: 'card-discard'; deckId: DeckId; drawnId: string }   // mão cheia: escolher descarte
| { kind: 'card-shortcut' }                                   // Atalho: escolher ±3
```

## Catálogo (dado estático — `catalog.ts`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | único (inclui sufixo p/ cópias, ex.: `aquisicao-hostil-1`) |
| `deck` | `'acaso' \| 'tesouro'` | |
| `rarity` | `'lendaria' \| 'rara' \| 'comum'` | cor: laranja/azul/verde |
| `mode` | `'imediato' \| 'mao'` | |
| `timing` | `'proprio-turno' \| 'reacao' \| 'preso' \| null` | só p/ `mao` |
| `effect` | `EffectId` | chave no registry de handlers |
| `status` | `'implementado' \| 'deferido'` | deferido → handler `noopDeferred` |

Composição por deck segue SRS §10.4-10.5 (16 + 16, com as cópias).

---

## Invariantes validáveis (viram testes)

1. Saque: tira do topo; imediata aplica + volta ao fundo; mão entra na mão. Deck nunca esgota.
2. Mão ≤ 3; sacar a 4ª de mão abre `card-discard` (escolher 1 das 4 → fundo).
3. Privacidade: a "visão pública" da mão é só `hand.length`.
4. Bus Ticket: `busTickets` não conta no limite 3; Passagem de Ônibus faz `+1`.
5. Efeitos autocontidos produzem o delta correto (caixa/movimento/desconto/ticket/deshipoteca).
6. Efeito de carta deferida = no-op + volta ao fundo.
7. `netWorth` = caixa + preços (hipotecada ÷2) + custos de construção.
8. "Saia da Prisão" (mão) integra com o turno de prisão do 002.
9. Round-trip JSON do `GameState` estendido preserva decks/mão/contadores.
