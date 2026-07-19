# Implementation Plan: Vitrine de probabilidades dos baralhos

**Spec**: [spec.md](./spec.md) · **Criado**: 2026-07-30 · **Status**: aprovado para implementação

## 1. Stack e camadas tocadas

Nada novo entra na stack: React + TypeScript + Tailwind, sobre os primitivos de modal que já
existem. A feature é **apresentação pura** — não toca motor, não toca rede, não toca Supabase.

| Camada | Arquivo | O que acontece |
|---|---|---|
| Projeção (novo) | `src/game/ui/cards/deckOdds.ts` | função pura catálogo → linhas ordenadas |
| Apresentação (novo) | `src/game/ui/cards/DeckOddsModal.tsx` | o modal informativo |
| Integração | `src/boards/Board01Classic.tsx` | casa de carta passa a ser clicável e abre o modal |
| Estilo | `src/index.css` | classes da lista (uma seção nova, sem tocar as existentes) |
| Testes | `tests/game/cards/deckOdds.test.ts`, `tests/ui/deckOddsModal.test.tsx` | contrato + tela |

## 2. A decisão que carrega o desenho: a projeção não recebe estado

```ts
export function deckOdds(deck: DeckId): DeckOdds
```

A assinatura é o requisito. `deckOdds` recebe **só o id do baralho** — não há parâmetro de
`GameState`, então é impossível ler baralho vivo, descarte ou mão sem alterar a assinatura, e
alterar a assinatura é uma mudança que aparece em code review. Isso torna FR-002 e SC-005
verificáveis por inspeção de tipo, não por disciplina.

É também o que faz a feature funcionar fora do anfitrião: a D-037 garante que o baralho **não
trafega**, então qualquer desenho que dependesse do estado vivo estaria quebrado em 7 dos 8
clientes de uma mesa cheia. A composição impressa é a única fonte que todo cliente tem.

## 3. A projeção

Entra `CARD_DEFS` como export novo de `catalog.ts`. Hoje o arquivo só exporta `CARDS` (as 39
unidades já expandidas por `expand()`), e reconstruir as cópias a partir delas seria agrupar de
volta o que o próprio módulo acabou de desagregar — com risco de o agrupamento discordar da
definição. Exportar a definição é a fonte, não uma inferência.

```ts
interface DeckOddsRow {
  effect: string      // chave no registry — identidade estável
  title: string       // CARD_LABEL (spec 029)
  desc: string        // CARD_DESC (spec 029)
  rarity: Rarity
  copies: number
  probability: number // fração 0..1, NÃO arredondada
}
interface DeckOdds { deck: DeckId; total: number; rows: DeckOddsRow[] }
```

Ordem (FR-004): `probability` crescente → `rarity` decrescente (lendária > rara > comum) →
`title` por `localeCompare('pt-BR')`. As três chaves são necessárias: 11 comuns do Acaso empatam
em 1/21, e sem a terceira chave a ordem depende da ordem de declaração no catálogo.

`probability` fica **fração não arredondada** e o arredondamento acontece só na formatação. Guardar
já arredondado faria a soma dos itens divergir de 1 e contaminaria o teste de soma — que, por
decisão da spec, é sobre **contagem de cartas** (soma de `copies` = `total`), não sobre percentuais.

`total` é a soma de `copies` dos itens `implementado` — não uma constante 21/18 escrita à mão.
Assim FR-006 cai fora de graça: filtrar `deferido` tira a carta da lista **e** do denominador,
sem um segundo lugar para esquecer de atualizar.

## 4. O modal

`DeckOddsModal` monta `Overlay` + `ModalShell` + `ModalHeader`, os mesmos de `ModalLayer` — a
casca não é reescrita, é reusada, então "igual aos outros" é estrutural e não visual-por-imitação.

Largura na faixa do `bus-picker-modal` (~600px): 18 linhas com título, selo de raridade, chance e
descrição não caberiam nos 300–360px do cartão central de decisão.

