# Implementation Plan: Tabuleiro de 48 Casas

**Branch**: `main` (feature dir `001-tabuleiro-48-casas`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-tabuleiro-48-casas/spec.md`

## Summary

Expandir o tabuleiro de 40 → 48 casas (SRS §2, decisão [D-017](../../docs/DECISIONS.md#d-017--tabuleiro-de-48-casas)), preservando o tema "Países do Mundo" (cada grupo de cor = um país; propriedades = cidades). A abordagem técnica: estender a fonte de dados estática do tabuleiro (`src/lib/boardData.ts`) para uma sequência canônica de 48 casas com cantos em 0/12/24/36, recalcular a geometria de grade de 11×11 → **13×13** nos componentes de board (`Board01Classic.tsx` e helpers em `boards/shared.tsx`), e adicionar dois novos tipos de casa (`bus-ticket` e uma 3ª utilidade). A maior parte do trabalho é **dado + geometria**, sem nova lógica de jogo (movimento, aluguel, prisão etc. já existem e apenas passam a operar sobre 48 índices).

## Technical Context

**Language/Version**: TypeScript 5.x (React 19 + Vite)

**Primary Dependencies**: React, Vite, TailwindCSS, Zustand (estado), Supabase (realtime + persistência) — conforme CLAUDE.md §3. Render do board é CSS Grid puro.

**Storage**: Dado de tabuleiro é estático em código (`boardData.ts`). Estado de partida (donos, construções, posições) é runtime/Zustand e, futuramente, Supabase. Esta feature não cria persistência nova.

**Testing**: Verificação visual no browser (Vite dev server) + asserts estruturais simples (contagem de casas, posições de canto). Sem framework de teste configurado ainda no projeto.

**Target Platform**: Web (desktop-first; o board é um quadrado responsivo travado pela altura da viewport).

**Project Type**: Single-page web app (frontend único). Sem backend nesta feature.

**Performance Goals**: Render do board a 60fps; o array de 48 casas é estático e trivial. Sem regressão perceptível vs. as 40 atuais.

**Constraints**: Board permanece **quadrado** e responsivo. O perímetro de 48 (11/lado + 4 cantos) mapeia para grade 13×13. As bandeiras-avatar continuam transbordando sobre o centro (board-square sem `overflow-hidden`).

**Scale/Scope**: 48 casas, 8 grupos/países, até 8 jogadores. Escopo de código: ~3 arquivos (`boardData.ts`, `Board01Classic.tsx`, `boards/shared.tsx`) + ajuste de tokens/ícones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | O plan operacionaliza SRS §2 (já atualizado para 48) e D-017. Não inventa regra nova; placement segue convenção Richup/Mega documentada. | ✅ |
| **II. Discovery antes de código** | Este plan é **design**, não código de produção. O usuário invocou `/speckit-plan` explicitamente (gate de confirmação cumprido). Nenhuma linha de produção é escrita aqui; implementação fica para `/speckit-implement`, com novo OK. | ✅ |
| **III. Tesouro precisa impactar** | Baralho Tesouro não é tocado (mantém 3 casas Tesouro). Sem impacto. | ✅ N/A |
| **IV. Catch-up discreto** | Não afetado (GO Progressivo/Free Parking inalterados; apenas reposicionados nos novos índices). | ✅ |
| **V. Sem dependência obrigatória de cooperação** | Reforçado: grupos maiores (3-4) + monopólio parcial preservado. Nenhum gate de cooperação introduzido. | ✅ |
| **VI. Privacidade estratégica de cartas** | Espaço Bus Ticket alimenta o contador de Bus Tickets (separado das 3 cartas, D-012). Atributos de privacidade/limite intactos. | ✅ |
| **VII. Resiliência de sessão** | Não afetado. | ✅ |

**Resultado:** sem violações. Sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-tabuleiro-48-casas/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — sequência canônica das 48 casas + decisões
├── data-model.md        # Fase 1 — entidades/schema (novo kind bus-ticket, 3ª utilidade)
├── quickstart.md        # Fase 1 — como verificar a estrutura
├── contracts/
│   └── board-layout.md  # Fase 1 — contrato da grade 13×13 e do mapa pos→tipo
├── checklists/
│   └── requirements.md  # Criado pelo /speckit-specify
└── tasks.md             # Fase 2 — criado por /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── boardData.ts          # BOARD: 40 → 48 entradas; +kind 'bus-ticket'; 3ª utility; GROUPS premium com 4 cidades
├── boards/
│   ├── Board01Classic.tsx    # gridArea(): 11×11 → 13×13; gridTemplate 13 colunas/linhas
│   └── shared.tsx            # sideOf() cantos 0/12/24/36; SquareIcon p/ bus-ticket e 3ª utility; ClassicSquare inalterado no essencial
└── index.css                 # token de cor da 3ª utility / ícone, se necessário
```

**Structure Decision**: Single-page web app já existente. A feature **estende** três arquivos do protótipo atual; não cria novos módulos nem nova camada. O board é renderizado via CSS Grid no `Board01Classic.tsx`, com a matemática de posição em funções puras (`gridArea`, `sideOf`) — são esses os pontos exatos que mudam de 11×11 (40) para 13×13 (48).

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
