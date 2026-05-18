# Implementation Plan: Hipoteca

**Branch**: `main` (feature dir `005-hipoteca`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-hipoteca/spec.md`

## Summary

Fechar o ciclo da hipoteca: **escrever** a flag `mortgaged` (cujos efeitos — sem aluguel na 003, sem construir na 004 — já existem). Adiciona um módulo puro `economy/mortgage.ts` com `mortgageProperty` (credita metade do preço, marca; bloqueia se há construção no grupo), `unmortgageProperty` (debita metade × 1,10, desmarca) e os helpers da regra de transferência (taxa de manter = metade × 0,10; custo de deshipotecar = metade × 1,10). Os 10% incidem sobre o **valor da hipoteca** (clarificação). **Sem novo estado** — reusa `Title.mortgaged`, `cash` e os preços do board. O gatilho de transferência (negociação/falência) é de outras specs; aqui ficam só as funções de regra/taxa.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: as do 002–004 — React, Vite, Tailwind, **Zustand**, **Vitest**. Nenhuma nova.

**Storage**: runtime/Zustand. **Nenhuma extensão de estado** — usa `Title.mortgaged` (003), `Player.cash` (003) e `square.price` (001).

**Testing**: Vitest. Mortgage/unmortgage são puros → testes determinísticos.

**Target Platform**: Web (desktop-first).

**Project Type**: SPA frontend único.

**Performance Goals**: O(tamanho do grupo) ≤ 4; sem I/O.

**Constraints**: lógica **pura** (efeito só no store); operações inválidas são **no-op** (padrão 002–004). Estado permanece serializável (sem novos campos).

**Scale/Scope**: escopo pequeno — 1 módulo novo (`mortgage.ts`) + 2 comandos no store.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | Operacionaliza §6.1–6.3 + a clarificação da base dos 10%. | ✅ |
| **II. Discovery antes de código** | Plan é design; usuário autorizou o pipeline completo. | ✅ |
| **III. Tesouro precisa impactar** | N/A. | ✅ |
| **IV. Catch-up é discreto** | Hipoteca não expõe rótulo de catch-up. | ✅ |
| **V. Sem dependência obrigatória de cooperação** | **Reforça V:** hipotecar dá liquidez ao jogador travado sem depender de trade. | ✅ |
| **VI. Privacidade de cartas** | N/A. | ✅ |
| **VII. Resiliência de sessão** | Sem novo estado; tudo continua serializável. | ✅ |

**Resultado:** sem violações. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/005-hipoteca/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões (sem novo estado; reuso de helpers de construção)
├── data-model.md        # Fase 1 — sem entidades novas; valor de hipoteca derivado
├── quickstart.md        # Fase 1 — verificação (SC-001..004 → testes)
├── contracts/
│   └── mortgage.md      # Fase 1 — funções/comandos de hipoteca + regra de transferência
├── checklists/
│   └── requirements.md  # Criado pelo /speckit-specify
└── tasks.md             # Fase 2 — /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/game/economy/
└── mortgage.ts          # NOVO — mortgageProperty / unmortgageProperty + helpers de regra (puras)
src/game/store.ts        # MODIFICADO — comandos mortgageProperty / unmortgageProperty

tests/game/economy/
└── mortgage.test.ts     # SC-001..004 — hipotecar, deshipotecar, bloqueios, regra de transferência
```

**Structure Decision**: a menor feature até aqui — **um** módulo novo (`mortgage.ts`) e dois comandos no store. **Não** estende tipos nem estado; apenas **escreve** a flag `mortgaged` que 003/004 já leem. Reusa o helper de "há construção no grupo" (de `construction.ts`/`titles.ts`) para o bloqueio do §6.1.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
