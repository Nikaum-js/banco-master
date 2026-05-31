# Research: Efeitos sonoros (SFX)

Fase 0 — decisões técnicas resolvidas. Nenhum `NEEDS CLARIFICATION` pendente (as 4 decisões de produto foram fechadas antes da spec).

## D1 — API de áudio: Web Audio nativa vs. `<audio>` vs. biblioteca

- **Decisão**: **Web Audio API** nativa (`AudioContext` + `AudioBufferSourceNode` + `GainNode`), sem dependência.
- **Rationale**: baixa latência (crucial p/ ticks de passo), **sobreposição** de múltiplos sons sem clones de elemento, **master gain** único para volume/mute, e zero peso de bundle. Casa com o ethos do projeto ("sem dependências novas", visto na 034).
- **Alternativas**:
  - `HTMLAudioElement` (`<audio>`/`new Audio()`): latência maior, overlap exige pool de elementos, controle de volume por elemento — descartado.
  - `howler.js`: ergonômico, mas dependência extra para algo que a API nativa resolve — descartado.

## D2 — Como detectar eventos sem alterar o `GameState`

- **Decisão**: derivar cues de **transições observadas** na camada React (3 canais: borda de campo tipado, tail do log, animação de passo), com `useRef` do valor anterior. **Nenhuma escrita** no `GameState`.
- **Rationale**: `FR-018`/princípio VII — motor permanece determinístico e serializável. O `GameState` já expõe tudo o que precisamos: `turn.lastRoll`, `resolution.kind`, `notice`, `jail`, `phase`, `landAuction`, `loans`, `log`.
- **Alternativas**:
  - Enriquecer `LogEntry` com `kind`/`cue`: tocaria no estado serializável e na spec 021 — descartado.
  - Emitir eventos por um event-bus dentro dos reducers: acopla motor à apresentação — descartado.

## D3 — Idempotência e ausência de replay na reconexão

- **Decisão**: cada cue pertence a **um único canal**; o classificador de log usa um **cursor** (`log.length` consumido) que, **ao montar**, recebe o tamanho atual do log ⇒ histórico nunca re-soa.
- **Rationale**: `FR-007`/`FR-011`/`SC-007`. Log é append-only, bound 50, mais recentes ao fim → "novas entradas" = além do cursor. Re-hidratar estado (Supabase/reconexão) não dispara tempestade de sons.
- **Alternativas**: comparar hash do estado inteiro (caro, frágil) — descartado.

## D4 — Anti-spam de rajada

- **Decisão**: throttle por cue em `play()` — `Map<cue, lastAt>`, descarta se `< ~70ms` desde o último daquele cue (`performance.now()`).
- **Rationale**: `FR-009`/`SC-005` — pregão simultâneo (031) e múltiplos micro-eventos não viram cacofonia. Por-cue (não global) preserva diversidade sonora.
- **Alternativas**: fila com coalescência por janela (mais complexo) — adiável; throttle simples cobre os casos atuais.

## D5 — Autoplay / unlock

- **Decisão**: `AudioContext` lazy; listener único (`pointerdown`/`keydown`/`touchstart`, capture+once) faz `ctx.resume()`. Antes disso, `play` é no-op protegido.
- **Rationale**: `FR-015` — browsers bloqueiam áudio sem gesto. App nunca quebra por isso (`FR-019`).

## D6 — Persistência de preferências

- **Decisão**: store zustand com middleware `persist` em `localStorage` (chave `bm.audio`), defaults `{ muted:false, volume:0.6 }`.
- **Rationale**: `FR-012`/`FR-013`/`FR-014` — por dispositivo, fora do `GameState`. Zustand já é a stack de estado.

## D7 — Variação por raridade no saque (privacidade)

- **Decisão**: `card-draw` (saque, mão privada) = cue **único genérico**; variação por raridade (laranja/azul/verde) **apenas** em `card-reveal` (carta pública revelada, 025).
- **Rationale**: `FR-016`/princípio VI — o som não pode vazar a raridade da carta privada de ninguém.

## D8 — Catch-up neutro

- **Decisão**: `go-bonus` (GO Progressivo), `free-parking` (Loteria) e efeitos do Tax Man usam cues neutros, idênticos aos recebimentos comuns; sem fanfarra que sinalize desvantagem.
- **Rationale**: `FR-017`/princípio IV.

## D9 — Sourcing de assets

- **Decisão**: arquivos curtos CC0/royalty-free (`.webm` Opus, fallback `.mp3`) em `src/assets/sfx/`, importados como URL pelo Vite (hash/bundle). Ausência ⇒ cue silencioso.
- **Rationale**: leve, sem licença problemática; degradação graciosa (`FR-019`). A curadoria final dos arquivos é tarefa de implementação.
