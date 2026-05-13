# Research — Tabuleiro de 48 Casas

**Fase 0** · resolve o único "desconhecido" real da spec: a **sequência canônica de placement** das 48 casas (FR-005, deixado como dado a definir). As decisões técnicas de stack já estão fixadas (CLAUDE.md §3) — não há NEEDS CLARIFICATION de tecnologia.

---

## Decisão 1 — Geometria: grade 13×13

**Decisão:** 48 casas = 11 por lado + 4 cantos → perímetro de uma grade **13×13** (13×4 − 4 = 48). Cantos nos índices 0/12/24/36.

**Rationale:** mantém o board quadrado (constraint do projeto) e é o menor grid que comporta 48 no perímetro. A matemática de posição é análoga à atual (11×11), só muda o módulo.

**Mapa pos → célula (sentido horário a partir do GO no canto inferior direito):**

| Lado | Índices | gridRow | gridColumn |
|---|---|---|---|
| Inferior (bottom) | 0–12 | 13 | 13 − pos |
| Esquerdo (left) | 13–24 | 13 − (pos − 12) | 1 |
| Superior (top) | 25–36 | 1 | pos − 23 |
| Direito (right) | 37–47 | pos − 35 | 13 |

Cantos conferem: pos 0 → (13,13) inferior-direito; pos 12 → (13,1) inferior-esquerdo; pos 24 → (1,1) superior-esquerdo; pos 36 → (1,13) superior-direito. ✅

**`sideOf(pos)`** para 48: `0|12|24|36 → corner`; `1–11 → bottom`; `13–23 → left`; `25–35 → top`; `37–47 → right`.

**Alternativas consideradas:** grade não-quadrada (retângulo) — rejeitada, quebra a identidade visual do tabuleiro clássico. Manter 40 e só "esticar" células — já feito numa iteração anterior; não resolve o pedido de mais casas.

---

## Decisão 2 — Distribuição dos grupos (8 países, 28 cidades)

**Decisão:** premium (4 cidades) = Índia, China, Brasil, EUA; regular (3) = Itália, Egito, Japão, Reino Unido. Cada país ocupa um trecho contíguo, 2 países por lado (preserva o agrupamento temático atual).

| Grupo (cor) | País | Cidades | Δ vs. hoje |
|---|---|---|---|
| brown | Itália | Roma, Veneza, **Florença** | +1 |
| skyblue | Egito | Cairo, Alexandria, Luxor | 0 |
| pink | Japão | Tóquio, Kyoto, Osaka | 0 |
| orange | Índia | Délhi, Mumbai, Bangalore, **Calcutá** | +1 |
| red | China | Pequim, Xangai, Hong Kong, **Shenzhen** | +1 |
| yellow | Brasil | Rio de Janeiro, São Paulo, Salvador, **Brasília** | +1 |
| green | EUA | Nova York, Los Angeles, Chicago, **Miami** | +1 |
| navy | Reino Unido | Londres, Edimburgo, **Manchester** | +1 |

Total: 3+3+3+4+4+4+4+3 = **28** (+6 cidades). Nomes são sugestões — finalização é dado de tema (ver Decisão 5).

**Rationale:** premium = grupos de maior valor (mais ao fim do percurso), onde o monopólio de 4 pesa mais e segura o líder. Mantém o casamento país↔grupo já existente no código.

---

## Decisão 3 — Sequência canônica das 48 casas

**Decisão:** 2 países por lado, 1 aeroporto perto do meio de cada lado, utilidades/cartas/imposto/bus intercalados.

