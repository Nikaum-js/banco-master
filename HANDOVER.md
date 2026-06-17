# HANDOVER — Magnata Imobiliário

> Última atualização: 2026-07-26 · branch `main` (fluxo sem branch por feature)
> Leitura de partida: este arquivo → `CLAUDE.md` → `docs/AUDITORIA-2026-07-23.md` → a spec ativa.

## Estado atual

- **O SRS não tem mais lacuna de regra.** A spec 039 (2026-07-25) implementou o §9.2 — era a última. Daqui em diante, todo trabalho é polimento/lançamento (E16) ou dívida técnica, não regra faltando.
- **Motor (M1): completo e sem gaps de regra conhecidos** — os 3 bugs achados pela auditoria de 2026-07-23 foram corrigidos (ver abaixo). **UI jogável (M2): fechada**. **Simulação (spec 036): entregue**.
- **Multiplayer (M3): specs 037, 038 e 039 COMPLETAS, infra viva. E15 FECHADO.** Fundação host-autoritativa (037) + partida online jogável (038) + leilão do espólio do falido (039).
- **Item 1 do backlog de dívida técnica FECHADO: log de eventos tipado (spec 040, 2026-07-26)** — ver seção própria abaixo.
- **Gates:** `bunx vitest run` → **633 testes / 73 arquivos verdes**; **`bun run typecheck` limpo** (`src/`+`tests/`+`e2e/`+`scripts/`); `bun run build` ok; **lint global ZERADO**; `bun audit` → 3 advisories restantes, todas em cópias transitivas de ferramenta de dev (nenhuma alcança o bundle). `bun run scripts/net-smoke.ts` verde contra o Supabase real.
- **CI VIVO** (`.github/workflows/ci.yml`, 2026-07-25): 3 jobs — `gates` (lint + tipos + vitest + build), `simulation` (30 partidas seedadas 2/3/6) e `e2e` (smoke single-player, traces no artifact em falha). O `multiplayer.spec.ts` fica fora do gate: depende de credencial Supabase.
- **E2E:** `bunx playwright test` → **2, 3 e 6 jogadores passam** (2 execuções seguidas). A falha de 6 jogadores registrada aqui antes NÃO era timeout de performance: o roteiro procurava um botão `← Frente` que o commit `03cb1ef` extinguiu, e travava no modal de Atalho até o teto de 240s. Como os dados do browser são `Math.random()`, aparecia como flake. Corrigido em `e2e/script.ts`.
- **Push agora é rotina:** remote `origin` = `github.com:Nikaum-js/magnata-imobiliario` — commits desta e da sessão anterior foram pushados. Backdate de commits segue a regra do `~/.claude/rules/git-conventions.md` (hook injeta).
- **Auditoria completa em `docs/AUDITORIA-2026-07-23.md`** — 17 itens priorizados por impacto×esforço; é o backlog técnico vigente (itens 1, 2, 7 e 14 já resolvidos).

## Spec 037 — fundação multiplayer host-autoritativo (2026-07-24)

**Entregue e verde** (plan + tasks + implementação em `specs/037-sala-online-estado-sincronizado/`). Desenho: `applyCommand` (`src/game/commands.ts`) é o **dispatcher puro** único que host e cliente compartilham sobre os reducers existentes — zero regra nova. O não-determinismo (`ctx.rng`/`ctx.now`) é **gravado pelo host e reproduzido pelo cliente** (`src/net/recorder.ts`, FR-011) → convergência exata. `LocalTransport` (`src/net/localTransport.ts`) é um hub in-memory síncrono que dirige host + N clientes num processo → toda a fundação é testável sem infra.

**Arquivos** (`src/net/`): `recorder`, `room` (assentos/cor única/lifecycle), `transport` (porta), `localTransport` (hub de teste), `host` (autoridade: identidade→pausa→aplica→no-op→seq→persist→broadcast), `client` (envio + replay + gap→snapshot), `session` (token/link), `connectStore` (`connectMultiplayer` — liga o `useGameStore` ADITIVAMENTE, sem tocar `store.ts`), `supabaseTransport` (adapter connect-ready). + `src/game/ctx.ts` (fábrica do `TurnCtx` de produção) + `supabase/migrations/0001_rooms_snapshots.sql`.

**Provado headless** (`tests/net/`, 24 testes / 9 arquivos): SC-001 convergência 2/3/8p (400 ações/seed, `JSON` idêntico), SC-003 reconexão sem perda (convidado e host), SC-004 pausa global + rejeição + retomada + host-caído, SC-005 anti-spoof (fecha `store.ts:262`/item 17), FR-012 gap→snapshot, FR-017 congelamento de deadline, FR-001..006a sala.

**Sessão 2026-07-24 (parte 2) — o lobby saiu do papel (T018 + T023..T027):**

