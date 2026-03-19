# Data Model: Cartas de reação

## ResolutionSlice (estendido — `economy/types.ts`)

```ts
| { kind: 'reaction-diplomacia'; reactorId: string; attackerId: string; effect: string;
    cardId: string; deck: DeckId; targetPos: number | null; targetPlayer: string | null }
| { kind: 'reaction-bunker'; reactorId: string; amount: number }
```

Sem outro campo novo no `GameState` (a ofensiva "em voo" mora na variante `reaction-diplomacia`).

## Funções (`cards/reacao.ts`)

| Função | Papel |
|---|---|
| `findReactionCard(state, playerId, effect)` | id da carta na mão com `effect` ('diplomacia'/'bunkerFiscal'), ou undefined |
| `reactorFor(state, effect, attackerId, targetPos, targetPlayer)` | id do reator **se a ofensiva é válida** (usa `canAcquire/canEvict/canAudit` + gate do Boicote); senão `null` |
| `applyOffensive(state, effect, attackerId, targetPos, targetPlayer, ports)` | aplica o efeito (recusa) — acquire/evict/audit/boicote |
| `taxBunkerResolve(rctx)` | imposto + jogador com Bunker → abre `reaction-bunker`; senão `null` |
| `respondReaction(state, use, ports)` | resolve a reação pendente |

## Transições

```text
playHandCard(ofensiva, alvo):
  r = reactorFor(...)
  se r != null E findReactionCard(r, 'diplomacia'):
     resolution = reaction-diplomacia{ reactorId:r, attackerId, effect, cardId, deck, targetPos, targetPlayer }
     remove a ofensiva da mão do atacante (em voo)
  senão: applyOffensive(...) (ou no-op se inválida)

resolvePending(casa tax):  ctx.resolve → taxBunkerResolve:
  se holds Bunker: resolution = reaction-bunker{ reactorId, amount }
  senão: null → handler default de imposto (002/007)

respondReaction(use):
  reaction-diplomacia, use      → recicla Diplomacia + ofensiva; sem efeito; completeResolution
  reaction-diplomacia, !use     → applyOffensive; recicla ofensiva; completeResolution
  reaction-bunker, use          → recicla Bunker; sem cobrança; completeResolution
  reaction-bunker, !use         → cobra imposto (ou abre dívida 008 se faltar caixa)
```

## Invariantes

- A carta ofensiva é **sempre** reciclada (gasta) ao resolver a reação — qualquer ramo.
- Reação só abre para jogada **válida** (reactorFor) — não consome carta à toa.
- Reação bloqueia finalizar até `respondReaction` (reusa gating de `resolution`).
- Sem Diplomacia/Bunker, ofensiva/imposto aplicam **direto** (015/016/002 inalterados).
- Privacidade: o atacante não sabe da Diplomacia até o uso (princípio VI).
- Estado JSON puro/serializável; sem timers no motor (princípio VII).
