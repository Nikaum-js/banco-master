# Research: Cartas ofensivas com alvo

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION.

## R1 — Módulo `cards/ofensivas.ts` despachado por `playHandCard`

**Decisão**: funções puras `acquire(state, attackerId, pos)`, `evict(state, attackerId, pos)`, `audit(state, attackerId, targetId, ports)` que **mutam o clone** e retornam `boolean` (aplicou?). `playHandCard` clona, chama a função; se `false`, retorna o `state` original (no-op).

**Rationale**: espelha o 015 (boicote/imunidade despachados por `playHandCard`). Validação rica fica isolada e testável; o `boolean` mantém a semântica no-op do `playHandCard`.

## R2 — Aquisição Hostil (§10.6)

**Decisão**: gates — alvo = propriedade de **outro**; `cityLevel(t)===0` e `!t.hangar` (sem construção); dono com `≥2` propriedades **não-hipotecadas**; `!isTempImmune(pos)`; atacante com caixa. Preço = `round(price * (airport||utility ? 1.5 : 1))` (preço **de tabela**, R5). Efeito: `atacante.cash -= preço (+ transferKeepFee se hipotecada)`; `dono.cash += preço`; `ownerId → atacante`; `mortgaged` acompanha (taxa de 10% ao banco, §6.3).

**Rationale**: §10.6 literal. "Compensação ao dono" = o preço (×1,5 incluído) vai ao dono; a taxa de hipoteca (§6.3) vai ao banco. `≥2 não-hipotecadas` é gate sobre o dono.

## R3 — Despejo (§10.6)

**Decisão**: gates — alvo = **cidade** (`kind==='property'`) de outro, `houses ≥ 1` e `!hotel`, `!isTempImmune`. Efeito: `houses -= 1`; `bank.houses += 1`; dono **não recebe**. Sem enforce de uniformidade.

**Rationale**: §10.6 "1 casa (não hotel)... não afeta a uniformidade obrigatória". Cidade com hotel não tem casa avulsa para demolir.

## R4 — Auditoria Fiscal (§10.6)

**Decisão**: gate — alvo = **outro** jogador (não eliminado). `owed = round(netWorth(target) * 0.10)`; `paid = min(target.cash, owed)`; `target.cash -= paid`; `ports.onPayToCenter(state, paid)` (→ pote). Sem Imunidade Temporária (alvo = jogador).

**Rationale**: §10.6 "10% do patrimônio líquido ao centro". `netWorth` já existe (006). Sem caixa → paga o que houver (R6).

## R5 — "Preço original" = preço de tabela

**Decisão**: usar `square.price` como "preço original que pagou".

**Rationale**: o motor **não** rastreia o preço pago por dono (compra a preço de tabela, mas leilão pode divergir). Preço de tabela é o "preço original" canônico e simples. Documentado; revisitar se o leilão tornar isso relevante.

## R6 — Auditoria sem caixa; sem falência cross-player

**Decisão**: a Auditoria debita `min(cash, owed)` (paga o que houver); **não** fale o alvo (que não é o jogador ativo).

**Rationale**: consistente com o Tax Man (012, R7) — a falência do 008 é centrada no jogador ativo; bankrupt cross-player é fora de escopo.

## R7 — Imunidade Temporária bloqueia Aquisição/Despejo, não Auditoria

**Decisão**: `acquire`/`evict` checam `isTempImmune(pos)` (alvo = propriedade). `audit` **não** (alvo = jogador).

**Rationale**: §8.4/§10.6 — Imunidade Temporária protege uma **propriedade** de Aquisição/Despejo/Boicote; Auditoria mira o jogador, não uma propriedade.

## R8 — `targetPlayer` em `playHandCard`

**Decisão**: `playHandCard(state, playerId, cardId, ports, target?: number, targetPlayer?: string)`. Aquisição/Despejo usam `target` (posição); Auditoria usa `targetPlayer`.

**Rationale**: a Auditoria mira um jogador (não uma posição). Parâmetro extra opcional é retrocompatível com 006/015.
