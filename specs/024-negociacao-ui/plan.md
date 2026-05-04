# Implementation Plan: Negociação entre jogadores na UI (M2)

**Branch**: `main` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-negociacao-ui/spec.md`

**Depende de**: 013 (executeTrade + `Trade` + imunidades §8.4) · 014 (imunidades) · 020 (store na UI)

## Summary

Acrescentar a **camada de proposta** sobre o `executeTrade` atômico (013): uma **proposta pendente** no `GameState` que o destinatário aceita (→ executa) ou recusa. Engine: extrair `validateTrade(state, trade): boolean` da validação que hoje vive dentro do `executeTrade` (que passa a delegar — refactor sem mudança), adicionar `GameState.pendingTrade: Trade | null` e os reducers puros `proposeTrade`/`acceptTrade`/`rejectTrade`. UI: um `TradeLayer` com o **compositor** (montar a oferta: destinatário, propriedades sem construção, dinheiro, imunidades nos dois sentidos) e o **modal recebido** (aceitar/recusar), aberto por um botão "Negociar". Para evitar ciclo de imports ao referenciar `Trade` no `GameState`, mover `Trade`/`ImmunityGrant` para `economy/types.ts` (módulo que `turn/types.ts` já importa).

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Zustand (store), Tailwind, Vite 8, Vitest, `motion/react`. Sem novas deps.

**Storage**: N/A — `pendingTrade` entra no `GameState` serializável (princípio VII; pensado p/ M3).

**Testing**: Vitest sobre `validateTrade` + reducers `proposeTrade`/`acceptTrade`/`rejectTrade` + helper `tradableProps`. Modais validados no `bun run dev` (sem RTL).

**Target Platform**: Web (SPA), desktop.

**Project Type**: Single project (web SPA).

**Performance Goals**: 60 fps; validação O(itens da proposta).

**Constraints**: NÃO mudar regras de troca — só extrair a validação em predicado (comportamento idêntico, testes de 013 verdes). Payload **nunca** inclui cartas/Bus Tickets/empréstimos/construções (VI / D-011/D-012). Texto pt-BR.

**Scale/Scope**: 1 tipo movido + 1 campo no GameState + 1 predicado extraído + 3 reducers + 1 helper + `TradeLayer` (2 modais) + botão "Negociar".

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. SRS é fonte de verdade**: ✅ §8 já no motor; a feature acrescenta o ciclo propor/aceitar/recusar do §8.3.
- **II. Discovery antes de código**: ✅ spec 024 aprovada (escopo decidido com o usuário) antes do plano.
- **III. Tesouro impacta**: ✅ n/a.
- **IV. Catch-up discreto**: ✅ n/a.
- **V. Sem cooperação obrigatória**: ✅ negociar é **opcional**; ninguém é forçado a aceitar. Não introduz gate de cooperação.
- **VI. Privacidade de cartas**: ✅ **crítico** — cartas em mão e Bus Tickets **não** são negociáveis e **não** existem no payload `Trade`; o compositor nunca os oferece (FR-003). Imunidades são públicas, ok negociar.
- **VII. Resiliência de sessão**: ✅ `pendingTrade` no `GameState` serializável sobrevive a recarga/reconexão (FR-011). O conteúdo em edição no compositor é estado de tela (descartável).

**Resultado**: PASS. Refactor de `validateTrade` é não-comportamental (testes 013). Sem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/024-negociacao-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── negotiation.md   # validateTrade + reducers + tradableProps
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── economy/
│   │   ├── types.ts        # +Trade/ImmunityGrant (movidos de trade.ts) — quebra o ciclo
│   │   └── trade.ts        # +validateTrade (extraído; executeTrade delega) +proposeTrade/acceptTrade/rejectTrade +tradableProps
│   ├── turn/
│   │   └── types.ts        # GameState += pendingTrade: Trade | null
│   ├── store.ts            # seed pendingTrade=null; comandos proposeTrade/acceptTrade/rejectTrade
│   └── ui/
│       └── trade/
│           └── TradeLayer.tsx  # NOVO — compositor + modal recebido
├── boards/
│   └── shared.tsx          # botão "Negociar" (abre o compositor) no PlayersPanel
└── App.tsx                 # monta <TradeLayer/>

tests/
└── game/
    └── economy/
        └── negociacao-ui.test.ts  # validateTrade + propor/aceitar/recusar + tradableProps
```

**Structure Decision**: Engine novo fica em `economy/` (junto da troca); a UI em `src/game/ui/trade/`. `TradeLayer` é o único ponto com efeito (chama os comandos). O teste acompanha `tests/game/economy/` (perto de `negociacao.test.ts` do 013).

## Notas de design (resolvidas na Fase 0)

- **`validateTrade` = fonte única**: encapsula as guardas do `executeTrade` (ids distintos, não-eliminados, dono+sem-construção dos dois lados, caixa ≥ oferta, imunidades §8.4 válidas, taxas de hipoteca não deixam ninguém negativo). `executeTrade` passa a `if (!validateTrade) return state` e recomputa as taxas para a mutação. Testes de 013 provam o refactor.
- **Reducers da proposta** (puros): `proposeTrade(state, trade)` → se `validateTrade` e `pendingTrade===null`, grava; senão no-op. `acceptTrade(state)` → se `pendingTrade` **e ainda** `validateTrade`, `executeTrade` + limpa; se inválida, no-op (mantém p/ recusar). `rejectTrade(state)` → limpa.
- **`Trade` no GameState sem ciclo**: mover `Trade`/`ImmunityGrant` para `economy/types.ts` (já importado por `turn/types.ts`). `trade.ts` re-importa de lá; nenhum outro consumidor muda (só o caminho do import).
- **Acesso**: botão "Negociar" no `PlayersPanel` abre o compositor (estado local `open`), com `<select>` de destinatário (SRS §8.3). O **modal recebido** aparece quando `game.pendingTrade !== null` (no demo de 1 cliente, logo após propor).
- **Helper `tradableProps(game, ownerId)`**: posições de propriedades do dono **sem construção** (cidades nível 0; aeroporto/utilidade sempre) — alimenta os seletores do compositor e é testável. Imunidades concedíveis = próprias mantidas (não nas listas oferecidas).
- **Não bloqueia turno**: `pendingTrade` é campo próprio (não `resolution`); o `GameDriver`/turno seguem normais.

## Complexity Tracking

> Sem violações de constitution — seção vazia.