| Pos | Tipo | Detalhe |
|---|---|---|
| 0 | corner-go | GO |
| 1 | property | Itália · Roma |
| 2 | tesouro | |
| 3 | property | Itália · Veneza |
| 4 | tax | Imposto de Renda ($200) |
| 5 | property | Itália · Florença |
| 6 | airport | Aeroporto (lado inferior) |
| 7 | property | Egito · Cairo |
| 8 | surpresa | |
| 9 | property | Egito · Alexandria |
| 10 | **bus-ticket** | Espaço Bus Ticket |
| 11 | property | Egito · Luxor |
| 12 | corner-jail | Prisão / Visita |
| 13 | property | Japão · Tóquio |
| 14 | utility | Utilidade 1 (ex: Petróleo) |
| 15 | property | Japão · Kyoto |
| 16 | property | Japão · Osaka |
| 17 | surpresa | |
| 18 | airport | Aeroporto (lado esquerdo) |
| 19 | property | Índia · Délhi |
| 20 | tesouro | |
| 21 | property | Índia · Mumbai |
| 22 | property | Índia · Bangalore |
| 23 | property | Índia · Calcutá |
| 24 | corner-parking | Férias / Free Parking |
| 25 | property | China · Pequim |
| 26 | property | China · Xangai |
| 27 | surpresa | |
| 28 | property | China · Hong Kong |
| 29 | property | China · Shenzhen |
| 30 | airport | Aeroporto (lado superior) |
| 31 | property | Brasil · Rio de Janeiro |
| 32 | utility | Utilidade 2 (ex: Energia) |
| 33 | property | Brasil · São Paulo |
| 34 | property | Brasil · Salvador |
| 35 | property | Brasil · Brasília |
| 36 | corner-gotojail | Vá para a Prisão |
| 37 | property | EUA · Nova York |
| 38 | property | EUA · Los Angeles |
| 39 | tesouro | |
| 40 | property | EUA · Chicago |
| 41 | property | EUA · Miami |
| 42 | airport | Aeroporto (lado direito) |
| 43 | utility | Utilidade 3 (ex: Gás/Saneamento) |
| 44 | property | Reino Unido · Londres |
| 45 | tax | Imposto de Luxo ($100) |
| 46 | property | Reino Unido · Edimburgo |
| 47 | property | Reino Unido · Manchester |

**Auditoria de contagem:** cidades 28 · aeroportos 4 (pos 6/18/30/42) · utilidades 3 (14/32/43) · surpresa 3 (8/27 + 17) · tesouro 3 (2/20/39) · imposto 2 (4/45) · bus-ticket 1 (10) · cantos 4 (0/12/24/36) = **48** ✅. Surpresa em 8/17/27, tesouro em 2/20/39. ✅

**Rationale:** distribuição espelha o "feel" do Richup (aeroporto ~meio de lado, cartas espalhadas, imposto cedo/tarde).

---

## Decisão 4 — Novos tipos de casa

**Decisão:** adicionar `'bus-ticket'` a `SquareKind` e uma 3ª variante de utilidade (`icon: 'fuel' | 'bolt' | 'gas'`). Aluguel de utilidade passa a escalar 4×/10×/20× (1/2/3 possuídas).

**Rationale:** mudança mínima de schema; o resto do pipeline (render por `kind`, `SquareIcon`) já é um switch que só precisa de 2 casos novos.

**Alternativas:** modelar Bus Ticket como subtipo de "card space" genérico — rejeitado, é um gatilho específico (compra Bus Ticket, não carta Surpresa/Tesouro), merece kind próprio.

---

## Decisão 5 — Preços/aluguéis: escada granular (dado de tema)

**Decisão:** a spec deixou os valores como dado de tema. Proposta de **escada ilustrativa** (tunável em playtesting) do mais barato ao mais caro, para guiar quem preencher o tema:

| Faixa | Grupos | Preço aprox. |
|---|---|---|
| Início | Itália, Egito | $60–$120 |
| Baixo-médio | Japão, Índia | $140–$200 |
| Médio-alto | China, Brasil | $220–$300 |
| Premium | EUA, Reino Unido | $320–$400 |

**Rationale:** com 28 cidades a escada precisa de mais degraus que as 22 atuais; manter monotonicamente crescente ao longo do percurso preserva a leitura "quanto mais longe do GO, mais caro". **Valores finais não são travados por esta spec** (assumption explícita).

---

## Resumo dos NEEDS CLARIFICATION

Nenhum pendente. O único item aberto da spec (placement) está resolvido na Decisão 3. Valores monetários permanecem deliberadamente como dado de tema (Decisão 5), fora do escopo desta feature.