**A explicação sem depender de hover (FR-008)** é o ponto de acessibilidade. Cada linha é um
`<button>` que alterna a própria descrição, com `aria-expanded` e `aria-controls` apontando para o
parágrafo; a descrição fica em DOM sempre (não é `title=`), então leitor de tela e toque a
alcançam. Hover e foco apenas antecipam a mesma revelação — o ponteiro é atalho, não requisito.

Raridade entra com `RARITY_COLOR` **e** `RARITY_PIPS` (FR-009). O comentário de `cardMeta.ts` já
registra por que os losangos existem: laranja e verde a 4,5:1 sobre tinta continuam sendo duas
cores para quem não as distingue. Reusar os dois mantém o gate AA da 044 sem auditoria nova.

## 5. Integração no tabuleiro

Em `Board01Classic.tsx`, `isClickable` (linha 94) passa a incluir `acaso` e `tesouro`. O `<button>`
de casa já existe com `aria-haspopup="dialog"`, `aria-expanded` e devolução de foco — herdamos
FR-010 do que a spec 044 construiu, sem caminho novo de teclado.

Diferença deliberada em relação a propriedade/ferrovia/mina: aquelas abrem **popover ancorado**
(`PropertyPopover` & cia.), esta abre **modal centrado**. Não é inconsistência — é o conteúdo
mandando na forma: popover serve a um cartão de escritura ao lado da casa; 18 linhas com descrição
expansível exigem área que um balão ancorado não tem sem cobrir meio tabuleiro.

**FR-011** (não abrir sobre decisão pendente): a vitrine não entra na fila do `ModalLayer`, que é
dirigida por `state.resolution`. Ela vive no board layer com estado local de seleção, e o
`ModalLayer` renderiza **por cima** quando há resolução — a decisão nunca fica atrás da vitrine, e
fechar a vitrine não fecha decisão nenhuma.

## 6. Testes

**Unidade** (`deckOdds.test.ts`) — o contrato que não pode regredir:

1. Acaso: 18 linhas, `total` 21; Tesouro: 14 linhas, `total` 18.
2. soma de `copies` = `total` nos dois baralhos (SC-002).
3. `probability` crescente ao longo de `rows`; empate desempatado por raridade e nome.
4. cópias agrupadas: Aquisição Hostil aparece 1×, com `copies: 2` e `probability` 2/21.
5. `deferido` fica fora da lista **e** do denominador — provado marcando um def como deferido.
6. **invariância ao estado** (SC-003): duas chamadas iguais em pontos diferentes da partida
   devolvem o mesmo objeto de valores; e a assinatura não aceita estado (garantido por tipo).

**Apresentação** (`deckOddsModal.test.tsx`):

7. clicar na casa de Acaso abre a vitrine; a de Tesouro abre a do Tesouro.
8. ordem renderizada é a ordem da projeção (o DOM não reordena).
9. a descrição de um item é alcançável **sem** ponteiro: Tab + acionar revela, com
   `aria-expanded` correto.
10. Esc fecha e o foco volta para a casa que abriu.
11. nos dois mapas (atlas e fuligem) a vitrine mostra o mesmo conteúdo de baralho.

## 7. Ordem de execução

1. `CARD_DEFS` exportado de `catalog.ts` (mudança mínima, nada mais muda).
2. `deckOdds.ts` + teste de unidade — verde antes de existir UI.
3. `DeckOddsModal.tsx` + CSS.
4. `isClickable` no Board01Classic + fiação do modal.
5. Teste de apresentação/acessibilidade.
6. `tsc`, lint, suíte, screenshot real.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Alguém “melhorar” a vitrine lendo o deck vivo | assinatura sem estado + teste 6 + comentário citando D-037 no topo de `deckOdds.ts` |
| Catálogo mudar e a vitrine mentir | `total` derivado de `copies`, nunca constante; teste 1 quebra se a composição mudar sem revisar |
| Vitrine cobrir decisão pendente | vive fora da fila do `ModalLayer`, que renderiza acima |
| Modal grande em paisagem de celular | largura em `max-w-[calc(100vw-2rem)]` e lista com `overflow-y`, como o `bus-picker-modal` já faz |
