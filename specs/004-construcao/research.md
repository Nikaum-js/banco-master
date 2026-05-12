# Research — Construção (Fase 0)

Decisões técnicas. Estende a economia da 003 de forma aditiva.

---

## D1 — Construção co-locada no `Title` (`houses` / `hotel`)

- **Decisão:** adicionar `houses: number` (0–4) e `hotel: boolean` ao `Title` (003). Construção só é significativa em cidades; aeroporto/utilidade ignoram.
- **Rationale:** o lookup de aluguel já parte do `Title[pos]`; manter a construção ali evita um mapa paralelo e mantém a posse e a construção juntas.
- **Alternativas:** `GameState.constructions: Record<pos, level>` separado — rejeitada: duplicaria a chave `pos` e o ciclo de vida do título.

## D2 — Estoque do banco no `GameState.bank` (40/16)

- **Decisão:** `GameState.bank = { houses: number; hotels: number }`, semente `{ houses: 40, hotels: 16 }` (D-017). Build consome; sell/desmonte devolve.
- **Rationale:** estoque é estado global serializável; numérico simples. A escassez (e o leilão) deriva de `bank.houses === 0` (ou < pedido).
- **Alternativas:** derivar estoque contando construções no board — rejeitada: O(n) e frágil; um contador é direto e serializável.

## D3 — Multiplicadores de custo/aluguel provisórios no código (tema)

- **Decisão:** os valores de **custo de construção** e da **tabela de aluguel por nível** são **dado de tema** (SRS §5.1). No código entram como **multiplicadores provisórios** sobre o `rent`/`price` base do board (001), claramente marcados — espelhando a escada de preços provisória ($60–$400) já usada em `boardData.ts`.
  - Aluguel por nível (provisório): `rent × [5, 15, 45, 80]` para 1–4 casas, `rent × 100` para hotel.
  - Custo de construção (provisório): `round(price / 2)`; venda = metade do custo.
- **Rationale:** mantém a feature funcional e testável sem inventar a tabela final; o tema substitui depois sem mudar a regra (70%/100%, uniformidade, metade na venda).
- **Alternativas:** travar até o tema definir os números — rejeitada: bloquearia a implementação por dado cosmético.

## D4 — Construção tem precedência sobre o escalonamento por posse no aluguel

- **Decisão:** `rentCity` passa a checar **primeiro** se a cidade tem construção: se sim, aluguel = `tabelaConstrução(nível) × (0.7 parcial | 1.0 completo)`; se não, mantém o escalonamento por posse da 003 (base/150%/200%).
- **Rationale:** §5.1 trata as situações como mutuamente exclusivas — "com construção" substitui "sem construção".
- **Alternativas:** somar construção ao escalonamento — rejeitada: dobra a regra, contraria o §5.1.

## D5 — Leilão de casas reusa o padrão de leilão da 003

- **Decisão:** o leilão de casas é um novo `ResolutionSlice` `house-auction` (análogo ao `auction` da 003), com `deadline` serializável e timer no store. Acionado quando o pedido do jogador ativo **excede** `bank.houses`, entre os jogadores que declararem interesse (clarificação).
- **Rationale:** reaproveita a infra de lance/timer/serialização já testada da 003; consistência de UX.
- **Alternativas:** mecanismo próprio — rejeitada: reinventaria o leilão.

## D6 — Build/sell como funções puras com validação (no-op se inválido)

- **Decisão:** `buildHouse`/`sellBuilding` são puras `(state) → state`, validando maioria, uniformidade, hipoteca, caixa e estoque; se inválido, **no-op** (retornam o estado original) — como os comandos do 002/003.
- **Rationale:** consistência com a base; estados ilegais não representáveis; testável.
- **Alternativas:** lançar exceção — rejeitada: o padrão do projeto é no-op em comando inválido.

---

## Itens de regra já fixados

- **Maioria para construir:** 2 de 3 / 3 de 4 (001 FR-013 / D-004).
- **Uniformidade:** só constrói na cidade com menos casas do grupo; diferença ≤ 1.
- **Hotel:** substitui 4 casas (voltam ao estoque) e consome 1 hotel; inverso na venda; desmonte forçado do grupo se faltar casa (§5.5).
- **2º hotel / Skyscraper / Hangar:** fora — deferidos (Balanceamento).

Nenhum `NEEDS CLARIFICATION` pendente (o leilão de casas foi resolvido no clarify).