- **Porta `Transport` ganhou o canal de lobby**: `requestJoin`/`onJoinRequest` (a identidade do assento é o **token da conexão**, não algo declarado pelo pedinte), `rejectJoin`/`onJoinRejected` (motivo: cheia / cor tomada / já iniciada) e `saveRoom`/`loadRoom` (a sala existe antes de haver `GameState` — o snapshot não serve no lobby). Implementado nos DOIS transportes.
- **`host.open()`** abre a sala e, se já houver partida persistida, **reassume a autoridade pelo snapshot** (FR-015 — F5 do host não mata a partida). **`host.startMatch()`** fecha o lobby e inicia (FR-006).
- **`OnlineGate`** (`src/net/ui/OnlineGate.tsx` + `LobbyScreen.tsx`): sem `?host=1`/`?room=`, o app é o single-player de sempre. Com eles, monta transporte+client (+host se você criou a sala), tela de nome/cor, lista de assentos, link copiável, "Iniciar partida", `connectMultiplayer` quando o estado chega e `host.tick()` a cada 250ms (prazos de leilão). Ao criar a sala a URL vira `?room=<id>` via `replaceState` — assim o F5 do host cai no caminho de reentrada e reassume a autoridade.
- **`broadcast.self: true`** no canal Supabase — sem o eco do próprio envio o host não veria os próprios comandos (o modelo da spec é uniforme: todos submetem, todos aplicam só o que volta difundido). Era um bug latente do adapter connect-ready.
- **`tests/net/lobby.test.ts`** (10 testes novos): assento concedido pela rede, identidade pelo token da conexão, cor tomada, sala cheia, recusa dirigida só ao pedinte, início com 2+ e convergência do estado inicial, recusa pós-início, reanexo por token, host reassumindo autoridade após F5.

**Infra VIVA (2026-07-24):** migration aplicada no projeto `edppdqrkqljhjkbyjvsz` (`Banco master`, sa-east-1) — tabela `rooms`, RLS, publicação Realtime e trigger de `updated_at` com `search_path` fixo. Validada por **`scripts/net-smoke.ts`** (`bun run scripts/net-smoke.ts`), que sobe host + convidado em conexões Realtime distintas contra a infra real: assento pela rede em 52ms, estado inicial em 91ms, **comando propagado em 27ms** (SC-002: alvo <1s), convergência byte a byte e comando forjado descartado (SC-005 agora provado também sobre o transporte real). O smoke fica FORA do vitest de propósito (depende de rede) e limpa a sala que cria.

Aprendizados da infra que valem para o 038: (1) `broadcast.self: true` é obrigatório no canal — sem o eco, o host não veria os próprios comandos; (2) upsert parcial de sala não zera `game`/`seq` (premissa do `saveRoom`, agora verificada contra o PostgREST); (3) **não há policy de DELETE** de propósito — cliente anônimo não apaga sala, então limpeza de salas velhas é rotina de servidor por `updated_at`; (4) o linter do Supabase acusa `rooms_anon_insert`/`update` como permissivas (lint 0024) — deliberado enquanto a credencial for o link (D-019), some junto com o endurecimento de identidade de transporte.

**Limitações conhecidas (038+):** a UI ainda não tem **perspectiva de jogador local** — ela mostra os controles do jogador da vez para todos; cliques de quem não é o ator são simplesmente descartados pelo host (FR-007), então não há risco de estado, só de confusão visual. Nomes/cores da sala vivem fora do `GameState` (D-019) e ainda não aparecem no tabuleiro. **Anti-spoof no transporte Supabase** (token auto-declarado no broadcast) precisa de endurecimento (Edge Function/segredo de sessão) para paridade plena com o `LocalTransport` — a LÓGICA do host já rejeita spoof.

## Spec 038 — partida online jogável (2026-07-25)

**Entregue: US1–US5.** `specs/038-partida-online-jogavel/` (spec + plan + research + data-model + contracts + tasks). O que mudou, em uma linha: a UI deixou de renderizar "a vez de quem está jogando" e passou a renderizar "o que EU posso ver e fazer".

**A chave do desenho** foi não escrever lógica nova de permissão: `actorOf` (`src/game/commands.ts`) já respondia "quem é o ator legítimo desta ação" e **é o que o host usa para validar**. Extraí `actorOfKind` da MESMA tabela e a UI passou a consumi-la (`src/net/localView.ts`). Affordance e autoridade não podem divergir porque não existe uma segunda lista para esquecer de atualizar — e `localView.test.ts` tem um teste de **exaustividade** que quebra se alguém adicionar comando sem decidir a perspectiva dele.

**Módulos novos** (`src/net/`): `localView` (quem sou eu, o que posso acionar — puro), `identity` (playerId → nome/cor/peça, da SALA, com fallback `Jogador N` sem sala), `roomStore` (Zustand aditivo — não toca `store.ts`, mesma decisão de risco da 037), `ui/PlayerName` + `ui/WaitingBar` + `ui/PauseBanner` + `ui/HomeScreen`.

**Onde a UI mudou** (11 arquivos): mão de cartas passa a ser a do DONO DA TELA (era a do jogador da vez — vazava a mão alheia a cada turno, princípio VI); modais de decisão só para o ator, os demais veem "aguardando \<nome\>"; lance de leilão e de pregão presos ao assento local; `GameDriver` só auto-avança no cliente do ator; `playersView` (`boards/shared.tsx`) troca `p.id` por identidade da sala — é ali que `p1..pN` sumiu da UI inteira.

