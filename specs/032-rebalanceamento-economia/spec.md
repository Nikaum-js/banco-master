# Feature Specification: Rebalanceamento de economia e tabuleiro

**Feature Branch**: `032-rebalanceamento-economia`

**Created**: 2026-05-25

**Status**: Draft

**Input**: User description: recalibrar custos de casa (tiers por grupo), aluguéis (curva clássica suavizada por grupo, com sweet spots) e rebalancear o grupo laranja para 3 cidades; reconciliar SRS §2.3/§5.1 com a estrutura real (9 grupos).

## Contexto

A economia atual tem dois problemas de balanceamento:

1. **Custo de casa proporcional** (`preço × 0,5`) → todo terreno tem ROI parecido, sem *sweet spot* (no Monopoly clássico, laranja/vermelho são as melhores compras porque a casa é barata pro aluguel que rende).
2. **Aluguel por multiplicador único** sobre a base ($2–$50) → o topo estoura (hotel de Paris = **$5.000** com caixa inicial de **$2.000**) e o piso achata; um único hotel caro = falência instantânea. No clássico o spread é ~8× (Mediterrânea $250 → Boardwalk $2.000), no nosso é ~25×.

Além disso, o **tabuleiro real diverge do SRS**: o SRS §2.3 diz "8 grupos, premium laranja/vermelho/amarelo/verde com 4 cada", mas o tabuleiro implementado tem **9 grupos** com composição 3/3/3/3/**2**/3/4/4/3 — o **laranja (Alemanha) só tem 2 cidades**.

Esta feature recalibra os valores e reconcilia a estrutura, **reusando o motor de construção/aluguel existente** (specs 004/011) — sem reintroduzir o estoque do banco (construção segue ilimitada, [D-022](../../docs/DECISIONS.md)).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aluguéis que cabem no caixa (Priority: P1) 🎯 MVP

Como jogador, quando alguém ergue um hotel/arranha-céu, o aluguel é alto mas **não me leva à falência num único acerto** — dá pra reagir (hipotecar, vender, negociar). O topo do jogo (França) cobra hotel ~$1.800, não $5.000.

**Why this priority**: A curva atual quebra a economia de $2.000; sem isso, o jogo "morre" no primeiro hotel caro. É o coração do rebalance.

**Independent Test**: Construir o ladder completo (1–4 casas → hotel → 2º hotel → arranha-céu) na cidade-topo de cada grupo e verificar que o **hotel** bate o alvo do grupo (brown 360 … navy 1.800) e que a curva tem o salto na 3ª casa; verificar que o hotel mais caro (navy) ≤ ~$1.800.

**Acceptance Scenarios**:

1. **Given** a cidade-topo de cada grupo no nível hotel, **When** calculo o aluguel, **Then** ele bate o alvo do grupo: brown ~360, skyblue ~520, pink ~700, purple ~880, orange ~1.050, red ~1.150, yellow ~1.350, green ~1.550, navy ~1.800.
2. **Given** qualquer cidade, **When** subo de 2 para 3 casas, **Then** há um **salto grande** de aluguel (o ponto de virada do ROI), e de 4 casas para hotel um aumento menor.
3. **Given** a cidade mais cara (Paris), **When** está com hotel, **Then** o aluguel é ~$1.800 (não ~$5.000), cabendo na escala de caixa de $2.000.
4. **Given** o 2º hotel e o arranha-céu, **When** calculo o aluguel, **Then** ficam **acima** do hotel (2º hotel ≈ 1,3× hotel; arranha-céu ≈ 1,6× hotel), preservando a escada crescente (§14.4 / §13.7).

---

### User Story 2 - Sweet spots de investimento (Priority: P1)

Como jogador, fechar **Alemanha (laranja) ou China (vermelho)** — os grupos do meio, onde mais se cai pós-prisão — é o **melhor retorno por dólar** investido: casa barata, aluguel alto.

**Why this priority**: É o que devolve profundidade estratégica (a escolha "onde construir" passa a importar). Depende dos tiers de casa + curva (US1).

**Independent Test**: Comparar o ROI (aluguel-hotel ÷ custo-casa) entre orange/red e green; orange/red devem ter ROI **maior** que green.

**Acceptance Scenarios**:

