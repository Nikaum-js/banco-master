# Research: Cartas — efeitos temporários de N voltas

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION.

## R1 — `tempEffects` e o módulo `economy/tempEffects.ts`

**Decisão**: `TempEffect = { kind: 'apagao'|'greve'|'boicote'|'imunidade-temp'; ownerId: string; pos: number | null; lapsRemaining: number }`. `GameState.tempEffects: TempEffect[]`. Helpers puros em `economy/tempEffects.ts`: `apagaoActive`, `greveActive`, `isBoycotted(pos)`, `isTempImmune(pos)`, `addTempEffect`, `tickTempEffects(ownerId)`.

**Rationale**: lista única serializável cobre os 4 tipos (board-wide com `pos:null`; por-propriedade com `pos`). Em `economy/` para `resolveRentable`/`taxMan` importarem sem ciclo (cards→economy já é a direção existente). Separado de `immunities` (014) porque são semânticas distintas (ver R5).

## R2 — Expiração por volta (reuso de `afterPassGo`)

**Decisão**: `tickTempEffects(state, ownerId)` decrementa `lapsRemaining` dos efeitos cujo `ownerId` passou pelo GO; remove os `≤ 0`. Chamado no `afterPassGo` do store (junto de `chargeLoanInterest` e `tickImmunities`).

**Rationale**: §10.6 "voltas completas do tabuleiro" = passagem pelo GO; o originador é o relógio (consistente com 014). Reuso do gancho já existente — nenhuma nova porta.

## R3 — Apagão/Greve imediatos; Boicote/Imunidade de mão com alvo

**Decisão**:
- **Apagão/Greve**: handlers no registry de `cards/effects.ts` (aplicados no saque via `applyEffect`, são imediatas). Registram `{kind, ownerId: sacador, pos:null, lapsRemaining:1}`.
- **Boicote/Imunidade**: cartas de mão (`proprio-turno`). `playHandCard(state, playerId, cardId, ports, target?)` ganha um `target?: number`; Boicote/Imunidade são tratados como caso especial (como o Atalho), exigindo `target`, validando e registrando o efeito (`lapsRemaining:2`).

**Rationale**: respeita o timing do 006 (imediato vs próprio-turno). O `target` por parâmetro é mais simples que um slice de `resolution` e suficiente para motor/testes (a UX de escolher alvo é M2).

## R4 — Aplicação no aluguel (`resolveRentable`) e no Tax Man

**Decisão**: em `resolveRentable`, após dono≠pagador e não hipotecada/imune(014):
- `isBoycotted(pos)` → `{ done: true }` (ninguém paga).
- aeroporto: `rentAirport(count) * (hangar && !apagaoActive ? 2 : 1)`.
- utilidade: `greveActive ? 0 : rentUtility(...)`.

No `taxMan.ts` (012), as **mesmas** checagens (boicote → não cobra; greve → utilidade $0; apagão → sem dobra) — consistência da cobrança do Fiscal.

**Rationale**: as cartas alteram o aluguel "normal" daquela casa; o Fiscal cobra "o valor que normalmente cobraria", então deve refletir os efeitos. Sem duplicar regra (mesmos helpers).

## R5 — Imunidade Temporária (carta) ≠ Imunidade de aluguel (014)

**Decisão**: a **carta** Imunidade Temporária registra `{kind:'imunidade-temp', pos}` = a propriedade **não pode ser alvo** de ofensivas (no 015, bloqueia Boicote; 016 adiciona Aquisição/Despejo). É **diferente** da `immunities` do 014 (beneficiário isento de aluguel). Listas separadas.

**Rationale**: SRS — a do 014 (§8.4) isenta pagamento de um beneficiário; a carta (§10.6) protege a propriedade de ser alvo. Misturar confundiria a checagem de aluguel com a de targeting.

## R6 — Validação dos alvos

**Decisão**:
- **Boicote**: `target` é propriedade com dono `≠` quem joga **e** não sob `isTempImmune`. Senão, no-op.
- **Imunidade Temporária**: `target` é propriedade **própria** (dono = quem joga). Senão, no-op.

**Rationale**: §10.6 — Boicote "propriedade de outro jogador"; Imunidade "propriedade sua". A proteção da Imunidade Temporária bloqueia o Boicote (FR-004).

## R7 — Catálogo: status → implementado

**Decisão**: `apagao`, `greve-utilidades`, `boicote`, `imunidade` passam de `deferido` para `implementado` no `catalog.ts`.

**Rationale**: refletir que deixaram de ser no-op. As demais deferidas (Aquisição/Despejo/Auditoria/Diplomacia/Bunker) seguem `deferido` (016/017).
