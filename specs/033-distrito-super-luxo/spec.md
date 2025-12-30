# Feature Specification: Distrito Super-Luxo "Alta Roda"

**Feature Branch**: `033-distrito-super-luxo`

**Created**: 2026-05-25

**Status**: Draft

**Input**: Novo 10º grupo ultra-premium (Mônaco + Dubai) estilo Boardwalk — armadilha de prestígio no clímax do tabuleiro; rebalance pra caber em 48 casas (verde 4→3, França 3→2); reconciliação SRS/ADR.

## Contexto

O jogo tem 9 grupos / 28 cidades / 48 casas, com o topo (navy/França) calibrado em hotel ~$1.800 pra caber no caixa de $2.000 ([D-024](../../docs/DECISIONS.md)). Falta uma **"zona nobre"** de propriedades *bemmm caras* — o equivalente ao azul-escuro (Park Place/Boardwalk) do Monopoly: a região dos sonhos, alvo de cobiça e *flex* do líder.

Esta feature adiciona um **10º grupo, "Alta Roda" (super-luxo)**, com 2 cidades (Mônaco, Dubai) no fim do tabuleiro, desenhado como **armadilha de prestígio** (caríssimo, aluguel alto, mas raro de cair) — **não** um sweet spot. Reusa o modelo econômico da 032 (`HOUSE_COST`/`RENT_MULT` por grupo + fonte única `rentLadder`); só adiciona um grupo, recalibra o topo e reestrutura o lado direito do board.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A zona nobre (super-luxo) (Priority: P1) 🎯 MVP

Como jogador, existe um distrito de **super-luxo** (Mônaco + Dubai) no fim do tabuleiro, com preços muito acima do resto (~$550/$650) e aluguel de prestígio (hotel ~$2.300, arranha-céu ~$3.600). Fechá-lo e desenvolvê-lo é uma **aposta de alto risco** — caro, mas devastador pra quem cai lá.

**Why this priority**: É a feature inteira (o novo grupo e sua economia). Sem ela não há super-luxo.

**Independent Test**: Verificar que existe um grupo "Alta Roda" com Mônaco e Dubai; que seus preços são os mais altos do tabuleiro; e que o aluguel-hotel da cidade-topo (Dubai) fica ~$2.300 (acima do navy $1.800) com arranha-céu ~$3.600.

**Acceptance Scenarios**:

1. **Given** o tabuleiro, **When** listo os grupos, **Then** existe o grupo super-luxo "Alta Roda" com **Mônaco** e **Dubai**, nas posições do clímax (fim do tabuleiro, antes do GO).
2. **Given** os preços, **When** comparo, **Then** Mônaco (~$550) e Dubai (~$650) são as propriedades **mais caras** do jogo (acima de Paris/navy ~$430).
3. **Given** Dubai com hotel, **When** calculo o aluguel, **Then** fica ~$2.300 (acima do topo navy $1.800); com arranha-céu, ~$3.600.
4. **Given** o caixa inicial de $2.000, **When** um jogador cai no hotel de Dubai, **Then** o aluguel é alto mas **sobrevivível** (dá pra hipotecar/vender pra pagar) — armadilha de alto risco, não falência garantida.
5. **Given** o custo de construção, **When** observo, **Then** Alta Roda tem o **tier mais caro** (~$280/casa) e **ROI propositalmente fraco** (não é sweet spot — é prestígio/ralo de caixa).
6. **Given** que o grupo tem 2 cidades, **When** vou construir, **Then** preciso possuir **as duas** (maioria de grupo de 2 = 2; sem desconto de grupo parcial).

---

### User Story 2 - Tabuleiro rebalanceado (10 grupos, 48 casas) (Priority: P2)

Como jogador, o tabuleiro continua com **48 casas e 28 cidades**, agora em **10 grupos**: o super-luxo entra e, pra abrir espaço, o **verde (EUA) recua de 4→3** (sai Chicago) e o **navy (França) de 3→2** (sai Lyon).