**Regra tocada (com ADR antes, nunca dentro da spec):** D-029 — desconexão de **eliminado** não pausa mais a partida (SRS §11.3 v1.5). Sem isso, como não há timeout, quem já perdeu travava a mesa ao fechar a aba. D-030 fixou o alcance da privacidade de cartas: garantia **de apresentação**, não de dados (o estado completo chega a todos os clientes por exigência do modelo de sincronização) — limitação registrada no SRS §10.3, não escondida.

**Testes de rede: 73** (era 34). Novos: `localView` (11), `identity` (11), `perspective` (5, sobre o hub com 3 clientes), `kick` (7), + D-029 no `pause` e ordem sorteada no `lobby`.

**Bug real achado pela suíte:** o cliente removido do lobby continuava se achando sentado — `resolvePlayerId` nunca limpava o assento quando ele sumia da sala publicada. Corrigido em `client.ts`.

**Cuidado que quase passou:** o gate de roteamento teria quebrado o smoke E2E do 036, que boota com `?players=N` e cairia na home nova. `?players` e `?local` entram no boot local (commit `🐛 fix(net): keep the players boot hook out of the online gate`).

**E2E de dois browsers** (`e2e/multiplayer.spec.ts`, T036): dois `BrowserContext` isolados contra a infra real — home → criar sala → entrar por link → iniciar → ordem sorteada → nenhum `pN` na tela → só o ator tem "Rolar dados" → jogada propaga. ~7s, estável (3/3). Rode com `bunx playwright test e2e/multiplayer.spec.ts`.

**Dois bugs que SÓ o E2E pegou** (a suíte headless passava verde nos dois casos):
1. **Convidado travava em "Conectando…"** — em dev, o StrictMode monta → desmonta → remonta, e o cleanup do gate fechava o canal recém-aberto enquanto o guard `booted` impedia a reconexão. O host não sofria porque cria a sala no clique, não no efeito de montagem. Corrigido: o cleanup só desliga o store, não derruba a conexão.
2. **O botão "Rolar dados" não tinha gate de perspectiva** — ele vive no `DiceArena` (`boards/shared.tsx`), junto com compra inline, prisão e finalizar turno; todo o resto da UI estava gated, a arena central não. Os dois clientes mostravam o botão. Corrigido com `mayAct` + status "Vez de \<nome\>" para quem observa.

**Limitação medida (não é bug, é o transporte):** a pausa por **queda abrupta** (crash/aba morta) só aparece quando o heartbeat do Phoenix expira — **~60-75s**. Fechamento limpo da aba emite o `leave` na hora. O **SC-004 da spec pede "até 2 segundos"**, então ele vale para saída limpa, não para queda abrupta. Cumprir os 2s exigiria heartbeat próprio na camada de aplicação (candidato ao 039+). Por isso o passo de pausa no E2E é opt-in (`E2E_PRESENCE=1`) — a mecânica já está provada headless em `pause.test.ts`.

## Sessão de 2026-07-23/24 — auditoria ponta a ponta + 3 fixes de engine + SRS v1.3

**Auditoria** (`docs/AUDITORIA-2026-07-23.md`, commit `d262f12`): mapeamento + 7 dimensões (arquitetura, design, regras, UX, qualidade, perf, segurança), tudo ancorado em arquivo:linha. Destaques: núcleo do motor elogiado (reducers puros, sim de invariantes); casca com dívidas (ciclo `shared.tsx ↔ game/ui`, god file 3.261 linhas, log stringly-typed como event bus de som/cor, dead code com valores divergentes do tema).

**3 bugs de engine corrigidos** (test-first, 6 testes novos):

1. `e5bb33e` — **Dívida de juros × slot único de resolution.** `chargeLoanInterest` (juros no GO) gravava `resolution: debt` durante o `advance`; a resolução da casa de pouso sobrescrevia (juros residuais sumiam) ou `payDebt` pulava a casa. Fix: dívida ganha `origin: 'loan-interest'` (`economy/types.ts`); `resolvePending` é no-op com qualquer `resolution` em voo (de brinde, elimina reset acidental de leilão→modal de compra); `finishIfEnded` não passa a vez com dívida aberta (caso GO → Vá pra Prisão); `payDebt` de dívida de juros devolve o turno à casa ainda pendente em vez de `completeResolution`.
2. `191a656` — **Multa de prisão sem caixa.** `jailDecision('pay')` debitava $50 sem checar caixa (só a UI guardava). Agora é no-op com caixa < `JAIL_FINE`, padrão de comando inválido do motor.
3. `22a460d` — **Asset dumping pré-falência.** Com dívida pendente, troca envolvendo o devedor (ativo) só é válida se o `liquidationValue` dele continuar ≥ dívida após a troca. **Decisão de regra:** NÃO bloqueamos trade durante dívida por completo — venda legítima para levantar caixa é rota de resgate válida; só a troca que torna o devedor incapaz de pagar (doação para lesar o credor) é rejeitada. Extraído `applyTrade` (núcleo sem validação) para `validateTrade` projetar o estado pós-troca sem recursão.

