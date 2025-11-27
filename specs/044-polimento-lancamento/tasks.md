# Tasks: Polimento & Lançamento

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Modelo**: [data-model.md](./data-model.md) · **Contratos**: [contracts/](./contracts/)

Legenda: `[P]` = paralelizável (arquivo independente) · `[USn]` = user story da spec · `[test-first]` = o teste vem antes do código · `[manual]` = passo que exige um humano (conta, painel, verificação em produção).

**Testes**: obrigatórios. FR-022, FR-050 a FR-054 **são** requisitos funcionais de prova — o gate é entregável, não acessório.

**A ordem das 8 fases é a do "Fluxo de implementação" do plan**, e ela inverte a ordem de valor de propósito: a US1 (publicar) vale mais e vem por último, porque publicar antes de existir gate de acessibilidade e de partida completa publicaria sem as travas que a própria D-041 exige. A Fase 1 é a única que toca o motor e roda **sozinha**, com a suíte inteira olhando.

**A promessa a vigiar**: nenhuma regra de jogo muda. Se durante a implementação aparecer a tentação de "já que estou no `falencia.ts`, ajusto o leilão do espólio" — **parar**. Os quatro campos são registro de fatos já observados; nenhum reducer pode mudar de resultado por causa deles.

**O oráculo a preservar**: a suíte de `tests/` passa hoje (350+ testes). `createSeedState` é chamada por mais de 50 arquivos — o parâmetro novo é **opcional**, e nenhum teste existente pode precisar de edição por causa dele. Se algum precisar, o desenho está errado, não o teste.

---

## Fase 1 — Fim de jogo no motor (US2, bloqueia a Fase 2)

**Meta**: o estado sabe quem caiu, em que ordem, em que rodada e quanto durou. Nenhuma tela mudou ainda.

