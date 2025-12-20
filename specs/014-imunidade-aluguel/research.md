# Research: Imunidade de aluguel (negociável)

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION.

## R1 — Concessão dentro da troca (estende a `Trade` do 013)

**Decisão**: `Trade += fromImmunities?: ImmunityGrant[]; toImmunities?: ImmunityGrant[]` (`ImmunityGrant = { pos, laps: number | null }`). `fromImmunities` = concedidas por `from` → beneficiário `to`, sobre propriedades de `from`; `toImmunities` = espelho. `executeTrade` valida e aplica junto (atômico).

**Rationale**: §8.4 — "como parte da troca". Reusa a atomicidade/validação do `executeTrade` (013). Campos **opcionais** → não afeta trocas/tests do 013.

**Alternativas**: comando `grantImmunity` separado (rejeitado — §8.4 amarra à troca; separá-lo permitiria conceder fora de negociação).

## R2 — Validação da concessão

**Decisão**: cada `ImmunityGrant` exige: `ownerOf(pos) === granterId` (concede sobre propriedade **própria**) **e** `pos ∉ granterProps` (não está cedendo essa mesma propriedade na troca) **e** `laps` é `null` (permanente) ou inteiro `> 0`. Inválido → a troca inteira é rejeitada (atômica).

**Rationale**: só faz sentido conceder imunidade sobre algo que você mantém. Manter atômico com o resto da troca evita estados parciais.

## R3 — `GameState.immunities` e `hasImmunity`

**Decisão**: `Immunity = { beneficiaryId, pos, lapsRemaining: number | null }` (null=permanente) em `economy/types.ts`; `GameState.immunities: Immunity[]`. `hasImmunity(state, beneficiaryId, pos)` = existe imunidade com esse beneficiário e posição.

**Rationale**: estado mínimo serializável. A imunidade é de **(beneficiário, propriedade)** — independente de quem é o dono atual (R5).

## R4 — Isenção no `resolveRentable` e expiração no `afterPassGo`

**Decisão**:
- **Isenção**: em `resolveRentable`, após `owner !== payer` e não hipotecada, se `hasImmunity(state, payerId, pos)` → `{ done: true }` (sem aluguel/dívida). Cobre cidade/aeroporto/utilidade.
- **Expiração**: `tickImmunities(state, beneficiaryId)` decrementa `lapsRemaining` (quando número) das imunidades do beneficiário e **remove** as que chegam a `≤ 0`; `null` (permanente) intacto. Chamado no `afterPassGo` do store (junto de `chargeLoanInterest`), i.e., quando o beneficiário passa pelo GO.

**Rationale**: reuso do gancho `afterPassGo` (010) — "volta" = passagem pelo GO do beneficiário. A isenção no ponto único de cobrança (`resolveRentable`) cobre todos os tipos de propriedade.

## R5 — Imunidade persiste em mudança de dono

**Decisão**: a imunidade é checada por `(beneficiário, pos)`; **não** é invalidada se a propriedade trocar de dono.

**Rationale**: leitura literal de §8.4 ("não paga aluguel ao parar **naquela propriedade**"). Mais simples e determinístico. Documentado para revisão (alternativa: expirar ao sair do concedente — rejeitada por não ter base no SRS e adicionar acoplamento).

## R6 — Pessoal; não afeta Tax Man

**Decisão**: a isenção só vale para o `beneficiaryId` específico (outros pagam). O **Tax Man** (012) cobra o **dono** (não um "que parou"), então **não** consulta imunidade.

**Rationale**: §8.4 "pessoal... não cancela a propriedade". O Tax Man é cobrança ao dono, conceitualmente distinta de "parar e pagar aluguel".

## R7 — Transferência de imunidade existente: deferida

**Decisão**: re-atribuir uma imunidade já existente a um novo beneficiário ("transferíveis", §8.4) fica **fora de escopo** (FR-009). O núcleo entrega conceder/isentar/expirar.

**Rationale**: exigiria um payload de re-atribuição na troca e regras de "quem pode transferir o quê" — caso avançado de baixo uso frente ao núcleo. Registrado para uma spec futura.

## R8 — HUD

**Decisão**: o HUD exibe uma linha de status das imunidades ativas (`beneficiário → propriedade · voltas`), visível a todos (§8.4). Sem UI de proposta (montar a troca é M2).

**Rationale**: consistente com o status de empréstimos (010) no HUD; mantém o efeito visível (§8.4) sem construir a UX de negociação (M2).
