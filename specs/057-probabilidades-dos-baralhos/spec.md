# Feature Specification: Vitrine de probabilidades dos baralhos

**Feature Branch**: `main`

**Created**: 2026-07-30

**Status**: Aprovada (autorização explícita do usuário: "faz tudo do 2 … faz direito sem parar")

**Input**: “Eu queria uma mecânica nova no jogo: quando você clica no ícone de tesouro deveria
aparecer um modal igual aos outros mostrando a probabilidade de cada recompensa do tesouro, e
mesma coisa do acaso, da menor chance pra maior. E se a pessoa deixar o mouse em cima ele
explicar o que aquele efeito ou carta faz — isso é legal pra ensinar sobre o jogo.”

**Depende de**: spec 029 (metadados de apresentação de carta), spec 044 (gate de
acessibilidade AA no caminho de jogo).

> Esta spec **não cria regra de jogo**. Ela expõe, como informação, uma composição que o SRS
> §10.4–10.5 já fixa e que a [D-064](../../docs/adr/D-064-rebalanceamento-do-catalogo-de-cartas.md)
> já decidiu. Nenhum ADR novo é necessário: nada aqui contraria ou refina o SRS.

## Clarifications

Resolvidas por SRS, ADR e código real — sem pergunta pendente ao usuário:

| Ambiguidade | Resolução | Fonte |
|---|---|---|
| A probabilidade sai do baralho VIVO ou da composição impressa? | **Da composição impressa (catálogo estático).** O baralho chega ao cliente como *contagem*: o conteúdo não trafega para quem não é anfitrião. Ler o estado vivo daria número indisponível fora do anfitrião **e** revelaria o que já saiu | SRS §10.3 + [D-037](../../docs/adr/D-037-estado-por-perspectiva-a-mao-nao-trafega.md) |
| Mostrar carta a carta ou agrupar cópias? | **Agrupar por efeito.** O catálogo tem `copies` por carta base (ex.: Aquisição Hostil ×2); listar as 21 unidades repetiria linha idêntica e esconderia justamente a informação pedida (qual efeito é mais provável) | `src/game/cards/catalog.ts` |
| Empate de chance quebra como? | Cartas com a mesma chance são muitas (11 comuns do Acaso têm 1 cópia cada). Desempate estável por **raridade decrescente**, depois por **nome** — sem isso a ordem varia entre renders e a lista parece embaralhada | decisão desta spec |
| Onde vêm título e texto de cada efeito? | `CARD_LABEL` e `CARD_DESC` em `cardMeta.ts`, que já é fonte única de modais e do painel "Minhas Cartas" | spec 029 |
| Abre em partida ou também fora? | Abre a partir da **casa no tabuleiro**, durante a partida. É modal **informativo**: Esc fecha | SRS §1057 |
| Vale nos dois mapas? | Sim. O motor de cartas é o mesmo; o que muda por mapa é rótulo de apresentação, já resolvido pelo `mapCatalog` | [D-069](../../docs/adr/D-069-segundo-mapa-jogavel-cidade-da-fuligem.md) |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Aprender o baralho antes de depender dele (Priority: P1)

Um jogador novo cai numa casa de Acaso, leva um Confisco Geral e não entende o que aconteceu
nem se aquilo era provável. No turno seguinte ele clica na casa de Acaso do tabuleiro e vê a
lista completa dos 18 efeitos possíveis com a chance de cada um, do mais raro ao mais comum —
e descobre que Confisco Geral é 1 em 21.

**Independent Test**: abrir o modal de cada baralho e provar que a lista cobre todo o catálogo
daquele deck, que as chances somam 100% e que a ordem é crescente de chance.

**Acceptance Scenarios**:

1. **Given** uma partida em andamento, **When** o jogador clica na casa/ícone de Acaso,
   **Then** abre um modal informativo listando **todos** os efeitos do baralho Acaso.
2. **Given** o mesmo modal, **When** a lista é renderizada, **Then** os itens aparecem da
   **menor** chance para a **maior**.
3. **Given** o modal do Acaso, **When** as chances são somadas, **Then** somam 100% (21 de 21
   cartas representadas) — nenhum efeito do catálogo fica de fora.