**Compatibilidade verificada antes dos fixes:** `GameDriver` já não auto-resolvia com `resolution` presente e o enumerador do sim (`tests/sim/engine/actions.ts`) já gateava `pay`/`resolve-pending` nas condições dos novos guards — nenhum fluxo existente mudou fora dos cenários de bug. Única asserção antiga ajustada: shape da dívida de juros em `emprestimos.test.ts` (ganhou `origin`).

**SRS v1.3** — §13.5 reescrito: **GO Progressivo → Bônus de GO fixo** ($200 ao passar, $400 ao parar exato), alinhando à revisão **D-007 (2026-05-24)** que já estava em DECISIONS (a auditoria errou ao dizer que não havia ADR — corrigida). Atualizados também: tabela de mecânicas (linha 74), §3.3, §4.7, carta "Volta para o GO" (credita $400) e glossário. Versão/data do doc bumpadas (1.2→1.3, Julho 2026).

**Dead-ends / avisos:**
- 3 subagentes de auditoria morreram por limite de sessão — regras/design/qualidade foram auditadas inline (mais lento, mesmo resultado).
- 1 flake na suíte completa sob carga (timeout de teste de sim na 1ª execução; 2 execuções seguintes 100% verdes) — se repetir, suspeitar de carga da máquina antes de culpar código.
- Colisão residual conhecida do slot único: dívida de juros durante fluxo de CARTA de movimento (avance3/voltaGo) ainda pode disputar o slot — teórico (exige empréstimo + carta + GO + insolvência); resolver de vez = fila de resolutions (não vale agora).

## Spec 038 — partida online jogável (aberta em 2026-07-24)

`specs/038-partida-online-jogavel/spec.md` — perspectiva de jogador local (cada cliente só decide pelo próprio assento, mão privada de verdade), identidade real da sala na partida (nomes/cores/peças no lugar de `p1..pN`), sessão visível (quem caiu, pausa, retomada), roteamento home → sala → partida → fim, kick no lobby e ordem inicial sorteada. **Sem clarificações pendentes — pronta para `/speckit-plan`.**

Duas decisões viraram ADR antes de entrar na spec (regra nunca nasce numa spec — princípio I):

- **D-029** — desconexão de jogador **eliminado** NÃO pausa a partida (refina SRS §11.3). Sem isso, como não há timeout, um eliminado que fecha a aba trava a mesa dos sobreviventes para sempre. **Impacto na 037:** o gatilho de pausa em `src/net/host.ts` hoje considera qualquer assento desconectado — precisa passar a ignorar eliminados (implementação é da 038).
- **D-030** — privacidade de cartas é garantia **de apresentação** no v1 (não de dados): o estado completo chega a todos os clientes por exigência do modelo de sincronização (D-020), então inspecionar o próprio cliente revela a mão alheia. A limitação é registrada, não escondida; endurecer exige autoridade de servidor real e entra junto do anti-spoof de transporte.

**SRS bumpado para v1.5** (§10.3 e §11.3). O `docs/PRD.md` foi realinhado: o mapa E15 antigo (037 infra / 038 transporte / 039 lobby / 040 sessão) não valia mais — a 037 absorveu as quatro; sobrou 038 (experiência) e 039 (leilão do falido §9.2).

## Spec 039 — leilão do espólio do falido-ao-banco (2026-07-25)

**Entregue: US1–US3.** `specs/039-leilao-espolio-falido/`. Fecha o SRS §9.2, que dizia desde sempre que as propriedades de quem falisse devendo **ao banco** vão a leilão — a 008 implementou o resto do §9 e deixou isso como `ownerId = null`, ou seja, o patrimônio voltava **de graça**.

**A chave do desenho foi não escrever mecânica nova.** O pregão simultâneo da 031 já resolve lotes independentes com prazo próprio, trava de solvência e fecho autônomo. A fatia acrescentou exatamente três coisas: `origin` em `LandAuction` (`'scarcity' | 'bankruptcy' | 'mixed'`), a função `openEstateAuction` (abre OU injeta lotes) e o ponto de chamada em `declareBankruptcy`. **`placeLandBid`, `committedCash`, `settleLot`, `closeExpiredLandLots` e `closeLandAuction` terminaram sem um caractere alterado** — era a promessa explícita do plan e o sinal de que o reuso estava certo.

**Regra registrada ANTES da spec:** [D-031](docs/adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md) fixou o formato (pregão simultâneo, não fila de leilões comuns) e a colisão (lotes do espólio **entram** no pregão de escassez aberto, não enfileiram). SRS bumpado para **v1.6** (§7.1 + §9.2); `CONTEXT.md` ganhou "pregão" e "espólio".

**Por que não a fila sequencial:** o leilão comum vive em `GameState.resolution`, que **bloqueia o turno**. O espólio de um jogador avançado tem facilmente 8 propriedades — a 8s cada, congelaria a mesa por mais de um minuto no meio do turno de outra pessoa. E `declareBankruptcy` acabou de esvaziar aquele slot.