1. **Given** os tiers de custo de casa por grupo, **When** comparo orange ($110/casa, hotel ~$1.050) com green ($200/casa, hotel ~$1.550), **Then** orange tem **mais aluguel por dólar de casa** (sweet spot).
2. **Given** um grupo qualquer, **When** construo, **Then** o custo da casa é **fixo do grupo** (tier), não proporcional ao preço da cidade.

**Tiers de custo de casa (por grupo):**

| Grupo | Custo casa |
|---|---|
| brown · Itália | $40 |
| skyblue · Egito | $60 |
| pink · Japão | $90 |
| purple · Espanha | $110 |
| **orange · Alemanha** | $110 🎯 |
| **red · China** | $130 🎯 |
| yellow · Brasil | $160 |
| green · EUA | $200 |
| navy · França | $240 |

---

### User Story 3 - Grupos equilibrados (laranja com 3) (Priority: P2)

Como jogador, todos os grupos têm tamanho coerente: o **laranja deixa de ter só 2 cidades** — passa a 3, como os demais; apenas o **verde (EUA)** segue como o grupo premium de 4 (já que 28 = 8×3 + 4).

**Why this priority**: Corrige a assimetria que torna o sweet spot do laranja pequeno demais e reconcilia o SRS com a realidade. Estrutural, mas independente dos valores.

**Independent Test**: Contar as cidades por grupo no tabuleiro final — oito grupos com 3, verde com 4, total 28.

**Acceptance Scenarios**:

1. **Given** o tabuleiro rebalanceado, **When** conto as cidades por grupo, **Then** brown/skyblue/pink/purple/orange/red/yellow/navy têm **3** cada e green tem **4** (total 28).
2. **Given** o lado superior (posições 25–35), **When** observo, **Then** Alemanha tem 3 (Berlim, Munique, **Hamburgo**), China tem 3 (Pequim, Xangai, Hong Kong) e Brasil tem 3 (Rio, São Paulo, Brasília); **Salvador sai**, **Hamburgo entra**.
3. **Given** os preços, **When** observo, **Then** seguem a **escada ascendente por posição** (a posição mantém seu preço; só nome/cor mudam onde houve realocação).

---

### Edge Cases

- **Grupo parcial (§13.3):** a maioria continua sendo 2 de 3 (oito grupos) ou 3 de 4 (verde) — inalterado pelo rebalance.
- **Construção ilimitada (D-022):** sem estoque do banco; os tiers de casa afetam só **custo/ROI**, não escassez. **Não** reintroduzir `bank`/`BankStock`.
- **Arranha-céu (§13.7):** segue exigindo grupo completo + triplica as demais do grupo; os novos valores de aluguel respeitam a escada crescente.
- **Aeroportos/utilidades/impostos:** **inalterados** (4×$200 → 25/50/100/200; 3×$150 → ×4/10/20; Renda $200/Luxo $100).
- **Caixa inicial e GO:** **inalterados** ($2.000; GO $200 passar / $400 parar).
- **Cidades reaproveitadas:** Hamburgo herda a posição/preço/base do antigo Hong Kong (pos 27); Hong Kong assume a posição/preço/base do antigo Rio (pos 31); Rio assume pos 33. Nenhuma posição fica vazia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O custo de construção de casa MUST ser um **tier fixo por grupo** (tabela da US2), substituindo o cálculo proporcional `preço × 0,5`.
- **FR-002**: O aluguel com construção MUST ser calculado por **multiplicadores por grupo** (não mais um multiplicador único global), de modo que grupos baratos tenham multiplicadores maiores e caros, menores (espelhando a curva clássica).
- **FR-003**: O **hotel** da cidade-topo de cada grupo MUST aproximar os alvos: brown 360 · skyblue 520 · pink 700 · purple 880 · orange 1.050 · red 1.150 · yellow 1.350 · green 1.550 · navy 1.800 (tolerância de arredondamento aceitável).
- **FR-004**: A curva de aluguel MUST ter **salto acentuado na 3ª casa** e aumentos menores de 4 casas→hotel; **2º hotel ≈ 1,3× hotel** e **arranha-céu ≈ 1,6× hotel**, sempre crescente.
- **FR-005**: O **ROI** (aluguel-hotel ÷ custo-casa) de orange e red MUST ser **maior** que o de green (sweet spot verificável).
- **FR-006**: O tabuleiro MUST ter composição **8 grupos de 3 + verde de 4 = 28 cidades**; o laranja (Alemanha) MUST ter 3 cidades (Berlim, Munique, Hamburgo).
- **FR-007**: O rebalance MUST manter o total de **48 casas** e a posição dos aeroportos/utilidades/cantos; apenas nomes/cores/preços das cidades nas posições realocadas (27, 31, 33–35) mudam, **sem** posição vazia.
- **FR-008**: Preços das cidades MUST seguir a **escada ascendente por posição** (cada posição mantém seu preço; nomes/grupos podem ser reatribuídos).
- **FR-009**: Aeroportos, utilidades, impostos, caixa inicial ($2.000) e GO ($200/$400) MUST permanecer **inalterados**.
- **FR-010**: A construção MUST seguir **ilimitada** (sem estoque do banco — D-022); os tiers afetam apenas custo/ROI.
- **FR-011** (docs): O **SRS §2.3** MUST ser corrigido para a estrutura real (9 grupos: 8 de 3 + verde de 4; temas reais), e o **§5.1** atualizado para refletir o modelo de aluguel por grupo + os tiers de casa. Uma decisão MUST ser registrada em `docs/DECISIONS.md` (atualizar D-017 e/ou ADR novo).
- **FR-012**: Todo texto/valor visível MUST estar em **português (Brasil)** e os valores econômicos MUST viver no arquivo de tema (fonte única, tunável — spec 018).

