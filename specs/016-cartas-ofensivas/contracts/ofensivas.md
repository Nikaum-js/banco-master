# Contract: Cartas ofensivas com alvo

## `cards/ofensivas.ts` (novo) — funções puras que MUTAM o clone, retornam `boolean`

### `acquire(state, attackerId: string, pos: number): boolean`

Gates (senão `false`): `BOARD[pos]` é propriedade; `ownerOf(pos)` existe e `≠ attackerId`; `cityLevel(t)===0` e `!t.hangar`; `nonMortgagedCount(owner) ≥ 2`; `!isTempImmune(state, pos)`; `attacker.cash ≥ preço + taxa`.
Aplica: `preço = round(price * (airport||utility ? 1.5 : 1))`; `taxa = t.mortgaged ? transferKeepFee(sq) : 0`; `attacker.cash -= preço + taxa`; `owner.cash += preço`; `t.ownerId = attackerId`.

### `evict(state, attackerId: string, pos: number): boolean`

Gates: `kind==='property'`; dono `≠ attacker`; `t.houses ≥ 1` e `!t.hotel`; `!isTempImmune(state, pos)`.
Aplica: `t.houses -= 1`; `state.bank.houses += 1`.

### `audit(state, attackerId: string, targetId: string, ports): boolean`

Gates: `targetId ≠ attackerId`; alvo existe e `!eliminated`.
Aplica: `owed = round(netWorth(state, targetId) * 0.10)`; `paid = min(target.cash, owed)`; `target.cash -= paid`; `ports.onPayToCenter(state, paid)`.

## `cards/draw.ts` — `playHandCard(state, playerId, cardId, ports, target?, targetPlayer?)`

Despacho (após gates de timing; clona, chama a função; se `false`, retorna `state`):

```ts
if (card.effect === 'aquisicaoHostil') { if (target==null) return state; const s=clone; return acquire(s,playerId,target) ? discardPlayed(s,...) : state }
if (card.effect === 'despejo')        { if (target==null) return state; const s=clone; return evict(s,playerId,target) ? discardPlayed(s,...) : state }
if (card.effect === 'auditoriaFiscal'){ if (targetPlayer==null) return state; const s=clone; return audit(s,playerId,targetPlayer,ports) ? discardPlayed(s,...) : state }
```

## `cards/catalog.ts`

`status: 'implementado'` para `aquisicao-hostil`, `despejo`, `auditoria-fiscal`.

## `store.ts`

`playHandCard(cardId: string, target?: number, targetPlayer?: string)` → `playHandCard(st.game, active, cardId, ports, target, targetPlayer)`.
