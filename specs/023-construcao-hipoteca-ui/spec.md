# Feature Specification: UI de construção e hipoteca (M2) — gestão de propriedade pelo tabuleiro

**Feature Branch**: `023-construcao-hipoteca-ui`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "UI de construção e hipoteca — clicar a própria propriedade no tabuleiro abre o popover (carta do imóvel) com dados reais e ações: construir/vender casa, hangar, hipotecar/deshipotecar. Puramente UI sobre o motor 004/005/011."

## User Scenarios & Testing *(mandatory)*

Hoje o jogador compra propriedades, mas **não tem como construir casas nem hipotecar pela tela** — só via comandos internos. Quando clica numa casa do tabuleiro, abre um balão (a "carta do imóvel") que mostra dados de exemplo (mock) e nenhuma ação. Esta feature transforma esse balão na central de gestão da propriedade: ao clicar uma propriedade **sua**, o jogador vê os dados reais e pode **construir/vender** e **hipotecar/deshipotecar** dali mesmo, com cada ação habilitada apenas quando as regras do jogo permitem. As marcas de casas/hotel e de hipoteca passam a aparecer no tabuleiro de verdade. O motor de regras não muda — a tela apenas lê o estado e dispara as ações existentes.

### User Story 1 - Construir e vender na minha propriedade (Priority: P1) 🎯 MVP

Ao clicar uma cidade que é minha, vejo o nível atual de construção e posso subir um nível (casa → hotel → 2º hotel → arranha-céu) ou vender um nível, respeitando as regras (maioria do grupo, uniformidade, caixa, estoque do banco).

**Why this priority**: Construção é a principal alavanca de aluguel do jogo e hoje é inacessível pela UI. Sozinha já entrega o núcleo de valor da feature e é testável.

**Independent Test**: Dar a um jogador a maioria de um grupo, clicar uma de suas cidades e verificar que "Construir" sobe o nível (quando é a cidade de menor nível e há caixa/estoque) e "Vender" desce; verificar que a casa aparece no tabuleiro.

**Acceptance Scenarios**:

1. **Given** sou dono da maioria de um grupo sem hipotecas e tenho caixa, **When** clico a cidade do grupo de menor nível, **Then** o popover mostra "Construir" habilitado; ao acionar, o nível sobe 1 e o caixa é debitado pelo custo da casa.
2. **Given** uma cidade do grupo está num nível **maior** que outra do mesmo grupo, **When** clico a de nível maior, **Then** "Construir" fica **desabilitado** com a dica de construir primeiro na cidade de menor nível (uniformidade).
3. **Given** o banco não tem casas/hotéis/arranha-céus do tipo necessário, **When** abro o popover, **Then** "Construir" fica desabilitado indicando falta de estoque.
4. **Given** o nível-alvo é arranha-céu mas eu **não** tenho o grupo completo, **When** abro o popover, **Then** "Construir" (arranha-céu) fica desabilitado indicando que exige o grupo completo.
5. **Given** minha cidade tem ao menos 1 nível construído, **When** aciono "Vender", **Then** o nível desce 1 e recebo metade do custo da casa.
6. **Given** construí ou vendi, **When** a ação conclui, **Then** a marca de casas/hotel correspondente aparece/atualiza **na casa do tabuleiro**.

---

### User Story 2 - Hipotecar e deshipotecar (Priority: P2)

Ao clicar uma propriedade minha (cidade, aeroporto ou utilidade), posso hipotecá-la para levantar caixa, ou pagar para tirar a hipoteca — respeitando as regras (sem construção no grupo para hipotecar cidade; caixa suficiente para deshipotecar).

**Why this priority**: É a forma de levantar caixa para pagar dívidas e o complemento natural da construção. Depende do mesmo popover e seletor.

**Independent Test**: Clicar uma propriedade própria não-hipotecada sem construção no grupo e verificar que "Hipotecar" credita metade do preço e marca como hipotecada (e a marca aparece no tabuleiro); depois "Deshipotecar" cobra metade × 1,10 quando há caixa.

**Acceptance Scenarios**:

