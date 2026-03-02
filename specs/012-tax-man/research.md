# Research: Tax Man (Fiscal)

Decisões técnicas de suporte ao [plan.md](./plan.md). Sem NEEDS CLARIFICATION pendentes.

## R1 — Gancho em `advanceSeat` (1× por turno, todos os finais de turno)

**Decisão**: chamar `ctx.ports.taxMan?.(s, ctx.rng)` no **início** de `advanceSeat` (002), antes de calcular o próximo assento.

**Rationale**: `advanceSeat` é o **único choke point** de "este turno acabou, passa a vez" — cobre finais normais (`finalizeTurn`), forçados (3ª dupla→prisão, tentativa de prisão falha via `finishIfEnded`) e por falência (`declareBankruptcy`). Garante "a cada turno" (§13.8) e **uma vez por turno** (a re-rolagem de dupla NÃO passa por `advanceSeat`, então não dispara o Fiscal — FR-007).

**Alternativas**: chamar em `finalizeTurn` (rejeitado — perderia turnos que terminam por prisão/falência); criar uma fase de FSM `fiscal` (rejeitado — o efeito é automático, sem input; fase seria peso morto).

## R2 — Porta opcional `taxMan?(state, rng)` (002 desacoplado)

**Decisão**: `TurnPorts += taxMan?(state: GameState, rng: RNG): void`. O store injeta `taxMan: (s, rng) => rollTaxMan(s, rng)`. Recebe `ctx.rng` para ser **determinístico** em teste.

**Rationale**: mantém o 002 sem importar balanceamento (mesmo padrão de `onPassGo`/`afterPassGo`). Passar `rng` permite testar o Fiscal com RNG injetável (como o resto do motor).

**Alternativas**: o Fiscal usar `Math.random` interno (rejeitado — não-determinístico, intestável); função importada direto em `turnMachine` (rejeitado — acopla 002 ao balanceamento).

## R3 — `defaultPorts` SEM o Fiscal (zero regressão)

**Decisão**: o `defaultPorts` exportado (usado por testes de 002/008/010 que chamam `advanceSeat`) **não** inclui `taxMan`. Só o `ctx` do **store** injeta o Fiscal (`{ ...defaultPorts, taxMan }`).

**Rationale**: vários testes existentes chamam `advanceSeat`/`declareBankruptcy` com `ports: defaultPorts` e afirmam caixas exatos. Se o Fiscal fizesse parte do `defaultPorts`, ele moveria/cobraria nesses testes e quebraria asserções. Mantê-lo fora do `defaultPorts` preserva o determinismo desses testes; o jogo real (store) tem o Fiscal. Os testes desta feature constroem um `ctx` com `taxMan` explícito.

**Alternativas**: adicionar ao `defaultPorts` e corrigir os testes afetados (rejeitado — mais frágil e ruidoso; a assimetria é explícita e documentada).

## R4 — Movimento puro do Fiscal (2 dados brancos, sem GO/prisão/carta)

**Decisão**: `rollTaxMan` rola `roll(rng, { speedDie: false })` e faz `taxManPos = (taxManPos + r.move) % BOARD.length`. **Não** credita GO, **não** envia à prisão, **não** saca carta nem compra.

**Rationale**: §13.8 — o Fiscal é um token do banco que só **move e cobra**. Sem Speed Die (é progresso de jogador, não do token). Movimento puro evita reusar `advance` (que credita GO) — o Fiscal não é jogador.

## R5 — Cobrança = aluguel da casa onde para (reuso do cálculo de aluguel)

**Decisão**: se `BOARD[taxManPos]` é property/airport/utility, com dono (`ownerOf != null`) e **não** hipotecada, debita do dono:
- cidade: `rentCity(sq.rent, groupOwnedCount(owner), groupSize, {houses,hotel,hotel2,skyscraper}, groupHasSkyscraper)` (mesmo do 011).
- aeroporto: `rentAirport(countOwned) * (hangar ? 2 : 1)`.
- utilidade: `rentUtility(countOwned, diceValue(r))` — usa o **valor dos dados do Fiscal** (não houve rolagem de jogador).

A cobrança ocorre **mesmo** se o dono é o jogador cujo turno acabou (§13.8, FR-004) — não há checagem de "isenção", então é automático.

**Rationale**: "o valor que normalmente cobraria de aluguel daquela propriedade" = exatamente o cálculo de aluguel do 003/011. Reuso total; sem regra nova de valor.

## R6 — Destino: banco (removido), não pote (clarify)

**Decisão**: o valor cobrado é **debitado do dono e não creditado a ninguém** (removido da economia). **Não** usa `onPayToCenter` (que iria ao pote do Free Parking).

**Rationale**: clarify — literal "ao banco" + "beneficia **indiretamente** quem está atrás" (drena o líder; deflacionário; não premia ninguém diretamente nem infla o pote que o próprio líder poderia coletar). Catch-up discreto (princípio IV).

## R7 — Dono sem caixa + guardas

**Decisão**: debita `Math.min(ownerP.cash, amount)` (paga o que houver; sem caixa negativo). **Não** falir o dono nesta versão (pode ser jogador não-ativo; a resolução de dívida do 008 é centrada no ativo). `rollTaxMan` é no-op se `phase !== 'playing'` ou se houver ≤1 jogador não-eliminado.

**Rationale**: evita acoplar o Fiscal à falência cross-player (fora do modelo atual). Simplificação registrada no Complexity Tracking; revisitar quando houver falência de não-ativo.

**Alternativas**: abrir `debt` para o dono (rejeitado — a resolução `debt` bloqueia o turno do **ativo**; o dono cobrado pode não ser o ativo).
