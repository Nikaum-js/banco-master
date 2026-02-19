# Feature Specification: Leilão de escassez de terrenos (pregão simultâneo)

**Feature Branch**: `031-leilao-escassez-terrenos`

**Created**: 2026-05-25

**Status**: Draft

**Input**: User description: "Leilão de escassez de terrenos — quando sobram poucos terrenos sem dono no tabuleiro, eles vão a um pregão automático (simultâneo), disparado quando restam ≤3 terrenos compráveis sem dono e há ≥2 jogadores vivos; cada terreno é um leilão inglês próprio, fechando todos juntos por cronômetro; um jogador pode arrematar vários, limitado pelo caixa; sem lance, o terreno fica livre."

> ⚠️ **Não confundir** com o antigo *leilão de casas em escassez* (SRS §5.4 / spec 026), **removido na [D-022](../../docs/DECISIONS.md)**. Aquele leiloava peças de construção (casas), que hoje são ilimitadas. **Este** leiloa **terrenos** (cidades/aeroportos/utilidades sem dono), que são finitos por natureza.

## User Scenarios & Testing *(mandatory)*

Perto do fim de uma partida, quase todos os terrenos já têm dono — sobram uns poucos que ninguém comprou (porque ninguém parou neles). O jogo tende a se arrastar esperando alguém *cair* por acaso nesses últimos lotes. Para resolver isso com um clímax, quando restam **3 ou menos terrenos sem dono** o jogo abre, automaticamente, um **pregão de escassez**: um modal mostra os terrenos restantes e todos os jogadores disputam-nos **ao mesmo tempo**, cada um com seu lance. Quando o pregão encerra (cronômetro sem lances novos), quem está na frente de cada terreno paga ao banco e leva a escritura. O tabuleiro fecha (quase) todo com dono → mais aluguel circulando → fim de jogo mais rápido.

### User Story 1 - Pregão automático dos últimos terrenos (Priority: P1) 🎯 MVP

Como jogador, quando restam ≤3 terrenos sem dono e há ao menos 2 jogadores vivos, o jogo abre **sozinho** um pregão simultâneo por esses terrenos; cada um é disputado em paralelo; ao encerrar por inatividade (cronômetro), quem lidera cada terreno paga ao banco e recebe a escritura.

**Why this priority**: É a feature inteira (gatilho → pregão simultâneo → fechamento → transferência). Sem ela não há pregão de escassez. Testável pelos reducers do evento, sem renderizar a UI.

**Independent Test**: Montar um estado com exatamente ≤3 terrenos sem dono e ≥2 jogadores vivos; verificar que o pregão abre automaticamente com esses terrenos; dar lances válidos em terrenos distintos; expirar o cronômetro e confirmar que cada líder paga ao banco e recebe a escritura, que terrenos sem lance ficam livres, e que o turno em andamento **não** muda.

**Acceptance Scenarios**:

1. **Given** restam 3 terrenos sem dono e há ≥2 jogadores vivos, **When** o evento que tirou o último terreno de circulação se resolve (compra ou recusa-leilão), **Then** abre automaticamente um pregão com os 3 terrenos, cada um com lance inicial zero e sem maior licitante, e todos os jogadores vivos como participantes.
2. **Given** um pregão de escassez aberto, **When** um jogador cobre o lance de um terreno (≥ lance mínimo do tema e maior que o lance atual daquele terreno) dentro da trava de solvência, **Then** o lance atual e o maior licitante **daquele terreno** são atualizados e **só o prazo daquele terreno** reinicia (os demais não mudam).
3. **Given** um lance que não supera o atual do terreno, ou abaixo do lance mínimo, **When** tento dar, **Then** é rejeitado (nada muda, prazo não reinicia).
4. **Given** terrenos com líderes e prazos diferentes, **When** o prazo de um terreno expira sem novo lance, **Then** **aquele terreno** é transferido ao maior lance (vencedor paga ao banco e recebe a escritura) — ou fica livre se não teve lance — **sem afetar** os terrenos cujo prazo ainda corre; o pregão fecha quando o último terreno fecha.
5. **Given** um pregão aberto ou encerrado, **When** observo o turno do jogador da vez, **Then** o estado do turno permanece **inalterado** (o pregão é evento à parte).
6. **Given** que sobram ≤3 terrenos mas só há **1** jogador não-eliminado, **When** a contagem chega a ≤3, **Then** o pregão **não** abre (sem disputa possível).

