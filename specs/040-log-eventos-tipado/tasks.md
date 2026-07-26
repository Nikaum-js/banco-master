# Tasks: Log de eventos tipado

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Modelo**: [data-model.md](./data-model.md) · **Contrato**: [contracts/log-entry.md](./contracts/log-entry.md)

Legenda: `[P]` = paralelizável (arquivo independente) · `[USn]` = user story da spec. Ordem = dependência técnica.

**Testes**: obrigatórios. **Test-first** onde a task muda comportamento já provado — som (035) e histórico (021) têm suíte, e é ali que uma regressão passa calada.

**A ordem em 3 movimentos é o desenho, não burocracia** (D10 do plan). São 14 arquivos do motor tocados; a Fase 2 é a única com reescrita de asserção em massa, e vem primeiro de propósito para o barulho aparecer isolado. **Cada fase termina verde antes da próxima.**

**A promessa a vigiar**: nenhum reducer ganha lógica de decisão. `logEvent` é a última linha e não influencia nada. Se durante a implementação um `if` de regra passar a depender de campo de log, **parar** — o desenho está errado (FR-006).

**O oráculo a preservar**: a tabela de `classifyLogEntry` (`classify.ts:72-83`) é transcrita **antes** de ser apagada (T004). Sem isso, a prova de não-regressão de áudio vira circular (risco 1 do research, SC-009).

---

## Fase 1 — O tipo, a moeda e o oráculo (bloqueia tudo)

- [x] **T001** `src/game/economy/types.ts`: `ALL_LOG_KINDS` (25 literais, `as const`) + `LogKind = typeof ALL_LOG_KINDS[number]` + `LogEntry` como união discriminada, campo a campo conforme [data-model.md](./data-model.md). **A lista é a fonte; o tipo deriva dela** — invertido, o teste de exaustividade passaria verde justamente quando a lista ficasse desatualizada (D6 do plan).
- [x] **T002** `src/game/log.ts`: `logEvent(state, entry)` conforme [contrato §1](./contracts/log-entry.md). Teto de 50 e `shift` preservados. Assinatura antiga removida — não coexistir com a nova, senão os 14 pontos migram pela metade e ninguém percebe.
- [x] **T003** [P] `src/lib/money.ts`: `money(n) → 'R$ 1.200'` (pt-BR, separador de milhar). **Convenção da UI, não do log** — o levantamento inverteu esta decisão (D4 do plan, §3 do research).
- [x] **T004** [P] `tests/game/ui/sound/classify.test.ts`: transcrever a tabela atual de cues (9 pares frase→cue) como **oráculo explícito**, ainda contra o código velho, e deixá-la verde. É a rede de segurança de SC-009 e precisa existir **antes** de T012.
- [x] **T005** [P] `tests/game/log/logEntry.test.ts` **[test-first]**: a forma do evento — round-trip JSON idêntico (invariante 4); teto de 50; `'legacy'` nunca emitida por reducer (invariante 9); `ALL_LOG_KINDS` cobre a união sem sobra nem falta.

**Checkpoint**: o tipo existe, o emissor existe, a moeda existe, o oráculo de som está gravado. Nada migrado ainda — a suíte está **vermelha** nos 14 pontos, e isso é esperado.

---

## Fase 2 — Movimento 1: migrar os 14 pontos existentes (bloqueia US1)

**Meta**: suíte de volta ao verde com os eventos que já existiam, agora tipados. Nada de novo funciona; a UI ainda não mudou.

- [x] **T006** `src/game/turn/turnMachine.ts`: `roll` (linhas 165 e 331 — mesmo `kind`, `attempt: true` na tentativa de prisão) e `go` (linha 57, `landed: boolean` substitui a escolha de frase).
- [x] **T007** [P] `src/game/turn/resolution.ts`: `tax` (74) e `bus-ticket-gain` (61).
- [x] **T008** [P] `src/game/economy/purchase.ts`: `buy` (44) — nome da casa sai da string, `pos` fica.
- [x] **T009** [P] `src/game/economy/resolveRentable.ts`: `rent` (36) — **`ownerId` sai de dentro da frase** (vazamento 1 de 3). Sem `base`/`multiplicador` nesta fatia (D9 do plan).
- [x] **T010** [P] `src/game/economy/trade.ts`: `trade` (181) — **`fromId`/`toId` saem da frase** (vazamento 2 de 3).
- [x] **T011** [P] `src/game/emprestimos/emprestimos.ts`: `loan-interest` (153) e `loan-interest-short` (161) — **`creditorId` sai da frase** (vazamento 3 de 3). Em `loan-interest-short`, `amount` (pago) e `shortfall` (virou dívida) são campos distintos; a frase de hoje mistura os dois.
- [x] **T012** [P] `src/game/cards/draw.ts`: `card-draw` (39, **sem campo de carta nem raridade** — FR-015 vira garantia de tipo) e `card-immediate` (51 com `delta: 0`, e 60 com o delta real).
- [x] **T013** [P] `src/game/falencia/falencia.ts`: `debt-paid` (58) e `bankruptcy` (112).
- [x] **T014** Revisar as asserções da suíte do motor que mencionam formato de log. **SC-005 é o limite**: só muda o que afirmava o formato antigo. Qualquer outra asserção que precise mudar é sinal de regra alterada — e nenhuma regra muda aqui. Se aparecer, **parar e investigar** antes de ajustar.