**Descoberta que simplificou o código:** o contrato previa `openEstateAuction` devolver `{ state, claimed }`, para o chamador dar às posições recusadas o destino antigo. Peso morto — **um lote em pregão e uma propriedade no banco têm o mesmo estado de título** (`ownerId: null`); só se distinguem por estar em `landAuction.lots`. Recusar já deixa tudo onde estava. Retorno simplificado; desvio registrado no contrato e no `tasks.md`.

**Testes: 585** (era 554). `tests/game/falencia/espolio.test.ts` (18: gatilho, 6 guardas de não-abrir, fecho), `tests/game/economy/landAuction.test.ts` +13 (injeção, origem, FR-019), `tests/net/espolio.test.ts` (3: convergência).

**O teste de convergência tem dentes** — verificado sabotando `ctx.now` para `Date.now()`: 2 dos 3 falham. É a proteção contra o modo de falha silencioso desta fatia (prazo de lote calculado por cliente → lotes fechando em momentos diferentes, sem nada estourar).

**Simulação confirma o gatilho alcançado:** cobertura de `land-auction-close` subiu **69 → 87** no mesmo lote seedado, com os mesmos 8 `declare-bankruptcy-sink`. Se não tivesse subido, seria sinal de que o fuzzer não chega no caminho — medido, não suposto.

**Atenção de balanceamento — MEDIDA em 2026-07-26 e NÃO confirmada.** A suspeita era que o espólio, favorecendo quem tem caixa, agravasse a bola de neve de fim de jogo. O A/B nas mesmas seeds (ver a sessão de 2026-07-26) mostra curva de patrimônio **indistinguível** com e sem a regra. Registrado em [D-031](docs/adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md).

## Spec 040 — log de eventos tipado (2026-07-26)

**Entregue: US1–US3.** `specs/040-log-eventos-tipado/`. Fecha o item 1 do backlog técnico (maior alavancagem estrutural): `GameState.log` deixa de ser `{ who, what }` (prosa em português, ids interpolados) e passa a ser uma **união discriminada por `kind`** — 26 variantes (`ALL_LOG_KINDS`), o motor emite o FATO, a apresentação (frase, ícone, som) é decidida fora do motor.

**Desenho em 3 movimentos, cada um verde antes do próximo** (D10 do plan): (1) migrar os 14 pontos de emissão já existentes para o tipo novo, sem UI nova; (2) `describeLogEntry(entry, room) → LogSentence` mata `p1` do histórico — cor e nome vêm da identidade da SALA (038), nunca do id; (3) as 8 famílias antes silenciosas (construir, vender construção, hangar, hipoteca/deshipoteca, leilão comum, pregão, Free Parking, fiança) passam a logar, e som/ícone migram de regex sobre texto para `switch` exaustivo sobre `kind` (`assertNever` + teste de exaustividade — os dois gates, não um só).

**Achado real ao aplicar (não estava no plan):** durante a implementação, uma sessão paralela no mesmo repo (fora desta conversa) fez `git checkout` para uma branch e voltou, deixando a Fase 1 (tipo, `logEvent`, `money()`, oráculo de som) num `git stash` em vez do working tree. Recuperado com `git stash apply` antes de prosseguir — sem perda, mas é o tipo de estado que vale conferir (`git stash list`) antes de assumir "a Fase 1 já está pronta" só porque o `git status` inicial mostrava os arquivos modificados.

**Bug real achado pela suíte de simulação (não pela suíte unitária):** `tests/sim/engine/conservation.ts` comparava entradas de log por `===` campo a campo — quebrou para `kind: 'roll'` porque `white: [number, number]` é array, e o motor clona o estado inteiro (`structuredClone`) a cada dispatch. Duas entradas iguais em VALOR viravam "diferentes" por identidade de array, e os 3 sims headless (2p/3p/6p) davam falso-positivo de vazamento de dinheiro em toda passagem pelo GO. Corrigido para comparação por valor (`JSON.stringify`, seguro aqui porque as duas entradas comparadas nascem sempre do mesmo código, logo mesma ordem de chaves — diferente do `logKey` de produção, que combina entradas de proveniências distintas e por isso usa concatenação em ordem fixa, não `JSON.stringify`).

**`card-immediate` perdeu granularidade do `effect`, de propósito.** O evento tipado carrega só `name` (nome da carta, pública) + `delta` (variação de caixa) — não mais o id do efeito (`voltaGo`, `vaPrisao`, etc.). `describeLog.ts` reconstrói a frase casando por `name`; funciona porque nome de carta é 1:1 com efeito hoje, mas é acoplamento por STRING, registrado como risco aceito (ver `tasks.md`) caso uma carta futura repita nome com efeito diferente.

**T027/T029/T030 (Fase 4/5) saíram na Fase 3, não por antecipação de escopo — por necessidade de compilação.** `ALL_LOG_KINDS`/`LogEntry` (Fase 1) já tinham as 26 variantes; um `switch` total com `assertNever` sobre `entry.kind` não compila tratando só 13 delas. `describeLogEntry` e `logIcon` nasceram exaustivos desde o início.

**Sabotagem verificada (T036), não só suposta:** acrescentar um `kind` falso à união quebra `describeLog.ts`, `logIcon.tsx` **e** `classify.ts` (duas vezes — `classifyLogEntry` e `logKey`) — os gates de exaustividade não são decorativos. Testado e revertido.

