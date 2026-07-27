# Tasks: Vitrine de probabilidades dos baralhos

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Ordem importa: T1→T2 antes de qualquer UI (a projeção fica verde sozinha), T3→T5 depois.
`[P]` = paralelizável com a task anterior.

## Fase 1 — Dado

- [x] **T1** `src/game/cards/catalog.ts`: exportar `CARD_DEFS` (as definições com `copies`), sem
  alterar `CARDS`, `cardById` ou `deckCardIds`. Comentário dizendo por que a definição é exportada
  (agrupar de volta as 39 unidades expandidas seria inferência, não fonte).

## Fase 2 — Projeção (o contrato)

- [x] **T2** `src/game/ui/cards/deckOdds.ts`: `deckOdds(deck: DeckId): DeckOdds`.
  - assinatura **sem** `GameState` — é o que torna FR-002/SC-005 verificável por tipo;
  - filtra `status !== 'implementado'` fora da lista **e** do denominador (FR-006);
  - `total` = soma de `copies` (nunca constante 21/18);
  - `probability` = `RARITY_WEIGHT[rarity] × copies / soma dos pesos`, fração **não** arredondada;
  - ordena por `probability` ↑, `rarity` ↓ (lendária>épica>rara>comum), `title` `localeCompare('pt-BR')`;
  - título/desc de `CARD_LABEL`/`cardDesc` (spec 029), nunca texto novo;
  - comentário no topo citando D-037 e explicando por que não se lê o deck vivo.
- [x] **T3** `tests/game/cards/deckOdds.test.ts` — os 6 casos do plan §6:
  contagem (18/21 e 14/18) · soma `copies`=`total` · ordenação crescente + desempate ·
  agrupamento de cópias (Atalho 1 linha, `copies` 2, `probability` 218/2179) ·
  `deferido` fora da lista e do denominador · invariância ao andamento da partida.

## Fase 3 — Tela

- [x] **T4** `src/game/ui/cards/DeckOddsModal.tsx`: `Overlay` + `ModalShell` + `ModalHeader`
  reusados de `@/game/ui/shell` (casca igual aos outros por reuso, não por imitação).
  - largura ~600px com `max-w-[calc(100vw-2rem)]` e lista `overflow-y`;
  - cada linha é `<button>` com `aria-expanded`/`aria-controls` alternando a descrição, que vive
    **em DOM** (não em `title=`) — FR-008;
  - raridade com `RARITY_COLOR` **e** `RARITY_PIPS` — FR-009;
  - chance formatada com 1 casa decimal; `copies` visível quando > 1.
- [x] **T5** `[P]` `src/index.css`: seção nova `.deck-odds-*`, sem tocar regras existentes.
- [x] **T6** `src/boards/Board01Classic.tsx`: incluir `acaso`/`tesouro` em `isClickable` (linha 94)
  e renderizar `DeckOddsModal` para a casa selecionada. Não entra na fila do `ModalLayer` (FR-011).

## Fase 4 — Prova

- [x] **T7** `tests/ui/deckOddsModal.test.tsx` — os 5 casos do plan §6:
  abre pela casa certa (Acaso/Tesouro) · ordem do DOM = ordem da projeção · descrição alcançável
  **sem** ponteiro com `aria-expanded` correto · Esc fecha e devolve foco · mesmo conteúdo nos dois
  mapas.
- [x] **T8** `bunx tsc --noEmit`, `bun run lint`, suíte Vitest, screenshot real dos dois modais.

## Rastreio

| FR | Task |
|---|---|
| FR-001 | T6 |
| FR-002, FR-005, FR-006 | T2, T3 |
| FR-003, FR-004 | T2, T3 |
| FR-007 | T2 |
| FR-008 | T4, T7 |
| FR-009 | T4 |
| FR-010 | T4, T6, T7 |
| FR-011 | T6 |
| FR-012 | T7 |
| FR-013 | nenhuma task toca catálogo, saque ou Bilhete — provado por T8 (suíte inteira verde) |
| FR-014 | T3, T7 |
