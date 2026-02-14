# D-064 — Rebalanceamento do catálogo de cartas (Acaso 21 / Tesouro 18)

**Data:** 2026-07-29 · **Status:** aceita · **Refina:** SRS §10 (catálogo introduzido na 006; ofensivas 016; reação 017)
**Refinada por:** [D-074](D-074-raridade-de-carta-nao-inverte-probabilidade.md) — redistribui cópias sem alterar as 21/18 cartas.
**Refinada por:** [D-080](D-080-estatizacao-dura-uma-volta.md) — **só a duração da Estatização** cai de 2 voltas para 1; destino do aluguel, raridade, cópias, modo e elegibilidade permanecem os desta decisão.

**Decisão:** o catálogo de cartas deixa de ter 16+16 e passa a **21 (Acaso) + 18 (Tesouro)**, com cartas reforçadas, fundidas, removidas e novas. Decisão de design tomada em playtest/discovery com o Nikolas (2026-07-29), item a item:

## Cartas alteradas

| Carta | Antes | Depois |
|---|---|---|
| **Despejo → Confisco Geral** | demolia 1 casa (não hotel) de uma propriedade adversária | demole **todas as construções** de 1 propriedade adversária (casas, hotéis e arranha-céu); o alvo **mantém o terreno** e não recebe nada |
| **Aquisição Hostil** | compra forçada pelo preço de tabela (×1,5 aeroporto/utilidade) | compra forçada pela **metade** do preço de tabela (a sobretaxa ×1,5 de aeroporto/utilidade incide sobre a metade) |
| **Auditoria Fiscal → Imposto Federal** | alvo pagava 10% do patrimônio à Loteria | alvo paga **25%** do patrimônio à Loteria |
| **Crise Imobiliária** | todos (inclusive quem sacou) pagavam 5% do patrimônio | só os **adversários** de quem sacou pagam, e a alíquota sobe para **10%** |
| **Apagão + Greve nas Utilidades → Greve** | duas cartas, um efeito cada | **uma** carta com os dois efeitos por 1 volta: Hangares inativos **e** utilidades sem aluguel |
| **Imunidade Temporária** | 1 propriedade sua imune a ofensivas por 2 voltas | **você** fica 1 volta sem pagar **aluguel, imposto algum** e imune a **efeitos negativos** (ofensivas, cobranças de carta alheia) |

## Cartas removidas

- **Refinanciamento** (Tesouro, comum, 2 cópias) — condicional demais; frequentemente no-op.

## Cartas novas — Tesouro (imediatas, comuns)

- **Resgate do Pote** — recebe **metade da Loteria** acumulada.
- **Obra Relâmpago** — a **próxima construção sai de graça** (casa, hotel, arranha-céu ou Hangar).
- **Incentivo Fiscal** — recebe **$50 por propriedade hipotecada** que possui (alívio pra quem está mal; catch-up discreto, princípio IV).

## Cartas novas — Tesouro (mão)

- **Valorização** (rara, próprio turno) — escolha uma propriedade sua: por **1 volta ela cobra aluguel em dobro** (o anti-Boicote).

## Cartas novas — Acaso (imediatas)

- **Desvalorização Cambial** (comum) — paga **10% do caixa em mãos** à Loteria (pune caixa parado, não patrimônio).
- **Obras na Pista** (comum) — vai ao **aeroporto mais próximo** (sentido horário, credita GO ao cruzar); se tiver dono, paga **aluguel em dobro**.
- **Multa Ambiental** (comum) — paga **$50 + $50 por hotel/2º hotel/arranha-céu** que possui, à Loteria.
- **Estatização** (rara) — por **2 voltas, todo aluguel** pago na mesa vai **direto à Loteria** em vez do dono. *(Duração revista para **1 volta** pela [D-080](D-080-estatizacao-dura-uma-volta.md); o resto da carta segue como aqui.)*

## Cartas novas — Acaso (mão)

- **Permuta Forçada** (lendária, próprio turno) — troca **qualquer** propriedade sua por **qualquer** propriedade de um adversário, sem restrição de preço; **nenhuma das duas** pode ter construção (casa, hotel, arranha-céu ou Hangar). O alvo não pode recusar (Diplomacia reage).
- **Embargo de Obras** (rara, próprio turno) — o adversário escolhido **não constrói por 2 voltas**.

**Por quê:** o playtest apontou lendárias tímidas demais para o custo de oportunidade (Aquisição a preço cheio raramente compensava; Despejo de 1 casa não mudava rumo — critério da raridade, §10.2), comuns do Tesouro com cara de troquinho (violação do princípio III) e duas comuns do Acaso (Apagão/Greve) fracas isoladas. A Crise punindo quem sacou transformava azar próprio em dano dobrado. As novas do Tesouro ligam a sorte a mecânicas que já existem (Loteria, construção, hipoteca) em vez de dinheiro fixo; as novas do Acaso criam pressões que o jogo não tinha (dreno de caixa parado, imposto de construção pesada, aluguel confiscado). Ideias avaliadas e **rejeitadas** na mesma sessão: Aluguel Premiado, Voo Fretado, Bagagem Extraviada, Interdição Sanitária, Mudança de Fuso, Contra-Ataque, Isenção de Aluguel, Carona, Crédito Facilitado, Dividendos (invertida em Incentivo Fiscal).

**Como aplicar:** SRS v1.26 (§10.1, §10.4–10.6 reescritos). `catalog.ts` é a fonte da composição; efeitos imediatos em `effects.ts`; ofensivas com alvo em `ofensivas.ts` (Confisco Geral herda o slot do Despejo — o `LogKind` `evict` é mantido por compatibilidade de snapshot, só a narração muda); `TempEffect` ganha os kinds `estatizacao`, `embargo`, `imunidade-total` e `valorizacao` (o kind `imunidade-temp` fica no tipo por compatibilidade, sem fonte nova). A Diplomacia passa a reagir também a Confisco Geral, Permuta Forçada e Embargo de Obras. O Bunker Fiscal cobre o Imposto Federal como cobria a Auditoria. Ids de carta antigos (`despejo-1`, `auditoria-fiscal-1`, `refinanciamento-*`, `apagao-1`, `greve-utilidades-1`) deixam de existir — partida em andamento salva com eles não é migrada (pré-lançamento; sala nova = deck novo).