**Checkpoint**: `bunx vitest run tests/game` verde. `bun run typecheck` limpo. A UI ainda mostra `p1` — é a Fase 3 que mata.

---

## Fase 3 — Movimento 2 / US1: o histórico chama pelo nome (P1) 🎯 MVP

**Meta**: zero id de jogador no histórico, com e sem sala.

- [x] **T015** [US1] `tests/game/log/describeLog.test.ts` **[test-first]** [P]: o contrato do descritor ([§2](./contracts/log-entry.md)) — frase por `kind`; **nenhum fragmento contém id** (SC-001, verificável na estrutura, sem React); `room: null` → `Jogador N` (FR-017); `'bank'` → texto `"Banco"`, nunca fragmento de jogador; `'legacy'` → texto solto (FR-022); moeda via `money` (FR-020).
- [x] **T016** [US1] `src/game/ui/log/describeLog.ts`: `LogFragment`/`LogSentence` + `describeLogEntry(entry, room)`. `switch` total com `assertNever`. **Puro** — `room` é parâmetro, não hook (4.5 do research).
- [x] **T017** [US1] `tests/game/log/describeLog.test.ts` [P]: os casos de identidade que a spec listou como edge — jogador **eliminado** ainda resolve nome; jogador que **saiu da sala** cai no fallback em vez de expor id.
- [x] **T018** [US1] `src/boards/shared.tsx`: `CenterLog` passa a consumir `describeLogEntry` + a `Room` do `roomStore` (038). **A cor da linha vem da identidade da sala** (FR-019), não de `PLAYER_COLORS[i]` — é a linha 1537 que muda. A comparação `l.who === 'Banco'` (1583) passa a `'bank'`.
- [x] **T019** [US1] `src/game/ui/`: as 6 definições locais de formatador convergem para `money` — `LandAuctionLayer.tsx:25`, `TradeLayer.tsx:27`, `GameHUD.tsx:48`, `NoticeLayer.tsx:106`, `ModalLayer.tsx:639`, e os 5 pontos inline de `shared.tsx`. **Conferir uma a uma**: produzem a mesma string hoje (expressão copiada), então a troca é neutra — se alguma divergir, é bug preexistente e vai aparecer no render (D4 do plan).

**Checkpoint**: `p1` morto na UI inteira. SC-001 e SC-006 verificáveis. **A spec pode parar aqui** — é o MVP.

---

## Fase 4 — Movimento 3 / US2: o log registra o jogo inteiro (P1)

**Meta**: as 8 famílias silenciosas passam a existir. É o defeito maior (§2 do research).

- [x] **T020** [US2] `tests/game/log/logEntry.test.ts` **[test-first]**: uma asserção por família — construir (4 níveis), vender construção, hangar (build/sell), hipotecar, deshipotecar, fechar leilão (com e sem lance), fechar lote (com e sem vencedor), coletar pote, pagar fiança. Verifica o `kind` e os campos (FR-007..013, SC-008).
- [x] **T021** [US2] [P] `src/game/economy/construction.ts`: `build` (`buildHouse`, `level` = nível **resultante**), `build-hangar`, `sell-building`, `sell-hangar`. **Um `kind` para os 4 degraus do ladder** (D5 do plan, 4.3 do research).
- [x] **T022** [US2] [P] `src/game/economy/mortgage.ts`: `mortgage` (`amount` = `mortgageValue`) e `unmortgage` (`cost` = `unmortgageCost` — nome assimétrico de propósito: o dinheiro **sai**).
- [x] **T023** [US2] [P] `src/game/economy/auction.ts`: `auction-won` / `auction-unsold` em `closeAuction`. `who = 'bank'`, `winnerId` separado — é o caso que justifica autor ≠ beneficiário no modelo.
- [x] **T024** [US2] [P] `src/game/economy/landAuction.ts`: `lot-won` / `lot-unsold` **dentro de `settleLot`** — única função por onde os dois caminhos de fecho passam (4.6 do research). `lot-unsold` cobre também o líder eliminado antes do fecho (linha 161), evento hoje invisível. `origin` vem no evento porque `state.landAuction` pode já ter sido esvaziado.
- [x] **T025** [US2] [P] `src/game/balancing/balancing.ts`: `free-parking` em `collectCenter`. **Princípio IV**: só o valor, nenhum campo nem palavra que sugira catch-up.
- [x] **T026** [US2] [P] `src/game/turn/turnMachine.ts`: `jail-fine` nos dois pontos (316 voluntário, 344 forçado na 3ª tentativa). Mesmo `kind`; em 344 o valor é `Math.min(JAIL_FINE, cash)` e pode ser menor que $50 — daí ser campo.
- [x] **T027** [US2] `src/game/ui/log/describeLog.ts`: as frases dos 12 `kind` novos. O substantivo de `build` deriva de `level` (casa / hotel / 2º hotel / arranha-céu) — escolha de palavra pertence ao descritor. *(feito na Fase 3, junto com T016 — ver Desvios: switch total não compila parcial.)*

