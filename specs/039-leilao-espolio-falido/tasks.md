# Tasks: Leilão do espólio do falido-ao-banco

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Contrato**: [contracts/estate-auction.md](./contracts/estate-auction.md)

Legenda: `[P]` = paralelizável (arquivo independente) · `[USn]` = user story da spec. Ordem = dependência técnica.

**Testes**: obrigatórios e **test-first** onde a task muda comportamento já provado. A falência tem suíte madura (`tests/game/falencia/`) e o pregão também (`tests/game/economy/landAuction.test.ts`) — esta fatia mexe no ponto de encontro dos dois, que é exatamente onde uma regressão passaria calada.

**A promessa a vigiar**: `placeLandBid`, `committedCash`, `settleLot`, `closeExpiredLandLots` e `closeLandAuction` terminam a spec **sem um caractere alterado**. Se alguma precisar mudar, parar e revisar o desenho antes de continuar.

---

## Fase 1 — O tipo e o abridor (bloqueia todas as US)

- [ ] **T001** `src/game/economy/types.ts`: novo `AuctionOrigin = 'scarcity' | 'bankruptcy' | 'mixed'`; `LandAuction` ganha `origin: AuctionOrigin` e `bankruptId: string | null`. `LandLot` **inalterado** (research R5).
- [ ] **T002** `src/game/economy/landAuction.ts`: `maybeOpenLandAuction` passa a preencher `origin: 'scarcity'` e `bankruptId: null` na abertura. Nenhuma outra linha da função muda.
- [ ] **T003** `tests/game/economy/landAuction.test.ts`: os casos existentes continuam verdes; acrescentar que o pregão de escassez nasce com `origin: 'scarcity'` e `bankruptId: null`.
- [ ] **T004** `tests/game/economy/landAuction.test.ts` **[test-first, antes de T005]**: contrato de `openEstateAuction` conforme [contracts/estate-auction.md](./contracts/estate-auction.md) — pregão fechado abre com `origin: 'bankruptcy'`; espólio vazio é no-op; menos de 2 vivos é no-op; `claimed` reflete o que foi aceito.
- [ ] **T005** `src/game/economy/landAuction.ts`: `openEstateAuction(state, positions, now, bankruptId) → { state, claimed }` com as 4 guardas na ordem do contrato. **Não** tocar `landAuctionArmed`.

**Checkpoint**: o abridor existe e é testado isoladamente, sem ninguém chamá-lo ainda.

---

## Fase 2 — US1: o espólio vai a leilão (P1) 🎯 MVP

**Meta**: nenhuma propriedade de falido-ao-banco perde o dono sem passar por pregão.

- [ ] **T006** [US1] `tests/game/falencia/espolio.test.ts` **[test-first]** [P]: o gatilho. Insolvente devendo **ao banco**, 3 propriedades, ≥2 vivos → pregão com exatamente essas 3 (FR-001/003). Caixa do falido **não** entra no espólio (FR-004). Eliminação, caixa zerado e vez passada seguem como hoje (FR-014).
- [ ] **T007** [US1] `tests/game/falencia/espolio.test.ts` **[test-first]** [P]: as guardas de NÃO abrir — dívida com credor-jogador (FR-002), empréstimo ativo (§9.3 precede), espólio vazio (FR-005), menos de 2 vivos após a eliminação (FR-006). Nos quatro casos, comportamento **idêntico ao atual**.
- [ ] **T008** [US1] `src/game/falencia/falencia.ts`: implementar os 6 passos do "Contrato do chamador" — coletar em vez de zerar quando `heirId === null`, chamar `openEstateAuction` **depois** de marcar `eliminated`, e zerar `ownerId` das posições **não** reivindicadas (o caminho de recusa cai no comportamento antigo, sem limbo).
- [ ] **T009** [US1] `tests/game/falencia/falencia.test.ts`: revisar as asserções existentes. As que afirmam que a propriedade volta **sem dono** ao banco no caso sem herdeiro passam a afirmar que ela virou **lote** — é a única reescrita de asserção que SC-004 autoriza. As de herança (§9.3 / credor-jogador) **não podem** mudar.
- [ ] **T010** [US1] `tests/game/falencia/espolio.test.ts`: fecho ponta a ponta — lote de espólio com lance fecha pagando **ao banco** e transferindo a escritura (FR-010); lote sem lance fica **livre** (FR-011). Reusa `placeLandBid`/`closeExpiredLandLots` sem alterá-las.