---

### User Story 2 - Arrematar vários terrenos com trava de caixa (Priority: P2)

Como jogador, posso liderar e arrematar **mais de um** dos terrenos em disputa, desde que eu consiga pagar por todos — o sistema me impede de me comprometer com mais do que tenho em caixa.

**Why this priority**: É a regra que torna o pregão simultâneo coerente (sem ela, um jogador "ganharia" terrenos que não pode pagar). Independentemente testável pela validação do lance.

**Independent Test**: Com um jogador de caixa conhecido, fazê-lo liderar o terreno A; tentar liderar o terreno B com um valor que, somado ao lance líder em A, excede o caixa → rejeitado; reduzir o lance pretendido ou ser coberto em A → o mesmo lance em B passa a ser aceito; ao fechar, confirmar que ele paga a soma dos terrenos que arrematou e que o caixa nunca fica negativo.

**Acceptance Scenarios**:

1. **Given** um jogador é o maior licitante do terreno A por X, **When** ele tenta cobrir o terreno B por Y com `X + Y > caixa`, **Then** o lance em B é rejeitado.
2. **Given** o mesmo cenário com `X + Y ≤ caixa`, **When** ele cobre B por Y, **Then** o lance é aceito e ele lidera A e B simultaneamente.
3. **Given** um jogador líder de A e B, **When** outro jogador o cobre em A (liberando o caixa comprometido), **Then** o caixa disponível dele para novos lances aumenta de volta.
4. **Given** um jogador que arrematou 2 terrenos ao fechar, **When** o pregão encerra, **Then** ele paga a soma dos dois lances ao banco e o caixa resultante é ≥ 0.

---

### User Story 3 - Pregão na tela (modal) (Priority: P3)

Como jogador, vejo um modal do pregão com **todos** os terrenos em disputa (nome/grupo, lance atual, maior licitante), o tempo restante, e consigo dar lance em qualquer um deles; no modo single-client, escolho **por qual jogador** estou dando o lance.

**Why this priority**: A lógica (US1/US2) é jogável e testável pelos reducers sem a UI; o modal é o acabamento que torna o pregão utilizável de fato. Depende de US1/US2.

**Independent Test**: Validar no `bun run dev` que o modal aparece sozinho ao atingir o gatilho, mostra os terrenos restantes com lance/maior licitante e o cronômetro, permite escolher o licitante e dar lance em cada terreno, e some ao encerrar.

**Acceptance Scenarios**:

1. **Given** o pregão abriu, **When** o modal renderiza, **Then** mostra cada terreno em disputa (nome/grupo + lance atual + maior licitante) e o tempo restante.
2. **Given** o modo single-client, **When** vou dar um lance, **Then** posso escolher por qual jogador (vivo) estou licitando.
3. **Given** o cronômetro expira, **When** o pregão fecha, **Then** o modal desaparece e os resultados (quem levou o quê) ficam refletidos no tabuleiro/painéis.

---

### Edge Cases