### Key Entities *(include if feature involves data)*

- **Tier de custo de casa (por grupo)**: valor fixo de construção por grupo (9 valores). Vive no tema.
- **Multiplicadores de aluguel (por grupo)**: a escada [1–4 casas, hotel, 2º hotel, arranha-céu] por grupo (9 conjuntos), aplicada ao aluguel-base de cada cidade. Vive no tema; lida pelo cálculo de aluguel.
- **Cidade (board)**: posição, nome, grupo, preço, aluguel-base. O rebalance reatribui nome/grupo em posições do lado superior.
- **Composição de grupos**: 8 grupos de 3 + verde (EUA) de 4 = 28 cidades.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O hotel mais caro do tabuleiro (navy/Paris) custa **≤ ~$1.800** de aluguel (vs ~$5.000 hoje) — nenhuma cidade passa disso.
- **SC-002**: O spread de aluguel-hotel entre a cidade mais barata e a mais cara fica em **~5–8×** (vs ~25× hoje).
- **SC-003**: O custo de casa é **fixo por grupo** (independe do preço da cidade dentro do grupo) — verificável em 100% dos grupos.
- **SC-004**: ROI de orange e red **> ROI de green** (sweet spot existe e é mensurável).
- **SC-005**: O tabuleiro final tem exatamente **8 grupos com 3 cidades e 1 grupo (verde) com 4**; laranja com 3; total 28 cidades / 48 casas.
- **SC-006**: Aeroportos/utilidades/impostos/caixa/GO permanecem com os mesmos valores de antes (0 regressão fora do escopo).
- **SC-007**: SRS §2.3/§5.1 e DECISIONS refletem a estrutura e o modelo novos (sem divergência doc↔código).

## Assumptions

- **Reuso do motor (004/011):** o cálculo de aluguel e a ladder de construção já existem; muda-se o **modelo de custo** (proporcional → tier por grupo) e o **modelo de aluguel** (multiplicador único → por grupo), além dos **valores**. Sem nova mecânica de jogo.
- **Aluguéis-base por cidade:** mantidos ascendentes por posição; as cidades realocadas herdam o base da posição. Calibração fina pode ocorrer no plano.
- **Curva por grupo, não por cidade:** a "forma" (frações do hotel) é a mesma em todos os grupos; o que muda por grupo é o multiplicador do hotel (escala). Variação fina entre cidades do mesmo grupo vem do aluguel-base. (Hand-tuning por cidade individual fica fora — granularidade por grupo é suficiente para os sweet spots.)
- **Verde = premium 4:** como 28 não divide por 9, exatamente um grupo tem 4; escolhido o verde (EUA), mantendo o "topo premium".
- **Sem mudança de UI:** os cards/deeds já leem preço/aluguel/custo do tema e do board; só os valores mudam. (A tabela de aluguel exibida — ex.: no pregão 031 e nos popovers — passa a refletir os novos números automaticamente.)
- **Dependências:** 001 (estrutura do board), 004/011 (construção/aluguel), 018 (tema como fonte única), D-017 (estrutura de 48 casas — será atualizada), D-022 (construção ilimitada — preservada).