**Checkpoint**: SC-008. Cada família silenciosa aparece no histórico.

---

## Fase 5 — Movimento 3 / US3: som e ícone param de adivinhar (P2)

- [x] **T028** [US3] `tests/game/ui/logIcon.test.ts` **[test-first]** [P]: ícone por `kind`; **exaustividade** iterando `ALL_LOG_KINDS` (FR-026); os 8 padrões antes inalcançáveis agora têm `kind` que os produz (SC-002).
- [x] **T029** [US3] `src/game/ui/log/logIcon.tsx`: `logIcon(kind)`, total, `switch` + `assertNever`. **Sai de `shared.tsx` por lint, não estética** — exportar não-componente de arquivo de componente é o aviso de `react-refresh` que a sessão de 2026-07-25 zerou ([contrato §4](./contracts/log-entry.md)). *(feito na Fase 3 — ver Desvios.)*
- [x] **T030** [US3] `src/boards/shared.tsx`: `logEventIcon` (1515) **removido**; `CenterLog` consome `logIcon(entry.kind)`. *(feito na Fase 3 — ver Desvios.)*
- [x] **T031** [US3] `src/game/ui/sound/classify.ts`: `classifyLogEntry` por `kind` + `logKey` por campos em **ordem fixa** (D7 do plan). `JSON.stringify` **não serve** — ordem de chaves depende da ordem de construção, e chave instável quebraria `countNewLogEntries` de forma intermitente.
- [x] **T032** [US3] `tests/game/ui/sound/classify.test.ts`: migrar o oráculo de T004 de frase para `kind`, **preservando cada par**. Os dois `kind` de juros mapeiam para `loan-interest` (a frase de hoje casa nos dois via `includes('juros')`) — preservar é preservar comportamento. Cue dos 12 `kind` novos **decidido explicitamente**, inclusive `null` onde não há som — `null` por decisão ≠ `null` por esquecimento (SC-009).
- [x] **T033** [US3] `tests/game/ui/sound/*`: `countNewLogEntries` com a chave nova — duas entradas idênticas em valor contam como duas; log irreconhecível não re-toca histórico (FR-025).

---

## Fase 6 — Convergência, verificação e fecho

- [x] **T034** `tests/net/logConverge.test.ts` [P]: SC-007 — `GameState.log` idêntico byte a byte em 3 clientes sobre o `LocalHub`. **Comparar o log, não a frase**: frase divergente entre clientes com salas diferentes é o desenho, não defeito (Complexity Tracking do plan) — um teste que compare texto renderizado falharia por motivo certo e conclusão errada.
- [x] **T035** SC-004: buscar em `src/` por comparação de substring sobre frase de log (`includes(`/`startsWith(` sobre `what`). Deve dar **zero**.
- [x] **T036** SC-003 **com dentes**: acrescentar um `kind` de sabotagem à união e verificar que `typecheck` **e** os testes de exaustividade falham apontando som e ícone. Remover depois. Prova que o gate não é decorativo — mesmo método do `tsconfig.test.json` (sessão de 2026-07-26) e do `ctx.now` da 039.
- [x] **T037** Gates completos: `bunx vitest run` · `bun run typecheck` · `bun run lint` (**zero** — não regredir o que a 2026-07-25 zerou) · `bun run build`.
- [x] **T038** Simulação: `bun run sim:batch` e conferir que os `kind` novos são exercitados pelo fuzzer (SC-008 medido, não suposto — mesmo método que mediu `land-auction-close` 69 → 87 na 039).
- [x] **T039** Atualizar `HANDOVER.md` (seção da spec 040 + item 1 dos próximos passos marcado feito), `docs/MILESTONES.md` e `CONTEXT.md` se algum termo novo merecer entrada.

---

## Desvios do plan/contrato

Como na 039 — desvio achado na implementação é registrado aqui **e** no contrato, com o motivo. Contrato contradito em silêncio é pior que contrato nenhum.

