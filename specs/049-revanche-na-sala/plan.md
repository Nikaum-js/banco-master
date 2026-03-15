# Implementation Plan: Revanche na mesma sala

**Branch**: `049-revanche-na-sala` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/049-revanche-na-sala/spec.md`

## Summary

Transformar a sala em um contêiner durável de várias partidas sequenciais. A autoridade marca o encerramento, a classificação permanece aberta por cliente e o host executa uma operação atômica de reabertura que incrementa `matchGeneration`, limpa o snapshot e devolve a sala ao lobby. O `seq` continua monotônico por toda a vida da sala, o que mantém as guardas atuais de ordenação. A tela final recebe hierarquia visual Atlas, comportamento responsivo e CTA contextual.

## Technical Context

**Language/Version**: TypeScript 6.0, SQL PostgreSQL/Supabase

**Primary Dependencies**: React 19, Vite 8, Zustand 5, Supabase JS 2, Motion 12

**Storage**: tabela `public.rooms` no Supabase; snapshot público + segredos na mesma linha

**Testing**: Vitest 4, Testing Library, Playwright, suíte de conformidade dos adapters

**Target Platform**: browsers desktop e mobile em paisagem, publicação estática na Vercel

**Project Type**: aplicação web SPA multiplayer

**Performance Goals**: uma única escrita atômica para reabrir; nenhuma nova assinatura realtime; tela final sem rolagem horizontal em 768 px

**Constraints**: host é autoridade única; cartas continuam privadas; snapshot não pode regredir; reentrada continua possível; sem timer de turno

**Scale/Scope**: 2–8 participantes por sala, quantidade indefinida de partidas sequenciais, uma nova migration aditiva

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I — SRS absoluto: PASS.** D-052 e SRS v1.19 foram registrados antes da spec.
- **II — Discovery antes de código: PASS.** Spec 049 está aprovada antes da implementação do ciclo de revanche.
- **III — Tesouro: N/A.** Nenhuma carta ou magnitude é alterada.
- **IV — Catch-up discreto: N/A.** Nenhuma mecânica de catch-up é alterada.
- **V — Sem cooperação obrigatória: PASS.** A nova partida não cria gates entre jogadores.
- **VI — Privacidade de cartas: PASS.** O reset apaga mãos e segredos; a divisão de perspectiva permanece.
- **VII — Resiliência: PASS.** Sala, assentos, reentrada e autoridade sobrevivem; geração e sequência impedem regressão.

**Recheck pós-design**: PASS. A operação `reopenRoom` é uma escrita autoritativa atômica; o estado final continua recuperável até essa transição, e a nova geração nunca reutiliza o snapshot antigo.

## Project Structure

### Documentation (this feature)

```text
specs/049-revanche-na-sala/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rematch-lifecycle.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/ui/
│   ├── EndGameScreen.tsx
│   └── GameHUD.tsx
├── net/
│   ├── client.ts
│   ├── host.ts
│   ├── localTransport.ts
│   ├── room.ts
│   ├── roomSession.ts
│   ├── supabaseTransport.ts
│   ├── transport.ts
│   └── ui/OnlineGate.tsx
└── index.css

tests/
├── net/
│   ├── boot.test.ts
│   ├── conformance.test.ts
│   ├── rematch.test.ts
│   └── snapshot-legacy.test.ts
└── ui/endGame/endGameScreen.test.tsx

supabase/migrations/
└── 0006_rematch_generation.sql
```

**Structure Decision**: manter as fronteiras existentes. Regra pura de sala em `room.ts`; autoridade e persistência em `host.ts`/transports`; coordenação de tela em `roomSession.ts`; React apenas escolhe a superfície.

## Complexity Tracking

Sem violações.