**Why this priority**: Estrutural — sustenta a US1 sem estourar o board. Independente da calibração de valores.

**Independent Test**: Contar grupos/cidades: 8 grupos de 3 + navy de 2 + Alta Roda de 2 = 28 cidades; 48 casas; Chicago e Lyon ausentes; Mônaco e Dubai presentes.

**Acceptance Scenarios**:

1. **Given** o tabuleiro final, **When** conto, **Then** há **10 grupos**, **28 cidades**, **48 casas**: oito grupos de 3, navy (França) com 2, Alta Roda com 2.
2. **Given** o lado direito, **When** observo as posições, **Then** (preço sobe com a posição): Nova York, Los Angeles, Miami (verde); Cannes, Paris (navy); Mônaco, Dubai (Alta Roda). **Chicago e Lyon foram removidos.**
3. **Given** aeroportos/utilidades/cantos, **When** observo, **Then** permanecem nas posições de sempre (6/18/30/42, 14/32/43, 0/12/24/36).

---

### User Story 3 - Identidade visual do super-luxo (Priority: P3)

Como jogador, o distrito Alta Roda tem uma **cor própria** distinta (ônix/dourado — "luxo"), reconhecível na hora como a zona nobre, no tabuleiro e nos deeds/leilões.

**Why this priority**: Acabamento — a lógica (US1/US2) funciona sem a cor, mas a identidade visual vende o "super-luxo". Depende da US2.

**Independent Test**: No `bun run dev`, as casas de Mônaco/Dubai e seus deeds exibem a cor nova (não reusam cor de outro grupo).

**Acceptance Scenarios**:

1. **Given** o grupo Alta Roda, **When** renderiza no board/deed, **Then** usa uma **cor nova** (ônix/dourado), distinta das 9 existentes.

---

### Edge Cases

- **Grupo de 2 (Alta Roda e navy):** maioria = 2 = grupo completo → **sem desconto de grupo parcial** (precisa das duas pra construir). Consequência aceita: França, agora com 2, também passa a exigir as duas.
- **Aluguel-armadilha vs caixa:** hotel de Dubai (~$2.300) > caixa inicial ($2.000) — proposital; o jogador deve poder hipotecar/vender pra cobrir (abre dívida pendente se não conseguir — fluxo 008 inalterado). Não é "morte automática" porque se cai pouco no canto.
- **Construção ilimitada (D-022):** sem estoque do banco; o tier caro só afeta custo/ROI.
- **Arranha-céu (§13.7):** exige grupo completo (as 2) + triplica a outra do grupo; respeita a escada crescente.
- **Cidades removidas:** Chicago (verde) e Lyon (navy) saem do acervo; suas posições passam a outras cidades (preço por posição preservado, ascendente).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST ter um **10º grupo de cidade, "Alta Roda" (super-luxo)**, com **2 cidades: Mônaco e Dubai**, posicionadas no fim do tabuleiro (clímax, antes do GO).
- **FR-002**: Mônaco e Dubai MUST ser as propriedades de **maior preço** do jogo (~$550 e ~$650), acima do navy/França.
- **FR-003**: O aluguel do Alta Roda MUST usar o modelo por grupo (`RENT_MULT` + `rentLadder`, D-024), com **hotel-topo (Dubai) ~$2.300** e **arranha-céu ~$3.600** — acima do navy ($1.800).
- **FR-004**: O custo de casa do Alta Roda MUST ser o **tier mais caro** (~$280), e o **ROI** (hotel ÷ custo-casa) MUST ser **menor** que o dos sweet spots (orange/red) — é prestígio, não barganha.
- **FR-005**: O aluguel-hotel mais alto do jogo (Dubai) MUST permanecer **pagável via hipoteca/venda** a partir do caixa típico — alto risco, não falência automática; se o jogador não cobre, abre o fluxo de dívida pendente (008) inalterado.
- **FR-006**: O grupo de 2 MUST exigir **ambas** as cidades para construir (maioria = 2; sem grupo parcial), consistente com a regra de maioria (§13.3).
- **FR-007**: O tabuleiro MUST manter **48 casas e 28 cidades**, reestruturado em **10 grupos**: verde (EUA) **4→3** (remove Chicago), navy (França) **3→2** (remove Lyon), Alta Roda **+2** (Mônaco, Dubai).
- **FR-008**: Preços MUST seguir a **escada ascendente por posição** no lado direito; aeroportos/utilidades/cantos MUST permanecer nas posições atuais.
- **FR-009**: O grupo Alta Roda MUST ter uma **cor própria** (ônix/dourado), distinta dos 9 grupos existentes, no board e nos deeds.
- **FR-010**: MUST reusar o modelo econômico da 032 (`HOUSE_COST`/`RENT_MULT` por grupo, fonte única `rentLadder`); **não** reintroduzir estoque/`bank` (D-022); manter aeroportos/utilidades/impostos/caixa $2.000/GO.
- **FR-011** (docs): SRS §2.3 (passa a **10 grupos**; verde 3, França 2, Alta Roda 2) e §5.1 MUST ser atualizados; registrar **ADR (D-025)** + atualizar D-017.
- **FR-012**: Todo texto/valor MUST estar em **pt-BR** e os valores no tema (fonte única).