4. **Given** a casa de Tesouro, **When** clicada, **Then** abre o modal equivalente com os 14
   efeitos do baralho Tesouro, somando 100% (18 de 18 cartas).
5. **Given** um efeito com mais de uma cópia (ex.: Aquisição Hostil ×2), **When** listado,
   **Then** aparece em **uma** linha, com a chance das duas cópias somadas e a contagem visível.
6. **Given** dois efeitos com a mesma chance, **When** listados, **Then** a ordem entre eles é
   estável entre renders (raridade decrescente, depois nome).

---

### User Story 2 — Entender o que cada carta faz (Priority: P1)

O jogador não reconhece "Bunker Fiscal" pelo nome. Ele aponta o mouse no item e uma explicação
diz o que a carta faz. No celular e no teclado, a mesma explicação é alcançável — ninguém
depende de hover para aprender a regra.

**Independent Test**: navegar a lista só por teclado e provar que a descrição de cada item é
alcançável e anunciável; provar que a descrição não existe só no `title`/hover.

**Acceptance Scenarios**:

1. **Given** um item da lista, **When** o ponteiro entra nele, **Then** aparece a explicação do
   efeito, vinda do texto canônico de carta.
2. **Given** o mesmo item, **When** alcançado por **teclado** (Tab) e acionado, **Then** a mesma
   explicação fica visível e associada ao item para leitor de tela.
3. **Given** um dispositivo sem ponteiro, **When** o jogador toca no item, **Then** a explicação
   aparece.
4. **Given** a lista aberta, **When** o jogador percorre os itens, **Then** cada um mostra a
   **raridade** com a cor canônica **e** um sinal não-cromático (o selo de losangos já existente),
   de modo que a hierarquia não dependa só de cor.

---

### User Story 3 — Não vazar o que já saiu do baralho (Priority: P1)

Dois jogadores na mesma sala abrem o modal em momentos diferentes da partida — um deles é o
anfitrião. Os dois veem exatamente os mesmos números, no primeiro e no último turno.

**Why this priority**: é o requisito de privacidade, não um detalhe. Uma probabilidade calculada
sobre o baralho restante é um canal de informação sobre cartas já sacadas, e a D-037 existe para
fechar exatamente esse canal.

**Independent Test**: com um estado de partida onde várias cartas já foram sacadas, provar que os
números do modal são idênticos aos do início; e que a projeção não lê `GameState`.

**Acceptance Scenarios**:

1. **Given** uma partida no turno 1, **When** o modal do Acaso abre, **Then** mostra as chances
   da composição impressa.
2. **Given** a mesma partida depois de 10 cartas sacadas, **When** o modal abre de novo,
   **Then** os números são **os mesmos** do turno 1.
3. **Given** a perspectiva de um jogador **não-anfitrião**, **When** o modal abre, **Then** os
   números são idênticos aos vistos pelo anfitrião.
4. **Given** o modal aberto, **When** o conteúdo é inspecionado, **Then** ele não revela ordem do
   baralho, nem carta já sacada, nem carta em mão de ninguém.

---

### Edge Cases

- **Carta `deferido` no catálogo**: o catálogo prevê `status: 'implementado' | 'deferido'`. Um
  efeito não implementado **não** pode aparecer como recompensa possível — a lista mentiria sobre
  o jogo. Hoje todas as 39 estão `implementado`; o filtro existe para que amanhã continue verdade.
- **Soma de arredondamento**: 1/21 = 4,76%. Arredondar cada item e somar dá 99,9%/100,1%. A
  asserção de "somam 100%" é sobre **contagem de cartas** (21 de 21), não sobre a soma dos
  percentuais arredondados.
- **Modal informativo sobre modal decisório**: cair numa casa de carta abre fluxo que **decide** a
  partida. A vitrine não pode se sobrepor a uma decisão pendente nem virar caminho de escape dela.
- **Casa de carta do mapa Fuligem**: os rótulos "Acaso"/"Tesouro" e os glifos por mapa mudam; o
  conteúdo do baralho não.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: clicar na casa de **Acaso** ou de **Tesouro** no tabuleiro MUST abrir um modal
  informativo com a vitrine de probabilidades daquele baralho.
