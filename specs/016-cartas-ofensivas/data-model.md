# Data Model: Cartas ofensivas com alvo

**Sem mudança no `GameState`.** As cartas mutam entidades existentes.

## Mutações

| Carta | Muta |
|---|---|
| Aquisição Hostil | `titles[pos].ownerId` (→ atacante; `mortgaged` acompanha); `atacante.cash` (− preço − taxa); `dono.cash` (+ preço) |
| Despejo | `titles[pos].houses` (−1); `bank.houses` (+1) |
| Auditoria Fiscal | `target.cash` (− 10% netWorth ou o que houver); `centerPot` (+ via `onPayToCenter`) |

## Funções (`cards/ofensivas.ts`)

| Função | Retorno | Gates |
|---|---|---|
| `acquire(state, attackerId, pos)` | `boolean` | outro dono; `cityLevel=0` e `!hangar`; dono ≥2 não-hipotecadas; `!isTempImmune`; caixa do atacante ≥ preço(+taxa) |
| `evict(state, attackerId, pos)` | `boolean` | cidade de outro; `houses≥1` e `!hotel`; `!isTempImmune` |
| `audit(state, attackerId, targetId, ports)` | `boolean` | `targetId ≠ attacker`, existe, não eliminado |

Preço da Aquisição: `round(square.price * (airport||utility ? 1.5 : 1))`. Taxa de hipoteca: `transferKeepFee(square)` (se `mortgaged`).

## Parâmetros (`playHandCard`)

`playHandCard(state, playerId, cardId, ports, target?: number, targetPlayer?: string)`:
- Aquisição/Despejo → `target` (posição).
- Auditoria → `targetPlayer` (id do jogador).

## Invariantes

- Aquisição: posse transferida; preço (×1,5 aeroporto/utilidade) ao dono; taxa §6.3 ao banco se hipotecada.
- Despejo: −1 casa ao banco; dono não recebe; sem enforce de uniformidade.
- Auditoria: ≤ 10% do patrimônio (limitado ao caixa) ao pote; sem caixa negativo.
- Imunidade Temporária (015) bloqueia Aquisição/Despejo; não Auditoria.
- Carta consumida (vai ao fundo do deck); no-op se inválido.
- Estado JSON puro/serializável (princípio VII); sem campos novos.
