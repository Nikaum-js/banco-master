# Feature Specification: Revelação de carta sacada (M2)

**Feature Branch**: `025-revelacao-carta`

**Created**: 2026-05-24

**Status**: Draft

**Input**: User description: "Ao parar em Acaso/Tesouro, mostrar a carta sorteada (nome/deck/raridade/efeito) num modal antes de aplicar/guardar; o jogador confirma e o efeito acontece."

## User Scenarios & Testing *(mandatory)*

Hoje, quando o jogador para numa casa de **Acaso** ou **Tesouro**, a carta é resolvida em silêncio: se é de efeito imediato, o efeito é aplicado na hora; se é de mão, ela entra na mão — e o jogador só descobre o que aconteceu pelo log. Falta o momento clássico de **virar a carta e ver o que saiu** (SRS §12.2). Esta feature insere uma **revelação**: ao cair na casa de carta, um modal central mostra a carta sorteada (nome, deck, raridade e uma descrição curta do efeito); o jogador lê e confirma em **"Continuar"**, e só então o efeito é aplicado (imediata) ou a carta vai para a mão. As regras de carta não mudam — apenas ganham esse passo de revelação antes de processar.

### User Story 1 - Ver a carta antes de ela agir (Priority: P1) 🎯 MVP

Ao parar numa casa de carta, vejo um modal com a carta sorteada e confirmo para que o efeito aconteça.

**Why this priority**: É o coração da feature e o feedback que falta no fluxo de cartas (frequente). Sozinha entrega o valor e é testável.

**Independent Test**: Colocar o jogador numa casa de Acaso/Tesouro com um topo de deck conhecido e verificar que, ao resolver, um modal de revelação aparece com aquela carta — **sem** ainda aplicar o efeito nem mexer na mão/deck; ao confirmar, o efeito/guarda acontece.

**Acceptance Scenarios**:

1. **Given** o jogador parou numa casa de Acaso/Tesouro, **When** a casa é resolvida, **Then** um modal central exibe a carta do topo do deck (nome, deck, cor de raridade e descrição curta do efeito) e **nenhum** efeito foi aplicado ainda (caixa/posição/mão/deck inalterados).
2. **Given** o modal de revelação está aberto para uma carta de **efeito imediato**, **When** o jogador escolhe "Continuar", **Then** a carta sai do deck, o efeito é aplicado, o resultado vai para o log e o turno segue.
3. **Given** o modal de revelação está aberto para uma carta de **mão** (cabe na mão), **When** o jogador escolhe "Continuar", **Then** a carta entra na mão do jogador e o turno segue.
4. **Given** a carta de mão revelada faria a mão passar de 3, **When** o jogador confirma, **Then** abre o fluxo de **descarte** (escolher 1 das 4) já existente.
5. **Given** a carta revelada é o **Atalho**, **When** o jogador confirma, **Then** abre o fluxo de **escolher ±3** já existente.
6. **Given** o modal de revelação está visível, **When** ele está aberto, **Then** o turno **não** finaliza sozinho até o jogador confirmar.

---

### Edge Cases

