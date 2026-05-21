# Contrato — Transferência de imunidade (028)

## Tipos (economy/types.ts)

`Trade` += `fromImmunityTransfers?: number[]`, `toImmunityTransfers?: number[]` (posições; o beneficiário atual é o ofertante daquele lado).

## Motor (economy/trade.ts)

- `validImmunityTransfers(state, transfers, beneficiaryId)` = `(transfers ?? []).every(pos => hasImmunity(state, beneficiaryId, pos))`.
- **validateTrade** += transferências de `from` (beneficiário `fromId`) e de `to` (`toId`); falha ⇒ proposta inválida.
- **executeTrade** (antes das concessões novas): reassina `beneficiaryId` de cada imunidade transferida (from→to / to→from), preservando `lapsRemaining` e `granterId`.

| Cenário | Resultado |
|---|---|
| `from` é beneficiário de imunidade em X; `fromImmunityTransfers:[X]` | válido; ao aceitar, beneficiário de X vira `to` (voltas preservadas) |
| `from` NÃO é beneficiário em X; `fromImmunityTransfers:[X]` | inválido |
| transferir + conceder nova na mesma troca | ambos aplicados; concessão inalterada |
| imunidade permanente (`lapsRemaining: null`) | transferível; recebedor a mantém permanente |

**Invariante**: `executeTrade` para tudo que não é transferência permanece idêntico (013/014/024 verdes).

## UI (TradeLayer / compositor) — US2

- Por lado, seção "Transferir imunidade": lista `game.immunities` onde `beneficiaryId === <lado>`; marcar inclui a `pos` em `fromImmunityTransfers` (eu transfiro) / `toImmunityTransfers` (peço que o outro transfira).
- Modal recebido lista as transferências (🛡️ "transfere {propriedade}").

## Cobertura de teste (`tests/game/economy/negociacao-ui.test.ts`, +casos) — SC-005

1. `validateTrade` com `fromImmunityTransfers:[X]` e `from` beneficiário de X → true; se não for beneficiário → false.
2. `executeTrade`: após aceitar, `hasImmunity(recebedor, X)` true, `hasImmunity(ofertante, X)` false; `lapsRemaining` preservado.
3. permanente (`null`) transferida → recebedor permanente.
4. transferir + conceder nova juntos → ambos aplicados.
5. concessão de novas sem transferência → idêntica ao 024 (sem regressão).
