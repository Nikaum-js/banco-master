# Contrato — Painel "Minhas Cartas" (029)

## Seletores puros (`src/game/ui/cards/handView.ts`)

### `handCardsView(game, playerId): HandCardView[]`

Mapeia cada id de `player.hand` para `{ id, effect, label, desc, rarityColor, timing, needsTarget, playable, reason? }`.

| Situação | `playable` | `reason` |
|---|---|---|
| `timing 'reacao'` (Diplomacia/Bunker) | false | "Carta de reação — usada automaticamente quando aplicável" |
| `timing 'proprio-turno'`, não é a vez de `playerId` | false | "Só no seu turno" |
| `timing 'preso'`, jogador não preso | false | "Só quando preso" |
| carta de alvo sem alvo válido | false | "Sem alvo válido" |
| caso contrário | true | — |

### `cardTargets(game, playerId, cardId): CardTargets | null`

| Efeito | Retorno |
|---|---|
| `aquisicaoHostil` | `{ positions }` = posições com `reactorFor(...,'aquisicaoHostil',...) !== null` |
| `despejo` | `{ positions }` via `reactorFor(...,'despejo',...)` |
| `boicote` | `{ positions }` via `reactorFor(...,'boicote',...)` |
| `auditoriaFiscal` | `{ players }` = adversários com `canAudit` |
| `imunidade` | `{ positions }` = propriedades onde `ownerOf === playerId` |
| outro (sem alvo) | `null` |

**Invariante**: um alvo só é oferecido se `playHandCard` o aceitaria (mesma fonte: `reactorFor`/`canAudit`/dono). Sem divergência UI×motor.

## UI

- **HandPanel** (painel lateral): para cada `HandCardView`, cartão com cor de raridade + nome + efeito; contador "X / 3"; botão "Usar" (`disabled = !playable`, `title = reason`). Sem alvo → `playHandCard(id)`. Com alvo → `useHandCardUI.open(id)`.
- **HandCardLayer** (overlay): lê `cardTargets(game, ativo, cardId)`; lista posições (por nome, com dono) e/ou jogadores; escolher → `playHandCard(id, target?, targetPlayer?)` + fecha. Cancelar fecha sem jogar.
- **ModalLayer**: passa a importar `RARITY_COLOR`/`cardLabel`/`CARD_DESC` de `cardMeta.ts` (mesmos valores).

## Cobertura de teste (`tests/game/ui/handView.test.ts`) — SC-005

1. Carta de reação → `playable false`, motivo de reação.
2. Carta `proprio-turno` quando não é a vez → `playable false` "Só no seu turno"; quando é a vez (e há alvo, se preciso) → `true`.
3. "Saia da Prisão" (`preso`): preso → `playable true`; não preso → `false` "Só quando preso".
4. `cardTargets`: Aquisição lista só propriedades elegíveis (sem construção, dono ≥2 não-hipotecadas, caixa ok); Despejo só cidades de outro com ≥1 casa; Boicote propriedades de outro; Auditoria adversários não eliminados; Imunidade só próprias.
5. Carta de alvo sem nenhum alvo válido → `handCardsView` marca `playable false` "Sem alvo válido".
6. `cardTargets` de carta sem alvo → `null`.