- **Contagem "pula" 3:** o gatilho é **≤ 3** (não "== 3") — se uma compra/leilão leva a contagem de 4→2 de uma vez, ainda dispara.
- **Falência devolve terreno ao banco:** a contagem de livres sobe; quando voltar a cair a ≤3, **re-arma** um novo episódio de pregão (a trava de episódio só impede reabrir dentro do mesmo episódio).
- **Terreno sem nenhum lance:** permanece livre (com o banco); volta ao fluxo normal (cair-e-comprar / recusa-leilão) e **não** reabre o pregão sozinho.
- **Todos os terrenos sem lance:** o pregão fecha sem transferir nada; todos seguem livres.
- **Jogador sem caixa:** não consegue dar nenhum lance válido (trava de solvência); pode participar mas só observa.
- **Lance igual/menor que o atual do terreno, ou abaixo do mínimo:** rejeitado, cronômetro não reinicia.
- **Reconexão durante o pregão (Princípio VII):** o estado do pregão (terrenos, lances, líderes, prazo, participantes) sobrevive à recarga; o cronômetro é reconstruído a partir do `deadline`.
- **Empate de tempo / lance no último instante:** qualquer lance válido reinicia o cronômetro (soft-close), então não há "sniping" que ganhe sem dar chance de resposta.
- **Apenas 1 terreno restante (≤3 inclui 1 e 2):** o pregão abre com os terrenos que houver (1, 2 ou 3).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST **abrir automaticamente** um leilão de escassez quando o número de terrenos compráveis **sem dono** (cidades + aeroportos + utilidades) cai a **≤ 3** **e** há **≥ 2 jogadores não-eliminados**. A verificação MUST ocorrer após cada evento que tira terreno de circulação (compra e recusa-leilão da spec 003).
- **FR-002**: O leilão de escassez MUST ser um **evento próprio do estado do jogo**, independente da resolução de turno; abri-lo ou encerrá-lo **não** altera o estado do turno em andamento.
- **FR-003**: Ao abrir, o leilão MUST conter **todos** os terrenos sem dono no momento (no máximo os ≤3 do gatilho), cada um com lance inicial zero e sem maior licitante, e **todos os jogadores não-eliminados** como participantes.
- **FR-004**: O leilão MUST ser **simultâneo**: cada terreno em disputa é um leilão próprio, com **lance atual**, **maior licitante** e **prazo (`deadline`) próprios e independentes**.
- **FR-005**: O sistema MUST permitir **dar lance** indicando o licitante, o **terreno** e o valor. O lance só é aceito se: (a) o licitante é participante; (b) o valor é **≥ lance mínimo do tema** e **maior** que o lance atual **daquele terreno**; e (c) respeita a **trava de solvência** (FR-006).
- **FR-006** (trava de solvência): Um lance MUST ser aceito apenas se *(soma dos lances em que o licitante já é maior licitante nos **outros** terrenos) + (este lance) ≤ caixa do licitante*. Ser coberto em um terreno MUST liberar o caixa comprometido para novos lances.
- **FR-007**: Ao aceitar um lance válido, o sistema MUST atualizar o lance atual e o maior licitante **daquele terreno** e **reiniciar o prazo SÓ daquele terreno** (soft-close por lote). Um lance num terreno **não pode** alterar o prazo de outro.
- **FR-008** (fechamento por terreno): Cada terreno MUST ter seu **próprio prazo** (padrão 8s, tunável no tema); quando o prazo de um terreno expira **sem novo lance nele**, **aquele terreno** MUST fechar (independente dos demais). O leilão acaba quando o **último** terreno fecha.
- **FR-009**: Ao fechar **cada** terreno: havendo maior licitante, ele MUST **pagar seu lance ao banco** e **receber a escritura**. Terreno **sem** maior licitante MUST permanecer **livre** (com o banco). A soma paga por cada vencedor é coberta pelo caixa (garantido pela FR-006).
- **FR-010**: Quando não resta nenhum terreno em disputa, o leilão MUST ser **limpo** do estado (some).
- **FR-011** (trava de episódio): Dentro de um mesmo episódio (descida a ≤3), o leilão MUST disparar **uma única vez**. Terrenos que ficarem **sem lance** MUST voltar ao fluxo normal e **não** reabrir o pregão. Um **novo** episódio só pode disparar se a contagem de livres **subir** acima do limiar (ex.: falência devolve terreno ao banco) e **voltar** a cair a ≤3.
- **FR-012**: O estado do leilão (terrenos em disputa com lance/maior-licitante, prazo, participantes) MUST fazer parte do estado **persistível** e **serializável** do jogo (sobreviver a recarga — Princípio VII); o cronômetro MUST ser reconstruível a partir do `deadline`.
- **FR-013**: No **single-client**, a interface MUST permitir escolher **por qual jogador** (não-eliminado) o lance está sendo dado.
- **FR-014**: A lógica de abrir/lance/encerrar MUST ser derivável de forma **pura** (reducers do estado), para teste automatizado sem renderizar a interface.
- **FR-015**: As regras gerais de leilão do **SRS §7.2** MUST se aplicar (lance mínimo do tema, cada lance maior que o atual, sem lance → fica com o banco). O **lance mínimo** e a **duração do cronômetro** MUST reusar os knobs já existentes do leilão da spec 003 (tema); o **limiar de disparo** (=3) MUST ser um knob de tema **tunável**.
- **FR-016**: Todo texto visível MUST estar em **português (Brasil)**.