1. **Given** sou dono de uma propriedade não-hipotecada e (se cidade) sem construção no grupo, **When** aciono "Hipotecar", **Then** recebo metade do preço e a propriedade fica marcada como hipotecada (no popover e no tabuleiro).
2. **Given** uma cidade minha tem construção no grupo, **When** abro o popover, **Then** "Hipotecar" fica **desabilitado** (precisa vender as construções antes — §6.1).
3. **Given** uma propriedade minha está hipotecada e tenho caixa para metade × 1,10, **When** aciono "Deshipotecar", **Then** pago esse valor e a hipoteca sai.
4. **Given** estou hipotecada mas **sem** caixa para o resgate, **When** abro o popover, **Then** "Deshipotecar" fica desabilitado.

---

### User Story 3 - Hangar no meu aeroporto (Priority: P3)

Ao clicar um aeroporto meu, posso construir ou vender um Hangar, que dobra o aluguel daquele aeroporto.

**Why this priority**: Mecânica de tema menor e isolada; reaproveita o mesmo popover/ações. Independente das cidades.

**Independent Test**: Clicar um aeroporto próprio e verificar que "Construir Hangar" debita o custo e marca o hangar (e desabilita quando já há hangar / sem caixa / sem estoque); "Vender Hangar" devolve metade.

**Acceptance Scenarios**:

1. **Given** sou dono de um aeroporto sem hangar e tenho caixa, **When** aciono "Construir Hangar", **Then** o custo é debitado e o aeroporto passa a ter hangar.
2. **Given** o aeroporto já tem hangar, **When** abro o popover, **Then** "Construir Hangar" fica desabilitado e "Vender Hangar" habilitado (devolve metade).

---

### Edge Cases