**Testes: 633** (era 603). Novos: `tests/game/log/describeLog.test.ts` (11), `tests/game/ui/logIcon.test.ts` (3), `tests/net/logConverge.test.ts` (1, SC-007 — log idêntico byte a byte entre 3 clientes, medido no LOG, não na frase renderizada — a frase diverge por sala e isso é o desenho). `tests/game/log/logEntry.test.ts` e `tests/game/ui/sound/classify.test.ts` ganharam blocos novos (famílias silenciosas, oráculo de som migrado para `kind`).

**Simulação confirma as 8 famílias exercitadas** (`bun run sim:batch --games=300 --counts=2,3,6`, 900 partidas, 0 falhas): `build-house` 354688, `mortgage` 468889, `unmortgage` 441326, `sell-building` 345009, `build-hangar`/`sell-hangar` ~77 mil cada, `auction-close` 16900, `land-auction-close` 2302, `free-parking-collect` 13103, `jail-fine-pay` 6585 — medido, não suposto (mesmo método da 039).

**Desvio de UX registrado, não escondido:** a cor verde/vermelho por ganho/perda no histórico (`LogWhat` antiga, por regex de texto) foi trocada por uma cor neutra única para valores monetários — o fragmento `{t:'money', amount}` do contrato não carrega sinal, e estender o contrato para isso não foi pedido por nenhuma FR. Perda visual pequena, não uma regra do motor.

## Sessão de 2026-07-25 (parte 2) — CI + lint zerado

Fecha o item de prioridade Alta do backlog da auditoria. O que mudou:

- **CI** em 3 jobs (ver "Estado atual"). `.bun-version` fixa o toolchain para setup-bun e shell concordarem.
- **Lint 36 → 0.** Boa parte não era sujeira solta, era desenho: `react-refresh` acusava `shared.tsx`, `TradeLayer` e `HandCardLayer` por exportarem coisa que não é componente. Saíram para módulos irmãos — `boards/groupColors.ts`, `ui/deed/deedRents.ts`, `ui/trade/tradeUI.ts`, `ui/cards/handCardUI.ts` — e as reexportações de compatibilidade do `shared.tsx` morreram (cada consumidor importa da fonte real agora).
- **3 setState-em-efeito viraram derivação:** licitante do pregão (`LandAuctionLayer`), reset do destinatário da troca (`TradeLayer`, foi pro handler) e o "plop" de chegada do peão (`LiveTokens` — o pop agora anda no mesmo commit que avança a posição, some o ref `prevWalking`). Confete do `NoticeLayer` sorteado no import, não em render.
- **`useBusTicket` → `spendBusTicket`** no motor, com o alias `applyBusTicket` de `commands.ts` aposentado.
- **`bun update`**: 6 → 3 advisories; Playwright 1.61 → 1.62 (exige `bunx playwright install chromium`).

**Achado que vale mais que o CI:** o E2E de 6 jogadores não estava lento, estava **travado** — e 2/3 jogadores estavam a um sorteio de azar do mesmo destino. Ver "Estado atual → E2E". Lição: `driveTurns` falha por TIMEOUT quando um matcher morre, o que mascara o motivo real; ao mexer em rótulo de botão, o roteiro do smoke é consumidor.

## Sessão de 2026-07-26 — typecheck de verdade + curva de patrimônio + A/B do espólio

Fecha os itens **3 e 4** da lista de próximos passos. Nenhuma regra tocada; nenhum arquivo de `src/` alterado.

**1. `tests/`, `e2e/` e `scripts/` agora passam pelo typecheck (item 4).** `tsconfig.test.json` novo cobre as três pastas + `vitest.config.ts` + `playwright.config.ts`, entra como `reference` do `tsconfig.json` raiz (então `bun run build` cobre tudo) e ganhou o atalho `bun run typecheck`. O passo "Tipos" do CI trocou `-p tsconfig.app.json` por `bun run typecheck`. **Cobertura verificada por contagem:** os 7 diretórios/arquivos `.ts`/`.tsx` do `git ls-files` estão todos em algum dos três projetos.

Os flags espelham `tsconfig.app.json` de propósito — inclusive `strict` DESLIGADO, que é o estado do app. Checar os testes sob régua mais dura que o produto produziria erro que o gate principal não vê. **Nota:** `strict` não está ligado em nenhum tsconfig do repo; ligar é decisão separada, com outro volume de erros, e não foi feito aqui.

**Gate com dentes, verificado:** replantei o caso original (`Loan` com `lapsElapsed` em vez de `ratePct` em `espolio.test.ts`) e `bun run typecheck` sai com exit 2 apontando o campo. Antes passava verde.

