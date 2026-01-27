# D-074 — Raridade de carta não inverte probabilidade

**Data:** 2026-07-30 · **Status:** aceita · **Refina:** [D-064](D-064-rebalanceamento-do-catalogo-de-cartas.md)

**Decisão:** nenhuma carta pode ser tão provável quanto outra de nível mais raro. O
embaralhamento ponderado usa exclusivamente a raridade, com pesos **Lendária 1 / Rara 4 /
Comum 14**, independentemente de a carta ser imediata ou de mão.

Cartas lendárias e raras ficam em **1 cópia por efeito**; as cópias excedentes necessárias
para preservar os baralhos de **21 Acaso / 18 Tesouro** ficam em cartas comuns.

A redistribuição é:

- Acaso: Aquisição Hostil `2→1`, Boicote `2→1`, Avance 3 `1→2`, Volte 3 `1→2`;
- Tesouro: Bunker Fiscal `2→1`, Boom Econômico `2→1`, Erro do Banco `1→2`,
  Aniversário `1→2`.

Atalho, Investidor Anjo e Passagem de Ônibus permanecem com 2 cópias. Os demais efeitos
permanecem com 1.

**Por quê:** a composição anterior invertia a promessa da raridade. Aquisição Hostil,
lendária, era uma das cartas mais prováveis do Acaso; Bunker Fiscal e Boom Econômico,
raras, tinham o dobro da chance das lendárias do Tesouro. A vitrine de probabilidades
tornou a contradição explícita: o selo ensinava “mais raro”, enquanto as cópias entregavam
“mais frequente”.

Redistribuir só as cópias elimina inversões, mas ainda deixa Lendária e Rara empatadas. O
peso por raridade torna a hierarquia estrita sem inflar os baralhos. O peso anterior era
definido pelo modo (`imediato` ou `mão`), portanto uma Rara imediata podia ter exatamente a
mesma prioridade de uma Comum; o novo eixo único faz o selo corresponder ao sorteio.

**Custo aceito:** cartas raras de reação e as ofensivas mais fortes aparecem menos; eventos
comuns de movimento e caixa pequeno aparecem mais. Os efeitos, modos e tamanhos dos
baralhos não mudam.

**Como aplicar:** SRS v1.34 atualiza §10.2, §10.4 e §10.5. `catalog.ts` redistribui as
cópias; `decks.ts` concentra os pesos canônicos; a projeção de probabilidades usa
`peso × cópias / soma dos pesos` e testa que cada tier é estritamente menos provável que
o seguinte e que os totais continuam 21/18.