**Checkpoint**: SRS §9.2 cumprido. É o MVP e a spec pode parar aqui.

---

## Fase 3 — US2: o espólio entra no pregão aberto (P2)

- [ ] **T011** [US2] `tests/game/economy/landAuction.test.ts` **[test-first]**: pregão de escassez com 2 lotes + espólio de 3 → 5 lotes; prazos dos 2 preexistentes **idênticos** aos de antes (FR-016); `bidders` recalculado sem o recém-falido (FR-017); `origin` promovida a `'mixed'` (FR-020); `landAuctionArmed` intacto (FR-018).
- [ ] **T012** [US2] `src/game/economy/landAuction.ts`: o ramo de injeção de `openEstateAuction`.
- [ ] **T013** [US2] `tests/game/economy/landAuction.test.ts`: **FR-019** — posição que já é lote não entra de novo. A interseção deveria ser vazia hoje (lote de escassez é propriedade sem dono; espólio só produz propriedades que **tinham** dono), e este teste existe para o dia em que deixar de ser (nota da checklist da spec).
- [ ] **T014** [US2] `tests/game/economy/landAuction.test.ts`: segundo espólio entrando no pregão de um primeiro espólio — `origin` fica `'bankruptcy'`, `bankruptId` passa a nomear o mais recente (data-model).

---

## Fase 4 — US3: a mesa entende o que está sendo leiloado (P3)

- [ ] **T015** [US3] `src/game/ui/landAuction/LandAuctionLayer.tsx`: título por `origin` — escassez / espólio (nomeando o falido) / ambos. Nome via `identityOf` da 038, com fallback sem sala (FR-021). **Sem camada nova** (plan D6).
- [ ] **T016** [US3] `src/game/commands.ts`: corrigir o comentário do `LAND_TRIGGERING`. Hoje ele justifica `declare-bankruptcy` dizendo que a falência devolve terreno ao banco — motivo que deixa de valer no caso sem herdeiro. A entrada **fica** (plan D5); o comentário passa a dizer o motivo verdadeiro.

---

## Fase 5 — Multiplayer e verificação

- [ ] **T017** `tests/net/espolio.test.ts`: sobre o `LocalHub` com 3 clientes — abertura do pregão do espólio e fecho dos lotes convergem **byte a byte** (SC-006/FR-022). É o teste que prova que o `now` do prazo passou pelo `ctx` e foi gravado/reproduzido pelo `recorder` (research R7).
- [ ] **T018** Confirmar que o lance no espólio já está preso ao assento local (FR-023). O `LandAuctionLayer` deriva o licitante de `local.seatId` desde a 038 e a origem não muda isso — **verificar, não reimplementar**; se estiver coberto, registrar aqui e não escrever teste redundante.
- [ ] **T019** Gates: `bunx vitest run`, `bunx tsc --noEmit -p tsconfig.app.json`, `bun run lint` (o CI exige lint zerado agora), `bun run build`.
- [ ] **T020** `bun run sim:batch -- --games=10 --counts=2,3,6 --report=`: confirmar `failed=0` e que o oráculo de conservação continua fechando (SC-007). Checar se a cobertura de `land-auction-close` **subiu** — se não subiu, o fuzzer não está alcançando o gatilho e isso é informação, não sucesso (research R8).
- [ ] **T021** `HANDOVER.md` + `docs/PRD.md`: registrar a 039 entregue e o E15 fechado.

---

## Dependências

- **Fase 1 bloqueia tudo.** Dentro dela: T001 → T002 → T005; T003/T004 são os testes que cercam.
- **US1 (Fase 2)** depende só da Fase 1 — é o MVP e pode parar aí.
- **US2 (Fase 3)** depende da Fase 1; independente da US1 no código, mas só faz sentido demonstrar depois dela.
- **US3 (Fase 4)** depende de US1+US2 existirem para ter as três origens para exibir.
- **T008 e T009 andam juntas**: T008 muda o comportamento que T009 reafirma. Rodar T006/T007 primeiro (test-first) é o que impede T008 de afrouxar o que a 008 já provava.

## Estratégia

Entregar **US1 primeiro** e rodar a suíte inteira: é a fatia que fecha o SRS, e é onde uma regressão em `§9.3`/credor-jogador seria mais caro descobrir tarde. US2 depois, porque é a única colisão de estado da feature. US3 por último — é informação, não mecânica.

O sinal de que o desenho está certo é negativo: as cinco funções do pregão terminam intactas e a suíte da 031 passa sem uma linha tocada.