**Os 29 erros, todos corrigidos.** Quase todos tipagem de fixture, mas dois eram resto real:
- **`isEliminated: () => false`** em `balancing.test.ts` e `conservation.test.ts` — porta **removida** do `TurnPorts` no review de arquitetura (`resolution.ts:34` documenta a remoção). Os testes seguiam injetando uma porta inexistente havia semanas.
- **`piece: 'cartola'`** em `boot.test.ts` — peça fora do catálogo `PIECES`. `pieceOf` cai no fallback silencioso, então a fixture "funcionava" servindo avião. `ANA`/`BRUNO` agora são anotadas `SessionIdentity`: sem a anotação `piece` alarga para `string` e o id inválido volta a passar.
- O resto: `Seat` sem `isHost`, `Roll` sem `isDouble/move/special`, `peca?: string` em vez de `PieceId`, e parameter properties do `fakeSupabase.ts` vs `erasableSyntaxOnly` (viraram campos declarados à mão).
- O `phase === 'ended'` "inalcançável" de `runGame.ts` era mesmo falso positivo, como registrado — narrowing preso pela condição do `while` (o TS não acompanha `dispatch` reatribuindo `session.game`). Resolvido extraindo `gameEnded(session)`: chamada de função não estreita, então o narrowing some em vez de ser silenciado por cast.

**Bug que a correção acima quase introduziu, e que vale como lição:** ao trocar a condição do laço por uma função chamada `ended`, a linha `if (!ended && rounds >= roundCap)` passou a testar a *função* — sempre truthy, então `!ended` virou constante `false` e **o teto de rodadas ficou morto**. O `tsc` não viu (função em contexto booleano é válida) e os 585 testes seguiram verdes. Renomear para `gameEnded` transformou o ponto cego em erro de compilação (`Cannot find name 'ended'`). Lição: ao substituir um booleano local por função, o nome NÃO pode colidir — a colisão troca um erro de compilação por um bug silencioso.

**2. Curva de patrimônio na simulação (item 3).** `tests/sim/engine/wealth.ts` (novo) + campos no `SimResult`/`SimReport` + agregação e formatação no `report.ts`. `runGame` amostra o patrimônio de todos os jogadores **a cada rodada fechada** — no fecho todos jogaram o mesmo número de turnos, então a comparação entre jogadores é justa. Patrimônio é o `netWorth` de `@/game/cards/effects`, o MESMO que a Auditoria Fiscal cobra em jogo (fórmula paralela mediria uma economia que não é a do produto).

O relatório (texto e markdown) ganhou **vitórias por assento** e a curva por **decil de progresso** — não por rodada absoluta, senão a média de fim de jogo seria dominada pelas partidas longas. Três métricas por decil: **Gini** (concentração), **fatia do líder** e **"quem liderava aqui venceu"** — esta última é a leitura direta de persistência de liderança. Eliminado entra como patrimônio 0 de propósito: tirá-lo faria o Gini CAIR justamente quando a mesa ficou mais desigual.

**Leia o decil 10 com cuidado:** a amostra é por rodada FECHADA e a partida termina no meio da rodada final, então o decil 10 é a última rodada **completa**, não o estado de vitória (que seria fatia 1,00 trivial). Um teste fixa isso — se a coleta passar a incluir o estado terminal, ele cai.

**18 testes novos** (`wealth.test.ts`), com o Gini conferido contra **oráculo independente** (fórmula por ranks, derivação diferente da soma de diferenças absolutas usada na implementação).

**3. A/B do espólio (fecha a atenção de balanceamento da 039).** Comparar "partidas com espólio" vs "sem" DENTRO do mesmo lote é observacional e não conclui nada: partida onde alguém faliu ao banco já é mais desigual por outros motivos. O teste causal foi um A/B nas **mesmas seeds** — worktree com a instrumentação e `src/` revertido para a revisão anterior à 039, único delta = a regra. ~1000 partidas por lado, em 3 e em 6 jogadores.

**Resultado: nenhum efeito detectável.** Gini e fatia do líder iguais até a 3ª casa decimal em todos os decis; "líder venceu" difere ≤2pp contra ruído de ±3pp (2σ). E o tratamento não foi fraco: **+292 (3p) e +768 (6p)** propriedades a mais efetivamente vendidas em pregão (`land-auction-close` só marca lote com licitante vivo, isto é, venda com dinheiro movido). Em **2 jogadores o A/B sai idêntico byte a byte** — e isso valida o método: ali o espólio nunca abre (elimina → sobra 1 → §9.5 encerra antes da guarda "≥2 vivos").

**O que a curva mostra de verdade** (e precede a 039 — igual nos dois lados): liderar decide bastante. Líder do decil 5 vence **58% em 3p** e **53% em 6p**, contra base de 33% e 17%; no decil 8, 71% e 69%. É característica do gênero, não efeito do espólio — mas agora é uma série medida, e é o baseline contra o qual qualquer mexida futura de balanceamento (D-026 em orange/red) se compara.

**Achado lateral do N grande:** em 6 jogadores, **1 seed em 1000** (`20861217`) estoura o teto de 1500 rodadas. Não é travamento — com `--rounds=4000` a partida fecha em **1773 rodadas** e p4 vence. O teto documentado como "100/100 seeds" simplesmente não tinha visto a cauda. Não afeta o CI (lote de 10 seeds por contagem, nenhuma é essa). E, no N=120 que rodei antes, `p1` parecia ter vantagem de assento em 6p (24% das vitórias); em N=1000 vira 16,6% — era ruído, e serve de aviso sobre concluir balanceamento com lote pequeno.

