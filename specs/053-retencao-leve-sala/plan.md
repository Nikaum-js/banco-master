# Implementation Plan: Retenção leve na sala privada

**Branch**: `main` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-retencao-leve-sala/spec.md`

## Summary

Acrescentar ao estado público da sala um array limitado de resumos finais, gravado uma vez pela autoridade na transição para `ended`. As estatísticas são projeções puras desse array. A persistência recebe migration aditiva `0007_room_match_history.sql` e novas assinaturas compatíveis das RPCs. O Ritual de Largada passa a ser apresentado por objetos de preset que resolvem para o `openingMode` existente; uma preferência local só inicializa sala recém-criada.

## Technical Context

**Language/Version**: TypeScript 6, React 19, PostgreSQL 15+

**Primary Dependencies**: Vite 8, Supabase Realtime/Postgres, Zustand indireto no jogo; nenhuma biblioteca nova

**Storage**: `public.rooms.match_history jsonb`, default `[]`, máximo 10; `localStorage` somente para id do preset

**Testing**: Vitest 4, suíte de conformidade dos adapters, SQL real via Supabase CLI, Playwright 1.62, axe

**Target Platform**: navegador host-autoritativo + Supabase; lobby desktop/tablet/celular paisagem

**Project Type**: aplicação web multiplayer frontend-first

**Performance Goals**: O(10×8) para normalização/estatísticas; JSON pequeno e crescimento constante

**Constraints**: zero dado privado; uma gravação por fato; compatibilidade deploy antes/depois da migration; `0006` intocada; nenhuma regra nova

**Scale/Scope**: 10 partidas, até 8 participantes por entrada, duas opções de preset

## Constitution Check

*GATE antes e depois do design: aprovado.*

- **I — SRS absoluto**: D-067 e SRS v1.29 antecedem a spec.
- **II — Discovery antes do código**: spec aprovada, clarificada e este plano precedem implementação.
- **III–VI**: economia, catch-up, cooperação e cartas permanecem fora do histórico.
- **VII — Resiliência**: sala legada normaliza; fallback das RPCs conserva a partida durante rollout; history não contamina revanche.
- **Privacidade**: schema por allowlist; `historyId` não autentica; códigos/uid/log/segredos não entram nas entradas.
- **Autoridade**: somente `host.accept()` cria; RPCs revalidam o host atual.

Rechecagem pós-design: nenhuma violação. A coluna aditiva e os fallbacks evitam uma migração flag-day.

## Project Structure

### Documentation (this feature)

```text
specs/053-retencao-leve-sala/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── room-history.md
│   ├── room-presets.md
│   └── persistence.md
└── tasks.md
```

### Source Code (repository root)

```text
src/net/
├── room.ts
├── roomHistory.ts
├── roomPresets.ts
├── host.ts
├── roomSession.ts
├── supabaseTransport.ts
├── localTransport.ts
└── ui/
    ├── LobbyScreen.tsx
    ├── OnlineGate.tsx
    └── RoomHistoryPanel.tsx

supabase/migrations/0007_room_match_history.sql
tests/
├── net/roomHistory.test.ts
├── net/roomPresets.test.ts
├── net/rematch.test.ts
├── net/supabaseFallback.test.ts
├── net/conformance.test.ts
├── ui/roomHistoryPanel.test.tsx
└── db/rpc.sql

src/index.css
docs/RUNBOOK.md
```

**Structure Decision**: schema/normalização da sala ficam em `room.ts`; construção/estatísticas do resumo em módulo puro; presets em catálogo puro; UI apenas projeta. O adapter traduz `matchHistory`↔`match_history`, sem regra.

## Design

### Finalização e idempotência

1. `recordFinishedMatch(room, game)` retorna a mesma referência se fase não é `ended` ou geração já existe.
2. Na transição real para `ended`, `host.accept()` atualiza `room.matchHistory` **antes** de `persistSnapshot()`.
3. A entrada nasce de `matchSummary(game)` + allowlist do assento correspondente a cada `playerId`.
4. Normalização deduplica por geração, ordena e corta as 10 maiores gerações.
5. `prepareRematch()` espalha `Room`, portanto preserva histórico, mas recria o estado do jogo.

### Identidade na sala

- `historyId` nasce aleatório na criação/entrada, por uma função injetável do host/session para testes.
- Para assento legado, `normalizeRoom` usa o `uid` atual como seed compatível e a próxima escrita o materializa.
- Reordenação e reentrada usam spread do assento, preservando `historyId`.
- A entrada não armazena `uid` nem `reentryCode`.

### Persistência e rollout

- `0007` adiciona `match_history` com default/constraint de array até 10.
- Novas sobrecargas de `write_room`/`write_snapshot` recebem o histórico; assinaturas antigas permanecem.
- `room_preview`/`read_snapshot` passam a retornar `matchHistory`.
- Frontend tenta 0007; em `PGRST202`, tenta assinatura 0006 sem histórico; na geração zero, ainda pode tentar 0005. Jogo continua durável durante rollout, sem fingir que o histórico já é.
- `reopen_room` não recebe o array: ele preserva a coluna já gravada atomicamente com o snapshot final.

### Presets

- `ROOM_PRESETS` é um `readonly` catálogo `{ id, label, detail, settings: { openingMode } }`.
- A seleção visual é derivada por `presetForOpeningMode(room.openingMode)`.
- `RoomSession.create()` aplica `initialRoomPreset` antes de entregar a sala ao host.
- `enter()` não consulta/aplica preferência.
- `setOpeningMode()` só lembra a escolha depois de sucesso da autoridade.

### Interface

- `RoomHistoryPanel` é montado apenas com `matchGeneration > 0`.
- Um `<details>` nativo contém resumo global, cartões por participante e até 10 partidas.
- Identidade visual usa `PlayerFace`; listas/tabelas têm cabeçalhos e textos acessíveis.
- A tela preserva as duas colunas e, em compacta, empilha sem overflow.

## Complexity Tracking

Nenhuma violação. A única identidade nova é necessária porque as duas existentes não servem: `playerId` é posicional e `uid` muda na reentrada; usar `reentryCode` violaria privacidade.
