# Tasks: Feedback de jogatina e estados visíveis

**Spec**: [spec.md](./spec.md) · **Plano**: [plan.md](./plan.md)

Ordem por dependência. `[P]` = paralelizável com o vizinho. Cada correção de defeito começa por
um teste que falha **pela razão certa** (`/tdd`).

## Fase 0 — Regra (fora da spec, pré-requisito)

- [x] **T001** ADR `D-080-estatizacao-dura-uma-volta.md` + índice em `docs/adr/README.md`
- [x] **T002** `D-064` marcada como refinada pela D-080, só na duração
- [x] **T003** SRS 1.39 → **1.40**, §10.6 Estatização = 1 volta
- [x] **T004** Teste de regressão: nasce com `lapsRemaining: 1`, expira no 1º GO do originador,
      e GO alheio não conta
- [x] **T005** `effects.ts` cria com 1 volta; `cardMeta`, `mapCatalog`, `describeLog`,
      `resolveRentable`, `tempEffects`, `types.ts` e `logSemEfeito.test.ts` alinhados

## Fase 1 — Primitivas compartilhadas (destravam o resto)

- [ ] **T006** [P] `CountryFlag` com `fill` passa a **conter** (`xMidYMid meet`)
- [ ] **T007** [P] `CountryFlagDisc` deixa de ampliar 1,5× e usa `fill` — remove o transbordo
      ancorado à esquerda que comia a faixa direita
- [ ] **T008** Teste de geometria: para toda bandeira do catálogo, o SVG renderizado **cabe** na
      caixa do holder (sem `leftCut`/`rightCut`) nos quatro lados do tabuleiro
- [ ] **T009** `TitleOwnership` — primitiva única de posse (livre · dono · dono + hipotecada)

## Fase 2 — Posse de títulos (US1)

- [ ] **T010** `PropertyDeedContent` passa a usar `TitleOwnership`, inclusive o estado **livre**
- [ ] **T011** [P] `AirportPopover` ganha o bloco de posse
- [ ] **T012** [P] `UtilityPopover` ganha o bloco de posse
- [ ] **T013** [P] `MinePopover` ganha o bloco de posse (sem tocar na regra da mina)
- [ ] **T014** Teste: as quatro superfícies apresentam posse nos três estados, nos dois mapas

## Fase 3 — Reação registrada (US2)

- [ ] **T015** Teste vermelho: usar Diplomacia não produz fato no log
- [ ] **T016** `reaction-blocked` na união `LogEntry` + `ALL_LOG_KINDS`
- [ ] **T017** `respondReaction` emite o fato **só** no ramo `use`
- [ ] **T018** `describeLogEntry` compõe a frase (reator, atacante, efeito, alvo)
- [ ] **T019** `logKey` e `classifyLogEntry` tratam a espécie; o classificador devolve `null`
      (o cue `reaction` já toca na abertura da janela)
- [ ] **T020** Teste: recusar produz narrativa distinta; usar produz **um** fato; nada é
      registrado antes do uso

## Fase 4 — Empréstimos sempre visíveis (US3)

- [ ] **T021** Teste vermelho: empréstimo entre adversários some quando a vez é de um terceiro
- [ ] **T022** `loansView` — projeção da lista **inteira**, com `mostUrgent` e autorização local
- [ ] **T023** Resumo compacto na área de jogadores
- [ ] **T024** Detalhe em `ModalShell`/`Overlay` com todos os fatos do §15
- [ ] **T025** Ação de quitar só para o devedor local, atrás de `mayActAction`
- [ ] **T026** Teste: N empréstimos simultâneos, um por devedor, todos visíveis a todos

## Fase 5 — Imunidades com escopo (US4)

- [ ] **T027** `immunityView` — separa por propriedade × total temporária
- [ ] **T028** Resumo compacto na linha do jogador (contagem, não booleano)
- [ ] **T029** Detalhe por toque, clique e teclado — sem `title`, sem hover
- [ ] **T030** Teste: permanente lê "permanente"; concedente aparece só quando existe

## Fase 6 — Efeitos ativos (US5)

- [ ] **T031** `effectsView` — nome, sujeito, lugar, alcance, duração, consequência
- [ ] **T032** `effectRow` passa a receber a sala e resolver identidade
- [ ] **T033** Painel consome o display model; plural correto em "1 volta"
- [ ] **T034** Teste: Estatização (mesa), Embargo (jogador nomeado), Boicote (propriedade),
      Valorização — todos com alcance e duração vindos do estado

## Fase 7 — Pregão (US6, US7)

- [ ] **T035** Teste vermelho: com relógio deslocado, o lote exibe mais que a janela
- [ ] **T036** `readLot` consome `clockOffsetMs` e fecha o valor dentro da janela
- [ ] **T037** Teste: lance válido reinicia **só** o lote dele; repetido/inválido não amplia;
      nunca negativo, nunca retrocede
- [ ] **T038** Layout do lote estável com nome longo e maior licitante longo
- [ ] **T039** Ícones equivalentes da Fuligem no mesmo tratamento

## Fase 8 — Som de negociação (US8)

- [ ] **T040** Script determinístico que sintetiza `trade-open` (obra própria)
- [ ] **T041** `trade-open` na união `SoundCue` + asset em `src/assets/sfx/`
- [ ] **T042** Disparo na transição `false → true` de `useTradeUI.open`
- [ ] **T043** Documentar origem e licença em `README.md` e `SOUND-DESIGN.md`
- [ ] **T044** Teste: uma vez por abertura; zero em re-render, reconexão e replay

## Fase 9 — Andaimes determinísticos

- [ ] **T045** `?scenario=emprestimos` — vários empréstimos entre pares distintos
- [ ] **T046** `?scenario=estados` — imunidades das duas naturezas + efeitos variados
- [ ] **T047** Casos novos do Laboratório Visual (títulos livre/comprado/hipotecado, pregão de 6)

## Fase 10 — Responsividade e acessibilidade (US9)

- [ ] **T048** Matriz de viewports nas áreas alteradas — sem rolagem horizontal
- [ ] **T049** Alvos ≥44 px nos controles novos
- [ ] **T050** `e2e/pregao.spec.ts` estendido (relógio, layout, bandeiras)
- [ ] **T051** `e2e/responsive.spec.ts` estendido (resumo, modal, popovers)
- [ ] **T052** axe sem violações serious/critical nas telas alteradas
- [ ] **T053** Screenshots antes/depois + rodada de crítica visual

## Fase 11 — Gates e entrega

- [ ] **T054** `bun run lint`, `bun run typecheck`, `bunx vitest run`, `bun run build`
- [ ] **T055** Playwright focado (pregão, responsivo, a11y)
- [ ] **T056** Commits emoji + conventional, em série coerente
- [ ] **T057** Push em `main`, CI verde, deploy automático acompanhado