- [x] **T001** `src/game/turn/types.ts`: `EliminationRecord { playerId: string; round: number }`; `GameState` ganha `eliminationOrder: EliminationRecord[]`, `round: number`, `startedAt: number`, `endedAt: number | null`. Comentário de cada campo conforme [data-model §1](./data-model.md).
- [x] **T002** `src/game/setup.ts`: `createSeedState(playerIds, startedAt = 0)` e `buildInitialGame(playerIds, rng, startedAt = 0)` — parâmetro **opcional** ([D3 do plan](./plan.md#d3--startedat-entra-por-parâmetro-opcional-não-por-datenow-dentro-do-setup)). Inicializa `eliminationOrder: []`, `round: 1`, `endedAt: null`.
- [x] **T003** [test-first] `tests/game/turn/round.test.ts`: `round` começa em 1; incrementa **uma vez** por volta completa na ordem de assentos; não incrementa em turno extra por dupla; continua correto quando um jogador é eliminado no meio da volta (a ordem encurta).
- [x] **T004** `src/game/turn/turnMachine.ts` (`advanceSeat`, linha ~109): incrementar `round` quando a busca do próximo assento dá a volta ([D1 do plan](./plan.md#d1--round-incrementa-em-advanceseat-e-a-definição-é-volta-na-ordem-não-turno)). **Não** mexer em `startTurn` nem em `finishIfEnded`.
- [x] **T005** [test-first] `tests/game/falencia/eliminationOrder.test.ts`: a ordem registra na sequência em que `bankrupt` roda; mesa de 2 → um registro; mesa de 6 com três falências → três registros na ordem certa, cada um com a rodada da queda; `eliminationOrder.length === players.filter(p => p.eliminated).length` em todo passo.
- [x] **T006** `src/game/falencia/falencia.ts`: `s.eliminationOrder.push({ playerId: debtor.id, round: s.round })` junto de `debtor.eliminated = true` (linha ~111), **antes** de `checkEndGame`. Em `checkEndGame` (linha ~42): ao transitar para `'ended'`, gravar `endedAt` a partir do relógio injetado.
- [x] **T007** `src/game/store.ts` (linha ~22) e `src/net/host.ts` (linha ~214): passar o relógio ao construir a partida — `Date.now()` no store, o `now` do contexto no host (o mesmo que o `recorder` grava e replica).
- [x] **T008** [test-first] `tests/game/summary.test.ts`: os 7 casos do [contrato](./contracts/match-summary.md#testes-obrigatórios-testsgamesummarytestts).
- [x] **T009** `src/game/summary.ts`: `matchSummary(game)` conforme o contrato — pura, nunca lança, `partial` para estado inconsistente ou snapshot antigo. Reusa `netWorth` de `game/cards/effects.ts:25`.
- [x] **T010** [test-first] `tests/net/snapshotCompat.test.ts`: snapshot sem os quatro campos carrega, é jogável, termina, e `matchSummary` devolve `partial: true` sem lançar.
- [x] **T011** `src/game/log.ts`: `normalizeGame(raw)` ao lado de `normalizeLog` — defaults da [tabela de compatibilidade](./data-model.md#compatibilidade-com-snapshot-antigo). Ligar em `supabaseTransport.loadSnapshot` (mesmo ponto onde `normalizeLog` já é chamada).

**Checkpoint**: `bun run typecheck`, `bunx vitest run` e `bun run sim:batch -- --games=10 --counts=2,3,6` verdes. **Nenhum teste existente editado.** A UI ainda não sabe que nada disso existe.

---

## Fase 2 — Tela de fim de jogo (US2)

**Meta**: o ramo `winner` do HUD vira o resumo da partida.

- [x] **T012** [P] [US2] `src/game/ui/EndGameScreen.tsx` (FR-001, FR-002, FR-005, FR-006, FR-007, FR-010): consome `matchSummary(game)`. Cabeçalho com o vencedor (coroa + `PlayerName`, reusando o que o `GameHUD:157` já tem); tabela de classificação com posição, jogador, patrimônio, propriedades e rodada da queda; rodapé com rodadas e duração. `partial: true` → agrupa eliminados sem afirmar posição e diz por quê (FR-009). Sem prazo, sem contagem regressiva.
- [x] **T013** `src/game/ui/GameHUD.tsx` (linha ~157): o ramo `hud?.kind === 'winner'` passa a renderizar `<EndGameScreen/>`. O botão de saída mantém o comportamento atual — online: voltar ao início; local: novo jogo (FR-008, spec 038 FR-027).
- [x] **T014** [test-first] `tests/ui/endGame/endGameScreen.test.tsx` (jsdom, pragma na 1ª linha — padrão da 042): mesa de 3 com duas falências → três linhas na ordem certa; vencedor em 1º; eliminado mostra rodada da queda; `partial` mostra o aviso e nenhuma posição inventada; duração ausente aparece como indisponível, nunca como `0ms`.
- [ ] **T015** `e2e/` **manual**: rodar `?players=2`, levar até a falência e conferir a tela na interface real. (Automatizado na Fase 7.)

**Checkpoint**: **SC-004**, **SC-005**, **SC-006** provados headless. US2 fechada.

---

## Fase 3 — Vocabulário de movimento (US5)

**Meta**: um lugar decide duração, curva e freio. Vem **antes** da acessibilidade porque as duas frentes tocam `shell.tsx`.

- [x] **T016** [P] `src/index.css`: tokens `--motion-fast/base/slow`, `--ease-standard/emphasis`; bloco `@media (prefers-reduced-motion: reduce)` zerando as durações ([D7 do plan](./plan.md#d7--vocabulário-de-movimento-tokens-em-css--motionts-freio-embutido)).
- [x] **T017** [P] `src/game/ui/motion.ts` (FR-021, FR-028): mesmos números em TS + variantes `fade`/`pop`/`slideUp` + `useMotion()` que consulta `useReducedMotion` e devolve variantes já freadas.
- [x] **T018** [test-first] `tests/ui/motion.test.tsx`: `useMotion()` devolve duração zero com movimento reduzido ativo e as durações do vocabulário sem ele; as variantes exportadas usam exclusivamente os tokens (nenhum número mágico).
- [x] **T019** Migrar as animações existentes para o vocabulário: `shell.tsx` (`Overlay`, `ModalShell`), `GameHUD` (fim de jogo), `ModalLayer`, `TradeLayer`, `LandAuctionLayer`, `HandCardLayer`, `NoticeLayer`, `boards/shared.tsx`, `LiveTokens`. Os 7 usos avulsos de `useReducedMotion` passam a vir de `useMotion()`.
- [x] **T020** [US5] Feedback de mudança material que hoje não existe (FR-029): transferência de posse na célula e delta de caixa nas linhas que ainda não têm. Reusar o que o `PlayerRow` já faz — não inventar linguagem nova.
- [x] **T021** [test-first] `tests/ui/motion.test.tsx` (caso adicional; FR-031, FR-032 — nenhum prazo, comando ou decisão espera animação): com movimento reduzido, o **fato** continua no DOM (resultado do dado, novo dono, novo saldo) — o que some é a transição, não a informação (FR-030).

**Checkpoint**: **SC-011** provado headless. Nenhum `transition={{ duration: … }}` com número literal sobrou no caminho de jogo.

---

## Fase 4 — Acessibilidade (US3)

**Meta**: o caminho de jogo inteiro operável por teclado, anunciado, com contraste e alvos.

- [x] **T022** [test-first] `tests/ui/a11y/modalFocus.test.tsx`: modal abre → foco entra; `Tab`/`Shift+Tab` circulam dentro; fechar devolve o foco a quem abriu; `dismissible` ausente → Esc **não** fecha; `dismissible` presente → Esc fecha (FR-013, FR-014).
- [x] **T023** `src/game/ui/shell.tsx`: `Overlay` ganha `role="dialog"`, `aria-modal`, `aria-labelledby` (ligado ao `ModalHeader`), foco inicial, trap, restauração e `dismissible = false` por padrão ([D4 do plan](./plan.md#d4--o-trap-de-foco-entra-no-shelltsx-não-em-cada-modal)).
- [x] **T024** Marcar `dismissible` nas camadas informativas (`NoticeLayer`, popovers) e **deixar sem** nas de decisão (`ModalLayer`, `TradeLayer`, `LandAuctionLayer`, `HandCardLayer`). Conferir cada modal do §12.2 contra a política.
- [x] **T025** [P] `src/index.css`: `:focus-visible` global com indicador de contraste próprio (≥3:1), nunca só cor; remoção de qualquer `outline: none` sem substituto (FR-012).
- [x] **T026** [P] `src/game/ui/a11y/LiveRegion.tsx` (FR-016): região `polite` alimentada pela última entrada do log via `describeLogEntry` (040) + canal `assertive` para "sua vez", prazo vencendo e comando recusado. Envolvida por `AccessoryErrorBoundary` — `describeLogEntry` lança por exaustividade ([D5 do plan](./plan.md#d5--a-região-viva-reusa-a-frase-do-log-tipado-040-não-inventa-texto)).
- [x] **T027** `src/App.tsx`: montar `<LiveRegion/>` junto das camadas existentes.
- [x] **T028** [test-first] `tests/ui/a11y/liveRegion.test.tsx`: entrada nova no log → anúncio educado com a mesma frase da tela; início do meu turno → canal assertivo; `kind` desconhecido → a fronteira acessória contém e a partida segue (não repetir o bug da 040).
- [x] **T029** Nomes acessíveis (FR-015): varredura de ícones e imagens em `boards/glyphs/**`, `game/ui/icons.tsx`, `PlayerFace`, `SquareIcon` — significado ganha nome, decoração ganha `aria-hidden`.
- [x] **T030** Segundo canal além da cor (FR-018): posse de propriedade, jogador da vez, raridade de carta e status de conexão. Onde já existe (raridade tem rótulo), confirmar; onde não existe, acrescentar.
- [x] **T031** Contraste (FR-017), alvos ≥24 px (FR-019) e zoom a 200% sem perda de função (FR-020) no caminho de jogo — auditar com a ferramenta da Fase 7 e corrigir os tokens de cor no `index.css`, não caso a caso.
- [x] **T032** Ordem de tabulação e alcance por teclado no tabuleiro: casas focáveis com nome, HUD e painéis navegáveis, sem armadilha (FR-011).

**Checkpoint**: percorrer home → lobby → partida → decisão → fim **só com teclado**, à mão. **SC-007** e **SC-009** verificados manualmente; o gate automatizado chega na Fase 7.

---

## Fase 5 — Responsividade (US4)

**Meta**: paisagem em 740 × 360 e 1024 × 768; retrato pede para girar sem perder a sessão.

- [ ] **T033** [P] `src/game/ui/OrientationGate.tsx`: tela de "gire o aparelho" **por cima** da árvore, sem desmontar nada ([D6 do plan](./plan.md#d6--retrato-é-uma-tela-acima-da-árvore-não-um-layout-alternativo)). Acessível pelas mesmas regras da Fase 4.
- [ ] **T034** `src/App.tsx`: montar o `OrientationGate` em volta — **acima** do `OnlineGate`, nunca dentro, ou girar viraria saída da sala.
- [ ] **T035** [test-first] `tests/ui/orientationGate.test.tsx`: retrato abaixo do limiar → aviso visível e árvore de jogo **ainda montada**; voltar a paisagem → aviso some e nada remontou (nenhum efeito de sessão disparou).
- [ ] **T036** `src/index.css` (`.board-stage`, `.board-frame`, `.side-panel`; FR-023): faixa de paisagem estreita — painéis viram gaveta alcançável em vez de coluna fixa (FR-024); tabuleiro continua limitado pela menor dimensão; nada de rolagem horizontal (FR-025).
- [ ] **T037** Modais rolam por dentro na viewport mínima, com os botões sempre alcançáveis (FR-026) — no `ModalShell`, uma vez.
- [ ] **T038** [manual] Percorrer o caminho de jogo em 740 × 360 e 1024 × 768 (paisagem) e girar no meio de uma partida em curso.

**Checkpoint**: **SC-010** verificado.

---

## Fase 6 — Telemetria (US6)

**Meta**: saber se as partidas terminam, sem saber quem jogou.

- [ ] **T039** [P] [test-first] `tests/telemetry/port.test.ts`: os 5 casos do [contrato](./contracts/telemetry-port.md#testes-obrigatórios-teststelemetry).
- [ ] **T040** [P] `src/telemetry/port.ts` (FR-040): interface `Telemetry`, união fechada de eventos, `nullTelemetry`. **Sem campo livre** — a união é o mecanismo de privacidade.
- [ ] **T041** [P] `src/telemetry/matchKey.ts`: `SHA-256(roomId + BUILD_SALT)` truncado, via `crypto.subtle`.
- [ ] **T042** `src/telemetry/supabaseSink.ts`: insert-only na tabela nova, falha engolida, sem retentativa (T1/T2 do contrato).
- [ ] **T043** `src/telemetry/index.ts`: `resolveTelemetry()` — sem env ou em `DEV`, `nullTelemetry` (FR-038).
- [ ] **T044** `supabase/migrations/0003_telemetry_events.sql`: tabela conforme [data-model §3](./data-model.md#3-telemetria--telemetry_events), RLS com insert anônimo e **sem** política de select.
- [ ] **T045** `src/net/host.ts` e `src/net/roomSession.ts` (FR-033, FR-034): emitir `room_created`, `match_started`, `match_ended`, `match_paused` — **do lado da autoridade**, uma vez por fato (T7 do contrato).
- [ ] **T046** [test-first] `tests/telemetry/emission.test.ts`: com transporte local e dois clientes, cada fato gera **um** evento (não um por cliente); falha do sink não altera o estado da partida nem bloqueia comando (FR-037).
- [ ] **T047** `src/telemetry/sentry.ts`: init condicional a `VITE_SENTRY_DSN`; assina o `failureRegistry` da 042; `beforeSend` com **lista de permissão** de campos; `sendDefaultPii: false`.
- [ ] **T048** `src/app/failureRegistry.ts`: ponto de assinatura para o ouvinte (a 042 continua sendo a fonte única do `occurrenceId`) — mudança aditiva, sem alterar contenção, loop-breaker nem tela de falha.

**Checkpoint**: **SC-012** e **SC-013** provados headless. Sem env, nenhuma requisição sai.

---

## Fase 7 — Provas e gates (US7 + FR-022)

**Meta**: o que as fases 1–6 conquistaram para de regredir sozinho.

- [ ] **T049** `e2e/script.ts`: hook de cenário semeado `?scenario=endgame` — estado **legal** perto do fim, passando pelos mesmos reducers ([D10 do plan](./plan.md#d10--partida-completa-no-gate-é-partida-semeada-e-isso-é-honesto)). Mesmo tipo de andaime que `?players=N` (036).
- [ ] **T050** [US7] `e2e/fullMatch.spec.ts`: conduz pela interface real até a última falência, confere `phase: ended`, a classificação, a ordem, o patrimônio e a duração (FR-050).
- [ ] **T051** [US3] `e2e/a11y.spec.ts`: `@axe-core/playwright` em cada parada do caminho de jogo — home, lobby, tabuleiro, modal de compra, modal de leilão, pausa, fim de jogo. Falha em `serious`/`critical`; reporta `moderate`/`minor` sem quebrar ([D9 do plan](./plan.md#d9--auditoria-de-acessibilidade-precisa-de-partida-em-curso-então-mora-no-playwright)).
- [ ] **T052** `playwright.config.ts`: projeto que roda contra a **versão construída** (`vite preview`), não só o dev server (FR-051).
- [ ] **T053** `e2e/multiplayer.spec.ts`: entra no gate quando há credenciais; sem segredo disponível, é **pulado com aviso visível**, nunca em silêncio (FR-052 + Assumptions).
- [ ] **T054** `e2e/`: limpeza das salas criadas pelos roteiros ao final (FR-054).
- [ ] **T055** `.github/workflows/ci.yml`: jobs novos `a11y` e `full-match` (sobre o build), com `upload-artifact` em falha (FR-053), no mesmo padrão do job `e2e` existente.
- [ ] **T056** `package.json`: `@axe-core/playwright` e `@sentry/react` como dependências; **respeitar o `bun.lock`** (nada de segundo lockfile).

**Checkpoint**: **SC-008** e **SC-014** provados. O CI agora reprova o que esta spec conserta.

---

## Fase 8 — Publicação (US1)

**Meta**: existe uma URL, e nada quebrado chega nela.

- [ ] **T057** [P] `vercel.json` (FR-046): fallback de SPA; `Cache-Control: no-cache` no `index.html` e `immutable` em `/assets/*` ([D11 do plan](./plan.md#d11--o-deploy-é-disparado-pelo-resultado-do-ci-não-pelo-push)).
- [ ] **T058** [P] `src/lib/env.ts` (ou equivalente): validação das variáveis obrigatórias em tempo de build — ausência **falha** a construção com mensagem clara (FR-047).
- [ ] **T059** `VITE_COMMIT_SHA` no build e exibido no rodapé da home + contexto do Sentry (FR-048).
- [ ] **T060** `.github/workflows/deploy.yml`: `workflow_run` encadeado ao CI, `branches: [main]`, sai cedo se `conclusion != success`; `vercel build --prod` + `vercel deploy --prebuilt --prod` com os três segredos.
- [ ] **T061** [manual] Painel Vercel (FR-042): projeto ligado ao repositório, previews de PR pela integração nativa, env vars de Production e Preview.
- [ ] **T062** [manual] (FR-045) Aplicar as **três** migrations em produção e rodar as quatro verificações do [runbook §1](./contracts/production-runbook.md#1-migrations--antes-do-primeiro-deploy). É a pendência aberta desde a 037.
- [ ] **T063** `docs/RUNBOOK.md`: escrever conforme [contracts/production-runbook.md](./contracts/production-runbook.md).
- [ ] **T064** [manual] Primeiro lançamento + teste de fumaça do runbook §3, em dois dispositivos e redes diferentes (**SC-001**, **SC-002**).
- [ ] **T065** [manual] Ensaiar o **retorno** uma vez (promover o deploy anterior e voltar) — um runbook de rollback nunca executado não é um runbook (**SC-003**).

**Checkpoint**: **SC-001**, **SC-002**, **SC-003** verificados em produção real.

---

## Fase 9 — Fechamento

- [ ] **T066** `docs/MILESTONES.md`: marcar o M4 concluído, com a nota do que ficou fora (celular retrato, estatísticas narrativas).
- [ ] **T067** `docs/PRD.md`: E16 de "NÃO COMEÇOU" para entregue; remover a pendência "aplicar a migration" do E15, que esta spec fecha.
- [ ] **T068** `CLAUDE.md` (§2 Fase atual) e o bloco `SPECKIT` do rodapé: apontar para esta spec.
- [ ] **T069** Revisar se algum FR ficou sem prova; qualquer um que tenha ficado vira tarefa nova aqui, não nota de rodapé.

---

## Riscos conhecidos

| Risco | Sinal | Resposta |
|---|---|---|
| **A Fase 1 regride o motor** | qualquer teste de `tests/game/**` vermelho | é a fase que roda sozinha justamente para isso — reverter o campo, não "ajustar o teste" |
| **`round` conta errado com eliminação no meio da volta** | T003 vermelho em mesa de 6 | a definição é "a busca deu a volta", não "N turnos" (D1) |
| **A auditoria de a11y vira negociação** | alguém propõe rebaixar `serious` para aviso | o gate falha em `serious`/`critical` por decisão (D-039); rebaixar exige ADR nova |
| **A partida semeada do gate esconde regressão real** | o gate passa e o produto quebra numa partida de verdade | o `sim:batch` continua rodando partidas inteiras no motor; o gate de UI prova o **caminho**, e o `log()` diz isso |
| **Deploy publica `index.html` velho** | tela branca em produção com tudo verde | é exatamente o que a política de cache do `vercel.json` evita (D11) — verificar no primeiro lançamento |
| **Migration aplicada fora de ordem** | `rooms` sem gatilho, ou telemetria antes de `rooms` | runbook §1 fixa a ordem e a verificação (D12) |
| **Telemetria vaza credencial** | `roomId` legível num evento | T3/T4 do contrato são teste, não convenção |

---

## Fase 5b — Comando não espera animação (FR-031, FR-032)

**Origem**: achados da Fase 3. O agente que migrou o vocabulário de movimento encontrou dois pontos onde a lógica de jogo **já dependia** de animação, anteriores a esta spec. Não foram consertados lá porque a Fase 3 tinha escopo fechado; são violação direta de FR-031/FR-032 e precisam cair dentro desta spec.

- [ ] **T070** `src/game/ui/modals/ModalLayer.tsx` (`BusLine`, `embark()`): o dispatch de `use-bus-ticket` é atrasado em `setTimeout(…, 560)` para "esperar o ônibus chegar visualmente" — comando de jogo esperando animação (FR-031). Separar as duas coisas: o comando sai imediatamente, a animação de embarque acontece por cima do estado já avançado. Sob movimento reduzido, nenhuma espera.
- [ ] **T071** `src/boards/shared.tsx` (`ROLL_DURATION_MS`, `useDieAnimation`, `DiceArena`): a flag `rolling` de `tokenAnim` fica presa a 1050 ms fixos, independente de `prefers-reduced-motion` — o peão não anda e o botão não volta antes disso (FR-032). Derivar a duração do vocabulário (`motion.ts`) e zerá-la sob movimento reduzido, **preservando o handshake `rolling`/`animating`** com `GameDriver` (o modal de compra não pode abrir antes do peão chegar).
- [ ] **T072** [test-first] Prova de que, sob movimento reduzido, o comando de Bus Ticket é despachado sem espera e o peão anda assim que o dado para — e de que o handshake com `GameDriver` continua valendo nos dois modos.