- **Token ainda andando**: a revelação só aparece depois que o peão chega na casa (a resolução já é coordenada com a animação) — nunca antes.
- **Carta de mão de outro jogador**: a revelação é do jogador **da vez** (quem sacou). Conteúdo de carta de mão alheia nunca é exposto aos demais (princípio VI); o que é público é apenas o anúncio no log (carta imediata) — já existente.
- **Confirmar duas vezes / spam**: confirmar resolve uma única vez; após processar, o modal de revelação some.
- **Sem deck (esgotado)**: não ocorre na prática (cartas imediatas reciclam ao fundo); se o topo não existir, não há revelação e o turno segue.
- **Uma revelação por saque**: revela a carta do topo (a que será efetivamente sacada); não revela múltiplas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ao resolver uma casa de **Acaso/Tesouro**, o sistema MUST pausar e exibir um **modal de revelação** com a carta do topo do deck — **antes** de aplicar qualquer efeito ou alterar mão/deck/caixa.
- **FR-002**: O modal MUST mostrar: nome da carta, deck (Acaso ou Tesouro), cor da raridade (laranja/azul/verde — §10.2) e uma descrição curta do efeito; e indicar se a carta **vai para a mão** ou tem **efeito imediato**.
- **FR-003**: Enquanto a revelação estiver pendente, o turno MUST **não** finalizar automaticamente (bloqueia como os demais estados de carta).
- **FR-004**: Ao confirmar ("Continuar"), o sistema MUST sacar a carta e **processar** exatamente como hoje: imediata → aplica o efeito (e registra no log); mão → entra na mão; se a mão passar de 3 → abre o **descarte**; se for **Atalho** → abre a escolha **±3**.
- **FR-005**: Antes da confirmação, o estado do jogo (deck, mão, caixa, posições, efeitos) MUST permanecer **inalterado** pela revelação (a revelação é só leitura/anúncio).
- **FR-006**: A revelação MUST ser do jogador **da vez** (quem sacou); o conteúdo de carta de **mão** não pode ser exposto a outros jogadores (princípio VI).
- **FR-007**: A regra de efeitos das cartas MUST permanecer **inalterada** — esta feature só adiciona o passo de revelação antes do processamento existente.
- **FR-008**: A decisão "há revelação pendente e qual carta" MUST ser derivável de forma **pura** do estado, para teste automatizado sem renderizar a interface.
- **FR-009**: Todo texto visível MUST estar em português (Brasil).

### Key Entities *(include if feature involves data)*

- **Revelação pendente**: estado que diz que há uma carta sacada aguardando confirmação — qual deck e qual carta (a do topo). É bloqueante do turno (como descarte/atalho). Não altera deck/mão até a confirmação. No máximo uma por vez.
- **Carta** (já existente): identidade (id), deck, raridade, modo (mão/imediato) e efeito. A revelação apenas **lê** esses dados para exibir; o saque/efeito continuam regidos pelo sistema de cartas (006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos saques de Acaso/Tesouro, a carta é exibida num modal antes de qualquer efeito; o estado (deck/mão/caixa) permanece inalterado até o "Continuar".
- **SC-002**: Ao confirmar, o resultado é **idêntico** ao processamento de carta atual (mesma aplicação de efeito, mesma entrada na mão, mesmos fluxos de descarte/atalho) — nenhuma regra de carta muda.
- **SC-003**: O turno nunca finaliza com uma revelação pendente (0 casos).
- **SC-004**: Conteúdo de carta de mão de um jogador nunca é revelado a outro (privacidade preservada em 100% dos casos).
- **SC-005**: A revelação pendente e a confirmação são cobertas por testes automatizados (revela o topo sem mutar deck/mão; confirmar aplica imediata / guarda na mão / abre descarte / abre atalho), e a suíte de cartas existente (006) permanece verde.

## Assumptions

- **Reúso dos modais centrais**: a revelação é mais um modal central (mesma camada de 022), aberto pelo estado de resolução; o "Continuar" dispara o processamento já existente. Acabamento validado no `bun run dev` (sem testes de render no projeto).
- **Processamento inalterado**: o saque/efeito é a função de carta atual (006) — a revelação apenas a antecede com um passo de confirmação. Os testes que a exercitam diretamente continuam válidos.
- **Descrição do efeito**: uma descrição curta por efeito é apresentada no modal (texto de apresentação); não altera a lógica. O nome é derivado da carta.
- **Coordenação com a animação**: a revelação só aparece após o peão chegar na casa (resolução já coordenada com a animação do token).
- **Fora de escopo**: alterar efeitos de carta; revelar carta de mão alheia; "anúncio público" aos demais além do log (o Histórico já registra); revelar mais de uma carta por saque.
- **Dependências**: 006 (sistema de cartas/saque), 022 (modais centrais / estado de resolução / ModalLayer), 021 (log).
