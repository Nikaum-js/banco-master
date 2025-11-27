# Research: Negociação — troca de propriedades e caixa

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION.

## R1 — `executeTrade` = acordo já aceito (sem máquina de proposta)

**Decisão**: `executeTrade(state, trade)` processa uma troca **acordada**. Não há estado de "proposta pendente" no `GameState`; a UX de propor → aceitar/recusar → contraproposta é da UI/multiplayer.

**Rationale**: espelha `grantLoan` (010). §8.3 é accept/refuse simples (sem contra-oferta formal — recusar descarta, recusado pode propor de novo). Modelar o acordo como um comando puro mantém o estado enxuto e testável; o roteamento propor/aceitar entre clientes é M3.

**Alternativas**: slice de `resolution` `{kind:'trade-proposal'}` bloqueando até aceite (rejeitado — trades são **off-turn**/assíncronos, não cabem no gating de resolução do turno ativo).

## R2 — Tipo `Trade` e validação atômica

**Decisão**: `Trade = { fromId, toId, fromProps: number[], fromCash: number, toProps: number[], toCash: number }`. `executeTrade` valida tudo **antes** de qualquer mutação; inválido → retorna `state` inalterado (atômico).

Validações:
- `!paused`; `fromId !== toId`; ambos existem e **não** eliminados.
- `fromCash ≥ 0`, `toCash ≥ 0` (inteiros).
- cada `fromProps` é de `fromId`; cada `toProps` é de `toId` (`ownerOf`).
- nenhuma **cidade com construção** nos props (`cityLevel(title) > 0` para `kind==='property'`) — §8.2.
- caixa: `from.cash ≥ fromCash` e `to.cash ≥ toCash` (não oferecer mais do que tem); e o resultado final de cada lado ≥ 0 após taxas.

**Rationale**: atomicidade evita estados parciais; "oferecer mais do que tem" é rejeitado (cenário §8.2). Cidades com construção bloqueiam (vender antes).

## R3 — Transferência de hipotecada: taxa de 10% (§6.3, reuso 005)

**Decisão**: propriedade hipotecada trocada **permanece** hipotecada; o **recebedor** paga ao banco `transferKeepFee(sq) = round(mortgageValue(sq) * 0.1)` (já existe no 005). Taxas removidas (banco).

Fluxo de caixa:
- `feesFrom` = Σ `transferKeepFee` das hipotecadas em `toProps` (pagas por `fromId`, que as recebe).
- `feesTo` = Σ `transferKeepFee` das hipotecadas em `fromProps` (pagas por `toId`).
- `finalFrom = from.cash − fromCash + toCash − feesFrom`; `finalTo = to.cash − toCash + fromCash − feesTo`.
- ambos ≥ 0 senão rejeita.

**Rationale**: §6.3 exato; reuso da função do 005. A taxa entra na validação atômica de caixa para não deixar ninguém negativo.

**Alternativas**: forçar deshipoteca na troca (rejeitado — §6.3 permite manter hipotecada pagando 10%; deshipotecar é escolha posterior do recebedor via 005).

## R4 — O que transfere com a propriedade

**Decisão**: ao trocar, só muda `ownerId`. Os flags `mortgaged` e `hangar` **acompanham** a propriedade (transferem com ela). Cidades com construção são **bloqueadas** (não chegam a trocar).

**Rationale**: §13.6 — Hangar segue o aeroporto em transferências (como na falência). `mortgaged` segue (§6.3). Construções de cidade não são negociáveis (§8.2), então nunca transferem (bloqueadas na validação).

## R5 — Não gated por turno; cartas/Bus Tickets/empréstimos fora

**Decisão**: `executeTrade` recebe `fromId`/`toId` explícitos e **não** consulta `activePlayer` — funciona a qualquer momento (§8.1). O payload **não** tem campo para cartas/Bus Tickets/empréstimos (D-011/D-012) — são estruturalmente não-negociáveis.

**Rationale**: §8.1 (a qualquer momento, fora do turno) + §8.2/D-011/D-012 (não-negociáveis). Não modelar esses itens no `Trade` é a forma mais segura de garantir a regra (princípio VI).

## R6 — Sem UI (M2)

**Decisão**: 013 é engine-only; a troca não entra no HUD mínimo (que é controle de turno de 1 cliente; trades são entre pares arbitrários, off-turn).

**Rationale**: consistente com 004/011 (construção também engine-only). A UX de negociação (modais propor/aceitar, fluxo Richup) é trabalho de M2/M3.