- **Propriedade de outro dono ou livre**: o popover mostra apenas informação (aluguéis, preço, dono), **sem** nenhuma ação de gestão.
- **Não é minha vez**: como o motor gateia toda ação pelo jogador da vez, as ações só ficam habilitadas para o jogador ativo; para os demais (mesmo donos), o popover é informativo. (A janela natural de uso é antes de rolar ou durante uma dívida, para levantar caixa.)
- **Banco sem casas (escassez)**: "Construir" fica desabilitado por falta de estoque. O leilão de casas por escassez **não** é disparado por esta feature (ver Fora de Escopo).
- **Clique repetido / popover já aberto**: clicar outra casa troca o conteúdo; clicar fora ou Esc fecha (comportamento atual do popover preservado).
- **Ação que o motor recusa**: se por corrida de estado a ação não for válida, o motor a trata como no-op (nada muda); a UI reflete o estado resultante.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ao clicar uma propriedade no tabuleiro, o popover MUST exibir os **dados reais** do título: dono atual (ou "livre"), nível de construção (cidades), se está hipotecada, e a tabela de preço/aluguéis/custo de casa/valor de hipoteca — substituindo os dados de exemplo (mock) hoje usados.
- **FR-002**: O popover MUST exibir ações de gestão **somente** quando a propriedade pertence ao **jogador da vez**; para propriedade livre ou de outro jogador, exibe apenas informação.
- **FR-003**: A ação **Construir** MUST estar habilitada apenas quando o motor permite construir naquela cidade: dono + maioria do grupo + nada hipotecado no grupo + caixa suficiente + estoque do banco disponível + esta cidade é a de **menor nível** do grupo (uniformidade); arranha-céu exige grupo completo. Quando desabilitada, MUST indicar o motivo (ex.: uniformidade, estoque, grupo incompleto, caixa).
- **FR-004**: Acionar **Construir** MUST subir 1 nível no ladder (casa → hotel → 2º hotel → arranha-céu), debitando o custo, via o comando de construção existente.
- **FR-005**: A ação **Vender construção** MUST estar habilitada quando há ao menos 1 nível construído na cidade; ao acionar, desce 1 nível e devolve metade do custo.
- **FR-006**: Para aeroporto próprio, o popover MUST oferecer **Construir Hangar** (habilitado se sem hangar + caixa + estoque) e **Vender Hangar** (habilitado se há hangar), via os comandos existentes.
- **FR-007**: A ação **Hipotecar** MUST estar habilitada quando a propriedade é minha, não está hipotecada e (para cidade) não há construção no grupo; ao acionar, credita metade do preço e marca como hipotecada.
- **FR-008**: A ação **Deshipotecar** MUST estar habilitada quando a propriedade é minha, está hipotecada e tenho caixa para o resgate (metade × 1,10); ao acionar, cobra esse valor e remove a hipoteca.
- **FR-009**: As marcas no tabuleiro de **construção** (casas/hotel/2º hotel/arranha-céu) e de **hipoteca** MUST refletir o estado real do jogo, atualizando imediatamente após cada ação.
- **FR-010**: A decisão "quais dados e quais ações habilitadas para uma propriedade" MUST ser derivável de forma **pura** a partir do estado do jogo e da posição, para permitir teste automatizado sem renderizar a interface.
- **FR-011**: Toda ação MUST disparar exclusivamente os comandos de jogo já existentes; a feature **não** altera nenhuma regra do motor.
- **FR-012**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Visão do título (deed) para a UI**: representação somente-leitura derivada do estado, para uma posição: dono (ou livre), tipo (cidade/aeroporto/utilidade), nível de construção e/ou hangar, hipotecada, valores (preço, aluguéis aplicáveis, custo de casa, valor de hipoteca, custo de resgate) e as **flags de habilitação** das ações (construir, vender, construir/vender hangar, hipotecar, deshipotecar) com o motivo de bloqueio quando desabilitadas. Não guarda estado próprio.
- **Título** (já existente no motor): dono, casas/hotel/2º hotel/arranha-céu, hangar, hipotecada. Esta feature apenas o **lê** e dispara comandos; não cria nem altera seus campos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A partir do clique numa propriedade própria, o jogador consegue subir um nível de construção em ≤ 2 cliques (abrir + construir), e o resultado (nível, caixa, marca no tabuleiro) é idêntico ao que o comando de construção produz.
- **SC-002**: Em 100% dos casos, as ações ficam habilitadas/desabilitadas exatamente conforme as regras do motor (maioria, uniformidade, estoque, grupo completo, construção no grupo, caixa) — sem permitir nenhuma ação que o motor recusaria.
- **SC-003**: Após construir/vender/hipotecar/deshipotecar, a marca correspondente no tabuleiro reflete o novo estado imediatamente (0 divergências entre tabuleiro e estado).
- **SC-004**: Propriedade de outro dono ou livre nunca exibe ações de gestão (0 vazamentos de ação).
- **SC-005**: O seletor puro que produz a visão do título + flags é coberto por testes automatizados para os casos: construir habilitado/bloqueado (uniformidade, estoque, grupo, caixa), vender, hipotecar bloqueado por construção, deshipotecar sem caixa, hangar, e propriedade de terceiro/livre.

## Assumptions

- **Reúso visual**: as ações entram nos popovers existentes (`PropertyPopover`/`AirportPopover`/`UtilityPopover`), mantendo o visual da "carta do imóvel"; nenhuma identidade visual nova. O acabamento é validado manualmente em execução local (sem testes de renderização de UI no projeto).
- **Parte testável**: a garantia automatizada recai sobre o seletor puro `deedView(game, pos)` (dados + flags), mesmo padrão de `playersView` (020)/`activeModal` (022); o render é validado no `bun run dev`.
- **Gating por turno**: o motor já restringe construção/hipoteca ao jogador da vez; a UI espelha isso. Não há mudança no auto-avanço de turno (022.1) — a janela prática de gestão é antes de rolar ou durante uma dívida.
- **Escassez de casas (leilão)**: quando o banco não tem estoque, "Construir" fica desabilitado. O **gatilho** do leilão de casas por escassez (abrir a disputa entre interessados) **não** faz parte desta fatia — o leilão em si já tem motor e o modal do 022 o exibe; disparar a disputa pela UI fica para depois.
- **Fora de escopo**: negociação/transferência de propriedade (trade); o painel-lista "Minhas propriedades" (acesso escolhido foi por clique no tabuleiro).
- **Dependências**: regras e comandos de 004 (construção), 005 (hipoteca) e 011 (construção avançada); padrão de seletor/Store na UI de 020; popovers existentes em `boards/shared.tsx`.
