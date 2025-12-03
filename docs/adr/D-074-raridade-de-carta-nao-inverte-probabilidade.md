# D-074 — Raridade de carta não inverte probabilidade

**Data:** 2026-07-30 · **Status:** aceita · **Refina:** [D-064](D-064-rebalanceamento-do-catalogo-de-cartas.md)

**Decisão:** nenhuma carta pode ser mais provável que outra de nível mais raro. Cartas
lendárias e raras ficam em **1 cópia por efeito**; as cópias excedentes necessárias para
preservar os baralhos de **21 Acaso / 18 Tesouro** ficam em cartas comuns.

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

Ordenação estrita entre os três níveis não cabe nos tamanhos fixos: usar a progressão mínima
`lendária 1 / rara 2 / comum 3` exigiria mais cartas que os baralhos oficiais. O contrato,
portanto, proíbe **inversão** e aceita empate entre lendária e rara.

**Custo aceito:** cartas raras de reação e as ofensivas mais fortes aparecem menos; eventos
comuns de movimento e caixa pequeno aparecem mais. Os efeitos e os tamanhos dos baralhos
não mudam.

**Como aplicar:** SRS v1.34 atualiza §10.2, §10.4 e §10.5. `catalog.ts` redistribui as
cópias; a projeção de probabilidades testa que nenhuma carta supera outra mais rara e que
os totais continuam 21/18.