- **Fase 2 — checkpoint "`bun run typecheck` limpo" só vale para o motor.** `src/boards/shared.tsx` (T018, Fase 3) e `src/game/ui/sound/classify.ts`/`SoundLayer.tsx` (T031, Fase 5) ainda acessam `LogEntry.what`/`.who` genericamente e só param de quebrar quando essas tasks rodarem — são consumidores explicitamente adiados pelo próprio desenho em 3 movimentos. `bun run typecheck` só fica limpo de ponta a ponta no gate da Fase 6 (T037).
- **`src/game/ui/DebugLogger.tsx`** não está em nenhuma task (ferramenta de dev, fora do escopo de US1-3) mas quebrava o typecheck por acessar `.who`/`.what` genericamente — ajustado para `` `[log] ${kind} (${who})` `` + o objeto inteiro, sem task própria.
- **`src/game/cards/draw.ts`: `describeImmediate`** (frase por efeito de carta, ex. "foi para a Prisão", "Apagão: hangares…") virou morto após a migração de T012 — `card-immediate` agora carrega só `name`+`delta`, não `effect`. Removido. A riqueza narrativa por carta específica (nome fixo, sem depender de `delta`) precisa ser reconstruída em `describeLog.ts` (T016/T027) casando por `name`, não recriada aqui.
- **`tests/sim/engine/conservation.ts`: bug de referência em `sameEntries`.** Comparar entradas por `===` campo a campo quebra para `kind: 'roll'` porque `white: [number, number]` é array — o motor clona o estado inteiro (`structuredClone`) a cada dispatch, então duas entradas iguais por valor têm arrays com referências diferentes. Trocado para `JSON.stringify` (seguro aqui porque as duas entradas comparadas vêm sempre do mesmo código de construção, logo mesma ordem de chaves — diferente do caso de `classify.ts:logKey`, que combina entradas de proveniências distintas). Sem isso, os 3 sims headless (2p/3p/6p) davam falso-positivo de vazamento de dinheiro em toda passagem pelo GO.
- **`tests/net/conformance.test.ts`: fixture do teste "saveRoom NÃO apaga a partida em andamento"** faltava `log: []` — `supabaseTransport.loadSnapshot` agora sempre normaliza `game.log` (T002/`normalizeLog`), então um fixture sem esse campo não representa mais um `GameState` real. Corrigido o fixture, não o comportamento.
- **`src/net/supabaseTransport.ts`: `normalizeLog(data.game.log ?? [])`** — `data.game.log` pode ser `undefined` num snapshot anterior à 021 (antes do log existir); sem o fallback, `normalizeLog` quebra em `.map` de `undefined`. Fronteira de dado externo (persistência), não motor — validação cabe aqui (princípio de só validar em boundary).
- **T016/T027 e T029/T030 andaram juntas.** `ALL_LOG_KINDS`/`LogEntry` (T001) já contém os 26 `kind` desde a Fase 1 — um `switch` total com `assertNever` sobre `entry.kind` (contrato §2/§4) não compila tratando só os 13 originais. `describeLogEntry` e `logIcon` saíram da Fase 3 já com frase e ícone para os 12 `kind` novos (T027/T029), e `logIcon.tsx` já nasceu fora de `shared.tsx` (T030) — não dava pra fazer `CenterLog` compilar de outro jeito. O que falta de Fase 4 é só a EMISSÃO (T021-026, os reducers ainda não produzem esses `kind`) e o teste dedicado (T020); o que falta de Fase 5 é `classify.ts`/`SoundLayer.tsx` (som ainda por `kind`, T031-033) — `logIcon` não tem pendência.
- **`card-immediate` perdeu granularidade do `effect`.** `describeImmediate` (pré-040) ramificava por `effect` (ex. `voltaGo`, `vaPrisao`); o evento tipado só carrega `name` (nome da carta) + `delta`. `describeLog.ts` reconstrói a frase casando por `name` (`CARD_FIXED_PHRASE` + `cardImmediatePhrase`) — funciona porque nome de carta é 1:1 com efeito hoje, mas é acoplamento por STRING (nome exibido), não por id de efeito. Se um dia duas cartas diferentes compartilharem o mesmo `name` com efeitos distintos, essa reconstrução quebra silenciosamente — risco aceito nesta fatia porque não acontece hoje, registrado para se alguém for adicionar carta nova.
- **Cor do dinheiro no log deixou de distinguir ganho/perda.** A `LogWhat` antiga (regex `recebeu|ganhou|coletou` = verde, `pagou|perdeu` = vermelho) é removida; o fragmento `{t:'money', amount}` do contrato não carrega sinal, e recriar a distinção exigiria estender o contrato (campo novo) para algo que nenhuma FR pede. `LogSentenceView` pinta todo valor monetário na cor neutra (dourado/brass) — perda visual pequena, não uma regra do motor (fora de SC-005).