- **FR-002**: a vitrine MUST derivar as chances **exclusivamente** do catálogo estático de cartas,
  e MUST NOT ler o baralho, o descarte ou qualquer mão de `GameState`.
- **FR-003**: a vitrine MUST agrupar por efeito, somando as cópias, e MUST exibir a contagem de
  cópias e a chance resultante de cada efeito.
- **FR-004**: a lista MUST estar ordenada por chance **crescente**, com desempate estável por
  raridade decrescente e depois por nome.
- **FR-005**: a vitrine MUST cobrir **todos** os efeitos com `status: 'implementado'` do baralho, e
  a soma das cópias listadas MUST igualar o tamanho do baralho (Acaso 21, Tesouro 18).
- **FR-006**: efeito com `status: 'deferido'` MUST NOT ser listado, e MUST NOT contar no
  denominador da probabilidade.
- **FR-007**: cada item MUST apresentar título e explicação vindos da fonte única de apresentação
  de carta (spec 029), sem texto de regra reescrito nesta feature.
- **FR-008**: a explicação MUST ser alcançável por ponteiro, por **teclado** e por **toque**, e
  MUST estar associada ao item para tecnologia assistiva — não apenas em `title`/hover.
- **FR-009**: cada item MUST indicar a raridade pela cor canônica (SRS §10.2) **e** por sinal
  não-cromático, mantendo o gate de contraste AA da spec 044.
- **FR-010**: o modal MUST seguir a casca visual e o comportamento dos modais **informativos** —
  Esc fecha, foco contido, retorno de foco ao elemento que o abriu (SRS §1057).
- **FR-011**: a vitrine MUST NOT abrir sobre uma resolução pendente que decide a partida, nem
  servir de caminho para fechá-la.
- **FR-012**: a feature MUST funcionar nos dois mapas, respeitando os rótulos de apresentação do
  mapa ativo.
- **FR-013**: a feature MUST NOT alterar carta, raridade, número de cópias, tamanho de baralho,
  regra de saque, embaralhamento, limite de mão ou o Bilhete de Trem.
- **FR-014**: a projeção de probabilidades MUST ser coberta por teste de unidade (composição,
  ordenação, soma, filtro de `deferido`) e o modal por teste de apresentação e de acessibilidade.

### Key Entities

- **DeckOdds**: projeção pura de um baralho — lista de `DeckOddsRow` mais o total de cartas.
  Derivada só do catálogo; sem dependência de `GameState`.
- **DeckOddsRow**: um efeito na vitrine — título, explicação, raridade, número de cópias,
  probabilidade. É a unidade que a lista ordena.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: das duas casas de carta do tabuleiro, o jogador alcança a vitrine do baralho
  correspondente em **um** clique.
- **SC-002**: a vitrine do Acaso apresenta 18 efeitos somando 21 cartas; a do Tesouro, 14 efeitos
  somando 18 cartas — verificado por teste, não por leitura.
- **SC-003**: os números exibidos são **invariantes** ao andamento da partida e à perspectiva de
  quem olha (anfitrião ou não), provado por teste com baralho já consumido.
- **SC-004**: 100% dos itens têm a explicação alcançável sem ponteiro; auditoria de acessibilidade
  do caminho não regride em relação ao gate da spec 044.
- **SC-005**: nenhuma referência a `GameState`, baralho vivo ou mão entra na projeção de
  probabilidades — verificável por inspeção da assinatura da projeção (ela não recebe estado).
- **SC-006**: `bun run lint`, `bunx tsc --noEmit` e a suíte Vitest passam; a tela é verificada com
  screenshot real.

## Assumptions

- O catálogo atual (Acaso 21 em 18 efeitos: 5 lendárias, 5 raras, 11 comuns; Tesouro 18 em 14
  efeitos: 2, 6, 10) é o estado aprovado pela D-064 e **não** é rebalanceado por esta feature.
- Probabilidade é apresentada em porcentagem com **uma** casa decimal (4,8% e não 4,761%): a
  precisão extra não muda decisão e polui a leitura de uma lista de 18 linhas.
- A vitrine é informação de aprendizado, não de estratégia avançada: não há intenção de mostrar
  cartas restantes, histórico de saques ou probabilidade condicional — e mostrar isso violaria a
  D-037.
