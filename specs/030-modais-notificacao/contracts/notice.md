# Contrato — Notificações informativas (030)

## Estado (`turn/types.ts`)

`GameState.notice: Notice | null`, com `Notice = { kind:'free-parking'; playerId; amount } | { kind:'hostile-takeover'; victimId; attackerId; pos }`.

## Motor

| Gatilho | Efeito |
|---|---|
| `collectCenter(state, playerId)` (007) | seta `notice = { kind:'free-parking', playerId, amount: <pote coletado> }`; coleta/reset inalterados |
| `acquire(state, attackerId, pos)` → sucesso (016) | seta `notice = { kind:'hostile-takeover', victimId: <dono anterior>, attackerId, pos }`; preço/transferência inalterados |
| `dismissNotice(state)` | clona, `notice = null` |

**Invariante**: fora o registro de `notice`, 007 e 016 produzem exatamente o mesmo estado de antes (suíte verde). `notice` não bloqueia `finalizeTurn`.

## UI (`NoticeLayer.tsx`)

- Lê `game.notice`; se houver, exibe overlay:
  - `free-parking` → "🎉 {playerId} coletou R${amount} do Free Parking!"
  - `hostile-takeover` → "⚠️ {victimId} perdeu {nome da propriedade} para {attackerId} (Aquisição Hostil)"
- Botão "OK" → `dismissNotice()`.

## Cobertura de teste (`tests/game/economy/notice.test.ts`) — SC-004

1. `collectCenter` com pote acumulado → `notice` free-parking com `playerId` e `amount` corretos; pote volta à semente (regra 007 intacta).
2. `acquire` válido → `notice` hostile-takeover com vítima/atacante/pos; título transferido (regra 016 intacta).
3. `dismissNotice` → `notice` vira `null`.
4. `acquire` inválido (gate falha) → não seta `notice` (continua o que era).
