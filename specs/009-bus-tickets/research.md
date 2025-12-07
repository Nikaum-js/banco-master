# Research: Uso de Bus Tickets & espaço Bus Ticket

Decisões técnicas que dão suporte ao [plan.md](./plan.md). Tudo resolvido — sem NEEDS CLARIFICATION pendentes.

## R1 — Onde mora o comando de uso

**Decisão**: `useBusTicket(state, dest, ctx)` em `src/game/turn/turnMachine.ts`, exportado como os demais comandos do turno.

**Rationale**: usar o ticket é um **movimento alternativo à rolagem** — mesma família de `rollDice`, `chooseBusMove`, `chooseTripleDest`. Reusa diretamente `advance` (movimento + crédito de GO), `land` (pousar/abrir resolução) e `finishIfEnded` (passar a vez se o pouso encerrar). Pôr em outro módulo duplicaria essas primitivas internas.

**Alternativas**: módulo `busticket/` próprio (rejeitado — a lógica é 100% turno e dependeria de exports internos de `turnMachine`); slice de `resolution` `{kind:'bus-ticket-move'}` com escolha em duas etapas (rejeitado — ver R3).

## R2 — Definição de "lado" e validação de destino

**Decisão**: helper puro `sideOf(pos): 0|1|2|3|null` — retorna o índice do lado para casas 1–11/13–23/25–35/37–47, e `null` para os cantos (0/12/24/36). Destino válido ⇔ `sideOf(pos) === sideOf(dest)` **e** `sideOf(pos) !== null` **e** `dest !== pos`.

**Rationale**: encapsula a regra dos lados do SRS §10.7 num único ponto testável; o `null` para canto implementa diretamente a decisão de clarify (ticket indisponível sobre canto, FR-003a) sem ramo extra.

**Alternativas**: tabela fixa de ranges (equivalente, mais verboso); aceitar canto como destino (rejeitado — contraria §10.7, que define lados como as 11 casas **entre** cantos).

## R3 — Escolha do destino: parâmetro do comando, não slice de resolução

**Decisão**: o `dest` é **parâmetro** de `useBusTicket(dest)`. A UI calcula as casas válidas do lado e o jogador clica numa antes de o comando ser chamado. Não há slice transitório no `GameState`.

**Rationale**: idêntico ao padrão de `chooseTripleDest(pos)` (002), que já recebe o destino como parâmetro sem criar slice. Mantém o estado serializável enxuto (princípio VII) e evita um novo `kind` de `resolution`. A validação do destino vive no comando puro (não confia na UI).

**Alternativas**: slice `{kind:'awaiting-bus-dest'}` bloqueando o turno até a escolha (rejeitado — passo de UI extra sem ganho; o turno já está em `aguardando-rolagem`, que naturalmente representa "ainda não moveu").

## R4 — Movimento horário e crédito de GO

**Decisão**: `steps = (dest - pos + 48) % 48`; chamar `advance(s, player, steps, ctx.ports)`. `advance` (002) já credita `onPassGo` quando o caminho cruza o índice 0 e marca `completouPrimeiraVolta`.

**Rationale**: implementa a decisão de clarify (movimento sempre horário; credita GO ao cruzar). Reuso total da primitiva — a única situação real de crédito é escolher uma casa "atrás" no lado 37–47 (ex.: pos 45 → dest 38 ⇒ 41 passos cruzando o GO). Consistente com cartas de movimento e Mr. Banco Master, que já usam `advance`.

**Alternativas**: salto direto (`player.pos = dest`) sem crédito (rejeitado em clarify — tornaria a cláusula de GO do §10.7 letra morta).

## R5 — Pouso sem rolagem (sem dupla, sem re-rolagem)

**Decisão**: após `advance`, chamar `land(turn, player, null)`. Com `roll = null`, `land` define `mayRollAgain = false` (mesma semântica de sair da prisão sem dupla). Em seguida `finishIfEnded(s, ctx)`.

**Rationale**: o ticket substitui a rolagem; não há dados ⇒ não há dupla ⇒ não há nova rolagem (FR-007). `land` também trata o caso `corner-gotojail` por segurança, mas o destino nunca é canto (validado em R2), então sempre cai em `casa-a-resolver`.

**Alternativas**: reimplementar o set de estado inline (rejeitado — `land` já encapsula).

## R6 — Resolução da casa de destino (incl. utilidade sem dados)

**Decisão**: a casa de destino é resolvida pelo fluxo existente (`resolvePending` → `ctx.resolve` = `economyResolve ?? cardResolve` → registry). Como **não houve rolagem**, `turn.lastRoll` permanece `null`; para **utilidades**, `diceValue(null) === 0` ⇒ aluguel de utilidade alcançada por ticket é **$0**.

**Rationale**: o SRS §10.7 manda "resolver a casa normalmente" mas não define o valor dos dados para chegada sem rolagem. Cobrar $0 na utilidade é a consequência direta do motor atual (`diceValue` já trata `null`), é raro (3 utilidades no tabuleiro) e não é o foco da feature. **Simplificação documentada** — revisitar se virar problema de balanceamento (alternativa futura: rolar 2 dados só para o cálculo do aluguel da utilidade).

**Alternativas**: rolar dados fantasma para a utilidade (rejeitado nesta versão — adiciona RNG e um caminho especial a uma borda rara); proibir ticket com destino utilidade (rejeitado — contraria "qualquer casa do lado").

## R7 — Espaço Bus Ticket (§2.7)

**Decisão**: handler `'bus-ticket'` no `resolutionRegistry` deixa de ser `stub` e passa a `({ state, playerId }) => { +1 em busTickets do jogador; { done: true } }`. Só dispara ao **parar** (a resolução só roda para a casa onde o token pousa), nunca ao passar (FR-009/FR-010 garantidos pelo fluxo do turno).

**Rationale**: a casa já é roteada pelo registry; só falta o efeito. "Parar concede, passar não" é consequência natural de a resolução rodar apenas no pouso. Sem baralho finito de tickets (Assumption da spec): incremento de contador, coerente com §10.7 ("sem limite").

**Alternativas**: tratar o espaço como fonte via deck finito (rejeitado nesta versão — não há entidade de baralho de tickets; §10.7 diz sem limite).

## R8 — UI (HUD mínimo)

**Decisão**: o `GameHUD` mostra o controle "Usar Bus Ticket (N)" habilitado só quando o jogador da vez está em `aguardando-rolagem`, fora de canto e com `busTickets ≥ 1`. Ao ativar, lista as casas válidas do lado atual (pos + nome) como botões; clicar chama `useBusTicket(dest)`.

**Rationale**: espelha o padrão dos controles existentes do HUD e da escolha de destino do Triple. Mantém o HUD como único ponto de UI funcional; painéis laterais seguem decorativos.

**Alternativas**: clique direto na casa do tabuleiro (rejeitado por ora — o board é render estático/decorativo; integrá-lo é trabalho de M2).