### Key Entities *(include if feature involves data)*

- **Grupo "Alta Roda" (super-luxo)**: novo `GroupKey`, 2 cidades (Mônaco, Dubai), cor própria, tier de casa e multiplicadores de aluguel próprios no tema.
- **Cidade (board)**: ganha Mônaco/Dubai; perde Chicago/Lyon; reatribuições de posição no lado direito (preço por posição).
- **Tema (`HOUSE_COST`/`RENT_MULT`)**: ganham a entrada do novo grupo; o navy pode ter o topo (Paris) levemente recalibrado por virar duo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Mônaco e Dubai são as 2 propriedades mais caras do tabuleiro (preço > qualquer outra).
- **SC-002**: Hotel de Dubai ~$2.300 (> navy $1.800) e arranha-céu ~$3.600 — o topo do jogo, calibrado como armadilha.
- **SC-003**: ROI(Alta Roda) **<** ROI(orange) e ROI(red) — não é sweet spot.
- **SC-004**: Tabuleiro final: **10 grupos**, **28 cidades**, **48 casas** (8×3 + navy 2 + Alta Roda 2); Chicago/Lyon ausentes, Mônaco/Dubai presentes.
- **SC-005**: Aeroportos/utilidades/impostos/caixa/GO inalterados (0 regressão fora do escopo).
- **SC-006**: O grupo Alta Roda tem cor própria distinta no board/deed.
- **SC-007**: SRS §2.3/§5.1 e DECISIONS (D-017 + D-025) refletem 10 grupos e a nova zona nobre.

## Assumptions

- **Reuso 032/D-024:** nenhuma mecânica nova — só +1 grupo no `HOUSE_COST`/`RENT_MULT`, +1 cor, e remanejo do board. `rentLadder` segue fonte única (engine↔UI).
- **Posições:** Alta Roda ocupa o fim do lado direito (clímax). Mônaco e Dubai podem ficar separadas por uma casa especial (estilo Park Place/Boardwalk) — adjacência exata definida no plano.
- **Navy vira duo:** França (Cannes/Paris) passa a 2; Paris pode subir um pouco (~$430) por ser duo de prestígio. Lyon retirado do acervo.
- **Cor nova:** exige token de cor no tema visual (Tailwind/CSS) além do board — escopo de UI incluído.
- **Dependências:** 001 (board), 004/011 (construção/aluguel), 032/D-024 (modelo por grupo + `rentLadder`), 022/031 (deeds/leilões que já leem do tema). D-017 atualizada; D-022 preservada.
