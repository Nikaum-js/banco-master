# Implementation Plan: Prazo do crédito, contrapartida na troca e faixa de cobrança

**Branch**: `050-credito-troca-e-cobranca` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/050-credito-troca-e-cobranca/spec.md`

## Summary

Três mudanças independentes que compartilham o mesmo caminho de saída — a cobrança de dívida.

O empréstimo ganha um contador de voltas no próprio registro e passa a vencer na terceira passagem do devedor pelo GO, cobrando juros e principal na mesma porta que já cobra os juros hoje; o caminho de caixa insuficiente reusa integralmente a dívida pendente que já existe, sem inventar estado novo. A negociação ganha uma avaliação pura de proposta e um piso de contrapartida, aplicado dentro do `validateTrade` que criação e aceitação já compartilham. E a cobrança de dívida deixa de ser cartão centralizado: vira uma faixa ancorada na base que reserva altura do palco, de modo que o tabuleiro encolhe em vez de ficar coberto.

## Technical Context

**Language/Version**: TypeScript 6.0

**Primary Dependencies**: React 19, Vite 8, Zustand 5, Motion 12, Tailwind 4

**Storage**: snapshot de partida no Supabase; nenhum schema novo — o contador de voltas viaja dentro do `GameState` já serializado

**Testing**: Vitest 4, Testing Library, Playwright

**Target Platform**: browsers desktop e mobile em paisagem

**Project Type**: aplicação web SPA multiplayer

**Performance Goals**: avaliação de proposta em tempo constante sobre os itens da troca; faixa sem custo de layout fora do período de cobrança

**Constraints**: motor puro e determinístico (host e cliente reproduzem o mesmo resultado); nenhuma leitura de relógio no motor; cartas continuam privadas; snapshot antigo sem o contador precisa continuar carregando

**Scale/Scope**: 2–8 jogadores, um empréstimo ativo por devedor, propostas simultâneas sem limite fixo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — SRS absoluto: PASS.** D-054, D-055, D-056 e SRS v1.21 foram registrados antes desta spec.
- **II — Discovery antes de código: PASS.** As três ambiguidades foram fechadas antes da implementação.
- **III — Tesouro precisa impactar: N/A.** Nenhuma carta é alterada.
- **IV — Catch-up discreto: PASS.** O prazo e o piso valem igual para todos, não olham posição na mesa e não são apresentados como ajuda a quem está atrás.
- **V — Sem cooperação obrigatória: PASS.** O empréstimo continua opcional dos dois lados; a trava de troca só recusa proposta, nunca exige que alguém aceite.
- **VI — Privacidade de cartas: PASS.** A avaliação de proposta não olha mão; cartas seguem fora da negociação.
- **VII — Resiliência de sessão: PASS.** O prazo é contado por evento de jogo (GO do devedor), não por tempo — desconexão não consome prazo.

**Recheck pós-design**: PASS. O contador vive no `Loan`, dentro do snapshot que já é reproduzido byte a byte; a cobrança do vencimento acontece na porta determinística `afterPassGo`, e a faixa é apresentação sem estado de partida.

## Project Structure

### Documentation (this feature)

```text
specs/050-credito-troca-e-cobranca/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── economy/
│   │   ├── appraisal.ts        (novo — avaliação e piso de contrapartida)
│   │   ├── trade.ts
│   │   └── types.ts
│   ├── emprestimos/emprestimos.ts
│   ├── ui/
│   │   ├── GameHUD.tsx
│   │   ├── debt/DebtDock.tsx   (novo — faixa de cobrança)
│   │   ├── log/describeLog.ts
│   │   └── trade/TradeLayer.tsx
│   └── setup.ts
├── boards/shared.tsx
└── index.css

tests/
├── game/
│   ├── emprestimos/emprestimos.test.ts
│   └── economy/negociacao.test.ts
└── ui/
    ├── debtDock.test.tsx       (novo)
    └── tradePresentation.test.tsx
```

**Structure Decision**: manter as fronteiras existentes. Regra pura em `game/economy` e `game/emprestimos`; a avaliação nasce em módulo próprio porque é consultada tanto pelo motor quanto pela interface que explica a recusa. A faixa sai do `GameHUD` para um componente próprio: o clima de dívida deixou de ser um cartão como os outros e não deve continuar dentro do `switch` de cartões.

## Complexity Tracking

Sem violações. O único acoplamento novo é `trade.ts → appraisal.ts`, na mesma camada.
