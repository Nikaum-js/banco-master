# Research: Limpeza na eliminação (§9.4)

Sem NEEDS CLARIFICATION.

## R1 — `granterId` no `Immunity`

**Decisão**: `Immunity += granterId?: string` (opcional). `executeTrade` seta ao conceder: `fromImmunities` → `granterId: fromId`; `toImmunities` → `granterId: toId`.

**Rationale**: §9.4 distingue imunidades **concedidas** (granter) de **recebidas** (beneficiário). O `Immunity` só tinha `beneficiaryId`. Opcional ⇒ literais de teste sem o campo seguem válidos; em jogo real a imunidade só nasce no `executeTrade`, então sempre terá `granterId`.

## R2 — Limpeza no `declareBankruptcy`

**Decisão**: após `debtor.eliminated = true`, filtrar:
- `s.immunities = s.immunities.filter(i => i.granterId !== debtor.id && i.beneficiaryId !== debtor.id)` (concedidas + recebidas).
- `s.tempEffects = s.tempEffects.filter(e => e.ownerId !== debtor.id)` (originados pelo eliminado).

**Rationale**: §9.4 (imunidades concedidas/recebidas canceladas). Os `tempEffects` do eliminado são removidos por consistência: o relógio de expiração é o GO do `ownerId`, que não joga mais → ficariam órfãos/perpétuos.

## R3 — Sem afetar terceiros

**Decisão**: os filtros usam apenas ids do eliminado; imunidades/efeitos de outros permanecem.

**Rationale**: SC-003.

## R4 — Transferência de imunidade (§8.4) deferida

**Decisão**: fora de escopo. Re-atribuir beneficiário de uma imunidade existente exige payload de troca próprio; não é parte da limpeza de eliminação.