## Próximos passos (do backlog da auditoria, em ordem)

1. ~~**Log tipado** (`LogEntry {kind, who, amount, what}`)~~ — **FEITO** em 2026-07-26 (spec 040, ver seção própria). Destravou explicação de aluguel na UI (campos separados, não mais prosa), som por `kind` (não mais substring), cor do histórico pela identidade da sala, e deixou i18n possível (não implementado, mas a frase agora nasce num arquivo só).
2. **Pacote "mostrável"**: persistência do `GameState` em localStorage (F5 hoje mata a partida) + ErrorBoundary; leilão comum multi-licitante + botão "passar" (`passBid` existe no store sem UI — copiar o seletor do pregão em `LandAuctionLayer.tsx:217-230`); lobby mínimo com nomes (UI hoje celebra "p1" na vitória).
3. ~~**Sim: registrar vencedor/curva de patrimônio por rodada**~~ — **FEITO** em 2026-07-26 (`tests/sim/engine/wealth.ts` + curva por decil no `report.ts`). O consumidor que **falta** é a hipótese de ROI desproporcional da construção parcial (**D-026**) em orange/red: o instrumento existe, a medição não foi feita. O efeito do espólio da 039 já foi medido e refutado.
4. ~~**Typecheck de `tests/`, `e2e/` e `scripts/`**~~ — **FEITO** em 2026-07-26 (`tsconfig.test.json`, no `tsc -b` e no CI; 29 erros zerados). Fica pendente a decisão separada de **ligar `strict`**, que não está ativo em nenhum tsconfig do repo.

## Próximo marco: E16 / M4 — polimento & lançamento

Não há mais regra a implementar. O que separa do v1.0: tela de fim de jogo com resumo, acessibilidade/responsivo, telemetria mínima, deploy. Nenhuma spec aberta ainda.

## Sessões anteriores

- **2026-07-23:** auditoria ponta a ponta entregue (`docs/AUDITORIA-2026-07-23.md`, commit `d262f12`); suíte na época: 353 testes.
- **2026-07-1x:** animação de dados cup-drop sincronizada ao áudio (`8a600ce`, showcase em `727a843`); fix `lastRoll` em passes forçados (`abad5c8`); spec 035 (som): ~40 cues, 3 canais, unlock de autoplay, SoundBoard via `?sons`.
- **2026-07-11 (spec 036):** simulação headless (`tests/sim/`, mulberry32, mesmos reducers do produto), `sim:replay`/`sim:batch`, smoke E2E Playwright (2/3/6p via `?players=N` — hook de boot, NÃO é o lobby do M3); 4 bugs de produção achados pelo fuzzer e corrigidos (cartas de pagamento, multa 3ª tentativa, solvência no fecho de leilões); testes de conservação com oráculo independente (23 casos) — empréstimos ficam em 0 ocorrências no lote aleatório (cobertos por unit).
- **2026-05-27 (spec 034 / D-026):** construção com país PARCIAL — constrói com 1+ cidade, aluguel construído escala 50→100% pela posse (`posseFactor` em `rent.ts`); D-027: Bus Ticket também usável no fim do turno.
- **2026-05-24/25:** M1+M2 fechados (specs 001–033): motor completo (turno, economia, cartas 32/32, empréstimos, falência §9.4, Tax Man, pregão de escassez D-023), UI jogável (painéis/modais/trade/cartas de mão), tema Cidades do Mundo (`theme.ts` fonte única, 10 grupos com platinum/Emirados), rebalanceamento D-024. Revisões de playtest: Speed Die SUSPENSO (`THEME.SPEED_DIE_ENABLED=false`, D-003), GO Progressivo → fixo $200/$400 (D-007), construção ilimitada (D-022 — leilão de casas removido).

## Convenções que valem a pena relembrar

- **bun, nunca npm/npx.** Lógica pura em `src/game/**` (reducers `(state, ctx) → state` com `structuredClone`; único efeito é o store Zustand). `GameState` 100% serializável (princípio VII). RNG e relógio injetáveis via `ctx`.
- Resolução de casa = slice única em `GameState.resolution` — **cuidado: slot único** (ver fix `e5bb33e`); eventos autônomos (`pendingTrade`, `landAuction`, `notice`) vivem FORA dela.
- Workflow por feature: Spec Kit (`/speckit-specify → plan → tasks → implement`); próxima spec é a **037**. Antes de specificar: constitution + SRS (agora v1.3) + `CONTEXT.md` + `docs/adr/`.
- Commits: inglês, emoji+conventional, backdate via hook, NUNCA co-author. Push em `main` direto.

## Ponteiros

- `docs/AUDITORIA-2026-07-23.md` — backlog técnico priorizado (17 itens).
- `docs/SRS.md` (v1.3) — verdade das regras · `docs/adr/README.md` — ADRs (D-007 GO fixo, D-020 M3 host-autoritativo, D-022/24/26 economia).
- `specs/00N-*/` — spec/plan/tasks por feature · `docs/MILESTONES.md` — roadmap.
