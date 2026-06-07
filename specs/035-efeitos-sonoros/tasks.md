---
description: "Task list — Efeitos sonoros (SFX)"
---

# Tasks: Efeitos sonoros (SFX) da partida

**Input**: Design documents from `/specs/035-efeitos-sonoros/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/sound-api.md ✓

**Tests**: incluídos para as **funções puras** (`classify`/`prefs`) — explicitamente pedidos no plano (`Estratégia de testes`). Engine/`SoundLayer` são verificados de ouvido no `bun run dev` (sem RTL de áudio).

**Organization**: por user story (US1/US2 = P1; US3/US4 = P2). Gerenciador: **bun**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivo diferente, sem dependência pendente)
- Caminhos de arquivo são exatos.

---

## Phase 1: Setup (infraestrutura compartilhada)

**Purpose**: estrutura do módulo de som e catálogo de cues.

- [x] T001 Criar o diretório do módulo `src/game/ui/sound/` e o diretório de assets `src/assets/sfx/`.
- [x] T002 [P] Criar `src/game/ui/sound/cues.ts` com `type SoundCue` (union completo da data-model) e `export const CUE_SRC: Partial<Record<SoundCue,string>>` (mapa cue→URL via import Vite; começa parcial/vazio — cue ausente é silencioso, FR-006).
- [ ] T003 [P] Adicionar 3–4 assets `.webm` de exemplo (CC0/royalty-free) em `src/assets/sfx/` para os cues de alta frequência (`dice-roll`, `buy`, `rent-paid`, `bankruptcy`) e referenciá-los em `CUE_SRC`.

---

## Phase 2: Foundational (pré-requisito bloqueante)

**Purpose**: o engine de áudio e o `SoundLayer` headless — necessários por TODAS as stories.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [x] T004 Implementar `src/game/ui/sound/engine.ts`: `AudioContext` lazy (criado no 1º `play`), `GainNode` master (default volume cheio), cache `buffers: Map<SoundCue,AudioBuffer>` (`fetch`+`decodeAudioData`), e `play(cue)` não-bloqueante que **nunca lança** (try/catch) — no-op se asset ausente/não-destravado (FR-019/FR-020).
- [x] T005 Adicionar a `engine.ts` o **throttle anti-spam** por cue: `Map<SoundCue,number>` com `performance.now()`, descartando o mesmo cue em janela `< MIN_GAP_MS` (~70ms) (FR-009).
- [x] T006 Adicionar a `engine.ts` `ensureUnlockListener()` (listener único `pointerdown`/`keydown`/`touchstart`, capture+once → `ctx.resume()`) e `setMasterGain(volume, muted)` (FR-015).
- [x] T007 Criar `src/game/ui/sound/SoundLayer.tsx` headless (retorna `null`), com `ensureUnlockListener()` no mount e `logCursor` (`useRef`) iniciado em `game.log.length` (sem replay — FR-011).
- [x] T008 Montar `<SoundLayer/>` em `src/App.tsx` (ao lado de `GameDriver`/`NoticeLayer`).

**Checkpoint**: engine toca cues e `SoundLayer` está montado — stories podem começar.

---

## Phase 3: User Story 1 - Ações e eventos têm retorno sonoro (Priority: P1) 🎯 MVP

**Goal**: cada gatilho do catálogo dispara o cue correto, uma vez por ocorrência, idêntico em todos os clientes.

**Independent Test**: disparar rolagem/compra/aluguel/falência pelo motor e ouvir o cue certo no `bun run dev`; testes puros de classificação verdes.

### Tests for User Story 1 ⚠️

- [x] T009 [P] [US1] Criar `tests/game/ui/sound/classify.test.ts`: `classifyLogEntry` por prefixo (imposto/aluguel/GO/juros/faliu/saque/bus-ticket) e textos não cobertos → `null`; `card-draw` **genérico** (não vaza raridade — FR-016/SC-004).
- [x] T010 [P] [US1] Estender `tests/game/ui/sound/classify.test.ts`: `cueForRoll` ramifica `dice-roll`/`dice-double`/`dice-speed`/`dice-bus`; `cueForResolution` cobre todos os `kind`; `cueForNotice` cobre `free-parking`/`hostile-takeover`.

### Implementation for User Story 1

- [x] T011 [US1] Implementar `src/game/ui/sound/classify.ts` (funções **puras**): `classifyLogEntry`, `cueForRoll`, `cueForResolution`, `cueForNotice`, conforme `contracts/sound-api.md` (fazer T009/T010 passarem). **C1**: nesta fatia "… troca aceita" → `null` (não adicionar `trade-done` ao union agora).
- [x] T012 [US1] No `SoundLayer.tsx`, **Canal 1** (transições tipadas via seletores + `useRef`): rolagem (`turn.lastRoll`), `resolution.kind` (borda de subida), `notice.kind`, prisão (`jail.inJail` ↑/↓), fim de jogo (`phase==='ended'` → `win`), pregão (`landAuction` lances → `auction-bid` / fechamento → `auction-close`), empréstimo (`loans.length` ↑).
- [x] T012b [US1] **C2** — Ações de comando por **delta de estado compartilhado** (FR-008, sem chamar no store): contagem de construções por `titles`/`pos` sobe → `build`, desce → `sell`; flag de hipoteca on/off → `mortgage`/`unmortgage`; `resolution` `purchase`→`null` sem compra concluída → `decline`; jogar carta da mão (queda em `hand` + efeito) → `card-play`. Cues sem asset/decisão clara ficam silenciosos (FR-006).
- [x] T013 [US1] No `SoundLayer.tsx`, **Canal 2** (tail do log): consumir entradas além de `logCursor`, mapear por `classifyLogEntry`, `play` e avançar o cursor (idempotente — FR-007).
- [x] T014 [US1] Garantir **um cue por canal** (ex.: falência só no Canal 2; oferta de compra só no Canal 1) — revisar para não haver disparo duplo; `win` tem prioridade sobre `bankruptcy` no mesmo tick (Edge Case).
- [ ] T015 [P] [US1] Adicionar assets em `src/assets/sfx/` e mapear em `CUE_SRC` para os cues de US1 (dados/compra/aluguel/imposto/GO/dívida/cartas-públicas/pregão/prisão/falência/vitória). Cues sem asset ficam silenciosos.

**Checkpoint**: jogo soa nas ações/eventos principais, em qualquer cliente que observe o estado.

---

## Phase 4: User Story 2 - Controle de áudio: mute e volume (Priority: P1)

**Goal**: silenciar/ajustar volume, com preferência persistida por dispositivo; áudio ligado por padrão.

**Independent Test**: alternar mute → silêncio; ajustar volume → intensidade muda; reload → prefs preservadas.

### Tests for User Story 2 ⚠️

- [x] T016 [P] [US2] Criar `tests/game/ui/sound/prefs.test.ts`: defaults `{muted:false, volume:0.6}`; `setMuted/setVolume` persistem e re-hidratam de `localStorage`; mute resulta em ganho efetivo 0 (mock de `engine.setMasterGain`).

### Implementation for User Story 2

- [x] T017 [US2] Implementar `src/game/ui/sound/prefs.ts`: `useAudioPrefs` (zustand + middleware `persist`, chave `bm.audio`), defaults `{muted:false, volume:0.6}` (FR-012); `setMuted`/`setVolume` atualizam o store **e** chamam `engine.setMasterGain` (FR-013/FR-014).
- [x] T018 [US2] Fazer o `engine` aplicar o ganho inicial a partir do `useAudioPrefs` na 1ª criação do `AudioContext` (respeitar prefs já salvas no boot).
- [x] T019 [US2] Criar `src/game/ui/sound/AudioControl.tsx` (botão mute com ícone de alto-falante + slider de volume) ligado a `useAudioPrefs`.
- [x] T020 [US2] Montar `<AudioControl/>` em `src/game/ui/GameHUD.tsx`.

**Checkpoint**: US1 + US2 funcionam — som controlável e persistente.

---

## Phase 5: User Story 3 - Movimento do peão soa casa a casa (Priority: P2)

**Goal**: tick por casa percorrida + som de parada; saltos diretos só tocam a chegada.

**Independent Test**: mover N casas → N ticks + 1 parada; Bus Ticket (salto) → só parada.

### Implementation for User Story 3

- [x] T021 [US3] Em `src/game/ui/LiveTokens.tsx` (`useWalkedPositions`), **Canal 3**: ao avançar +1 casa real (`fwd∈[1..WALK_MAX]`) → `play('step-tick')`; ao um peão em movimento atingir o alvo → `play('step-land')`.
- [x] T022 [US3] No mesmo hook, **snap/teleporte** (ramo `else`: Bus Ticket/atalho) → só `step-land`, **sem** ticks (FR-010/US3 cenário 3).
- [ ] T023 [P] [US3] Adicionar assets `step-tick`/`step-land` em `src/assets/sfx/` e mapear em `CUE_SRC` (ticks curtos; throttle de T005 evita rajada).

**Checkpoint**: movimento sonoro alinhado à animação.

---

## Phase 6: User Story 4 - Destravar áudio respeitando o autoplay (Priority: P2)

**Goal**: 1º gesto destrava o áudio; antes disso o app nunca quebra.

**Independent Test**: carregar sem interagir → evento não quebra (pode não soar); após 1º clique → eventos seguintes soam.

### Implementation for User Story 4

- [x] T024 [US4] Endurecer o unlock em `engine.ts`: garantir `ctx.resume()` idempotente, listener `once`/auto-remoção, e `play` totalmente seguro antes do unlock (sem warning não tratado) (FR-015/FR-019).
- [x] T025 [US4] Verificar comportamento gracioso de **asset ausente/falha de fetch** (cue silencioso, sem erro visível) — cobrir com no-op no `engine` e validar no dev (FR-019).

**Checkpoint**: áudio robusto às políticas do browser.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T026 [P] Curadoria final dos assets de `src/assets/sfx/` (todos os cues do catálogo com asset; volumes normalizados; `.webm`+fallback se preciso) e `CUE_SRC` completo.
- [ ] T027 Ajuste fino do `MIN_GAP_MS` por cue (pregão simultâneo da 031 sem cacofonia — SC-005) e dos cues neutros de catch-up (GO/Loteria/Tax Man — FR-017/SC-004).
- [ ] T028 [P] Nota no `docs/SRS.md` §12 (camada de SFX como apresentação; sem impacto em regra) — apenas se o usuário aprovar tocar no SRS.
- [ ] T029 Rodar `bunx tsc --noEmit`, `bunx vitest run tests/game` (classify/prefs + regressão do motor — SC-006) e `bun run build`; validar o checklist auditivo do `quickstart.md` (incl. reconexão sem replay — SC-007).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sem dependências.
- **Foundational (P2)**: depende do Setup — **bloqueia todas as stories**.
- **US1 / US2 (P1)**: começam após Foundational; independentes entre si (US1 = disparo; US2 = controle). Som de US1 respeita volume só após US2, mas é testável com default.
- **US3 / US4 (P2)**: após Foundational; independentes.
- **Polish (P7)**: após as stories desejadas.

### Within Each Story

- Testes puros (US1/US2) antes da implementação das funções correspondentes.
- `classify.ts` antes do wiring dos canais no `SoundLayer`.
- `prefs.ts` antes do `AudioControl`.

### Parallel Opportunities

- Setup: T002, T003 em paralelo.
- US1: T009/T010 (testes) em paralelo; T015 (assets) em paralelo com a lógica.
- US2: T016 em paralelo com o início de T017.
- US3: T023 em paralelo com T021/T022.
- US1 e US2 podem ser tocadas por pessoas diferentes após a Foundational.

---

## Parallel Example: User Story 1

```bash
# Testes puros juntos:
Task: "classify.test.ts — classifyLogEntry por prefixo"
Task: "classify.test.ts — cueForRoll/cueForResolution/cueForNotice"
# Assets em paralelo com a lógica dos canais:
Task: "Adicionar/maping assets de US1 em src/assets/sfx + CUE_SRC"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Setup (Phase 1) → Foundational (Phase 2).
2. US1 (Phase 3) → **validar**: jogo soa nas ações principais.
3. US2 (Phase 4) → **validar**: mute/volume persistidos. → MVP entregável.

### Incremental

4. US3 (movimento casa-a-casa) → validar.
5. US4 (robustez de autoplay) → validar.
6. Polish: assets completos, tuning anti-spam, gate verde.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- **Nenhuma task escreve no `GameState`** (FR-018) — áudio é apresentação pura.
- Cada cue em **um único canal** → idempotência (FR-007).
- Commitar por task ou grupo lógico; mensagens em inglês (emoji + conventional).
- Validar testes puros antes de implementar as funções correspondentes.