### Key Entities *(include if feature involves data)*

- **Leilão de escassez (evento)**: lista dos **terrenos em disputa** — cada um com *posição*, *lance atual*, *maior licitante* e **prazo (`deadline`) próprio** — e a lista de **participantes** (jogadores não-eliminados). Vive no estado do jogo como evento próprio (no máximo um por vez), **separado** da resolução de turno. Cada terreno fecha no seu prazo; quando o último fecha, o evento sai do estado.
- **Terreno comprável** (já existente — Title): cidade/aeroporto/utilidade com `ownerId`. "Sem dono" = `ownerId` nulo. Ao vencer um terreno, sua escritura passa ao vencedor (decremento da contagem de livres).
- **Caixa do jogador** (já existente): fonte da trava de solvência; debitado no fechamento pelo(s) lance(s) vencedor(es).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ao a contagem de terrenos livres cair a ≤3 com ≥2 jogadores vivos, o pregão abre **automaticamente** em 100% dos casos, contendo exatamente os terrenos livres do momento.
- **SC-002**: Lances inválidos (abaixo do mínimo, não maiores que o atual do terreno, ou que violam a trava de solvência) são rejeitados em 100% dos casos; lances válidos atualizam lance/maior-licitante do terreno e reiniciam o cronômetro.
- **SC-003**: Ao encerrar, todo vencedor paga a **soma** dos terrenos que arrematou e seu caixa resultante é **sempre ≥ 0** (a trava de solvência nunca permite arremate impagável).
- **SC-004**: Ao encerrar, cada terreno com licitante muda de dono (vai ao maior lance) e cada terreno sem lance continua livre; o pregão some do estado.
- **SC-005**: Abrir/encerrar o pregão nunca altera o estado do turno (0 efeitos colaterais no turno).
- **SC-006**: Dentro de um mesmo episódio o pregão dispara no máximo **1 vez**; só re-arma após a contagem subir acima do limiar e voltar a cair.
- **SC-007**: Os reducers do pregão (abrir/lance/fechar) são cobertos por testes automatizados, incluindo rejeição por solvência, fechamento sem lances e a trava de episódio.

## Assumptions

- **Terrenos compráveis** = os 35 lotes do tabuleiro (28 cidades + 4 aeroportos + 3 utilidades). Cantos, impostos, espaços de carta/Bus Ticket **não** entram na contagem.
- **Reuso do motor de leilão (003)**: o pregão segue as regras do §7.2 e reaproveita os knobs de **lance mínimo** e **duração do cronômetro** já definidos para o leilão de propriedade individual. O novo aqui é o **gatilho automático por escassez** e o **formato simultâneo** (vários terrenos, um prazo compartilhado, trava de solvência).
- **Cronômetro como fechamento**: decisão registrada com o usuário (em vez de "botão encerrar" ou "todos prontos"). Em single-client o tempo corre igual; em multiplayer cada cliente dá seus lances até o prazo expirar.
- **Pode arrematar vários**: decisão registrada com o usuário — sem limite de "1 por jogador"; a trava de solvência é o único limitador (mais livre, o líder paga caro por varrer). Aceita-se que tende a favorecer quem tem mais caixa (Princípio IV: catch-up segue discreto, sem destacar).
- **Sem lance → fica livre**: decisão registrada com o usuário — sem compra forçada (Princípio V); o terreno volta ao fluxo normal.
- **Parte testável**: os reducers do evento; o render do modal é validado no `bun run dev` (o projeto não tem testes de UI).
- **Documentação de verdade**: esta feature **adiciona** ao **SRS §7** (Leilão) um novo gatilho (escassez de terrenos) + subseção do pregão simultâneo, e registra um **ADR novo** em `docs/DECISIONS.md`. A spec apenas operacionaliza essas regras (Princípio I).
- **Dependências**: 003 (motor de leilão / compra / recusa-leilão / `Auction`/`deadline`), 008 (falência → terreno volta ao banco, re-arma episódio), 022 (modais centrais / padrão de evento autônomo na UI).
