# Plano de Implementação: Efeitos sonoros (SFX) da partida

**Spec**: [spec.md](./spec.md) · **Branch/dir**: `035-efeitos-sonoros` · **Status**: rascunho (aguardando aprovação p/ `/speckit-tasks`)

## Summary

Camada de **apresentação sonora** 100% client-side: um componente headless `SoundLayer` (irmão de `GameDriver`/`NoticeLayer`) observa transições do estado já existente e dispara cues curtos. Engine de áudio próprio sobre a **Web Audio API** (sem dependência nova), com `AudioContext` lazy destravado no 1º gesto, `GainNode` master para volume e throttle anti-spam por cue. Preferências (mute/volume) num store zustand persistido em `localStorage`. **Nada toca no `GameState` serializável** (princípio VII) — o som é derivado, não fonte de verdade.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (Vite) — stack existente.
**Primary Dependencies**: **nenhuma nova**. Web Audio API nativa do browser; Zustand (já presente) para o store de prefs.
**Storage**: `localStorage` para `{ muted, volume }` (por dispositivo). Assets de áudio em `src/assets/sfx/*` importados como URL pelo Vite.
**Testing**: Vitest (`tests/game/...`) sobre **funções puras** de classificação (log→cue, roll→cue, resolution→cue) + store de prefs. `AudioContext` não é exercido em teste (guard).
**Target Platform**: navegadores modernos (Chromium/Firefox/Safari) desktop e mobile.
**Project Type**: web app SPA (single project; `src/`).
**Performance Goals**: latência de disparo imperceptível (<~30ms após o evento), sobreposição de múltiplos ticks sem travar; 60fps intactos.
**Constraints**: não-bloqueante (áudio assíncrono); degradação graciosa se asset faltar; respeitar política de autoplay (gesto obrigatório); throttle de rajada.
**Scale/Scope**: ~20–25 cues; partida de até 8 jogadores.

## Constitution Check

*GATE — reavaliado pós-design.*

| Princípio | Avaliação |
|---|---|
| **I.** SRS é verdade | Som é apresentação (SRS §12 — UI/log). Nenhuma regra de negócio nova. ✓ |
| **II.** Discovery antes de código | Spec aprovada; usuário autorizou prosseguir. Este plano é design, não código. ✓ |
| **III.** Tesouro impacta | N/A (não mexe em cartas/economia). ✓ |
| **IV.** Catch-up discreto | `FR-017`: cues de GO Progressivo/Loteria/Tax Man são **neutros**, idênticos aos comuns — não denunciam desvantagem. ✓ |
| **V.** Sem coop obrigatória | N/A. ✓ |
| **VI.** Privacidade de carta | `FR-016`: saque usa cue **genérico**; variação por raridade só em `card-reveal` (público). ✓ |
| **VII.** Resiliência/determinismo | `FR-011`/`FR-018`: zero escrita no `GameState`; cursor de log inicia no fim ao montar → **sem replay** de histórico na reconexão. ✓ |

**Sem violações.** Sem entradas em Complexity Tracking.

## Design técnico

### Arquitetura — 3 canais de disparo, todos fora do `GameState`

Um `SoundLayer` headless (montado no `App.tsx`) e um pequeno engine. Cada evento sonoro é atribuído a **exatamente um** canal para garantir **idempotência** (`FR-007`) — nada toca duas vezes.

```
src/game/ui/sound/
├── engine.ts        # AudioContext lazy + unlock + GainNode master + play(cue) com throttle
├── prefs.ts         # useAudioPrefs (zustand): { muted, volume } persistido em localStorage
├── cues.ts          # type SoundCue + mapa cue→URL (import Vite) + defaults
├── classify.ts      # funções PURAS: classifyLogEntry / cueForResolution / cueForRoll / cueForNotice (testáveis)
├── SoundLayer.tsx   # observa o store e dispara (canais 1 e 2)
└── AudioControl.tsx # botão mute + slider volume (montado no GameHUD)
```

**Canal 1 — Observadores de transição (estado tipado).** No `SoundLayer`, seletores zustand + `useRef` do valor anterior, disparando na **borda** da transição:
- **Rolagem**: observar `turn.lastRoll` (referência nova ⇒ rolou); `cueForRoll(roll)` ramifica por `roll.isDouble` / `roll.special` (Ônibus/triple) / `roll.speed` (Speed Die).
- **Resolução**: `resolution?.kind` borda-de-subida ⇒ `cueForResolution(kind)` → `purchase` (oferta), `auction` (abertura), `card-reveal` (com variação por raridade — público), `card-shortcut`, `card-discard`, `debt`, `reaction-diplomacia`/`reaction-bunker`, `apagao`/`greve`.
- **Notice**: `notice?.kind` ⇒ `free-parking` (Loteria — neutro) / `hostile-takeover` (sofrer aquisição).
- **Prisão**: por jogador, `jail.inJail` `false→true` ⇒ `jail-in`; `true→false` ⇒ `jail-out`.
- **Fim de jogo**: `phase` → `ended` (+ vencedor) ⇒ `win` (prioritário sobre eliminação no mesmo tick).
- **Pregão de terrenos** (`landAuction`): contagem de lances sobe ⇒ `auction-bid` (throttle forte); `landAuction` fecha ⇒ `auction-close`.
- **Empréstimo**: `loans.length` sobe ⇒ `loan-granted`.
- **Sua vez**: `activeSeat`/jogador-da-vez vira o jogador local ⇒ `your-turn` (quando houver identidade local; hoje single-client → opcional, ver Assumptions).

**Canal 2 — Classificador do tail do log (eventos só-logados).** Para eventos que só se manifestam como texto de log e não têm borda tipada limpa: manter um **cursor** = `log.length` consumido. A cada render, classificar apenas as entradas **novas** (além do cursor) com `classifyLogEntry(entry)` por **prefixo estável**:
- `"pagou $… de imposto"` → `tax-paid`
- `"pagou $… de aluguel a …"` → `rent-paid`
- `"passou pelo GO"` / `"parou no GO"` → `go-bonus` (neutro)
- `"pagou R$ … de juros"` → `loan-interest`
- `"faliu"` → `bankruptcy`
- `"… ↔ …: troca aceita"` → `trade-done`
- `"sacou Acaso/Tesouro"` → `card-draw` (cue **genérico** — `FR-016`, nunca por raridade)

> **Idempotência + sem replay** (`FR-007`/`FR-011`/`SC-007`): ao **montar**, o cursor recebe `log.length` atual ⇒ histórico nunca re-soa. O log é append-only com bound 50; o cursor acompanha o tamanho. Como cada cue está em **um só canal**, não há colisão entre Canal 1 e 2 (ex.: falência fica no Canal 2; oferta de compra no Canal 1).

**Canal 3 — Movimento do peão (tick + parada).** Hook na animação existente (`useWalkedPositions` em `LiveTokens.tsx`): quando a posição exibida de um peão avança **+1 casa** (passo real, `fwd∈[1..WALK_MAX]`) ⇒ `step-tick`; quando um peão em movimento atinge o alvo ⇒ `step-land`. **Snap/teleporte** (Bus Ticket/atalho: `else` do hook) ⇒ só `step-land`, **sem** ticks (`FR-010`, US3). O `STEP_MS` já limita a cadência dos ticks naturalmente.

### Engine (`engine.ts`)

- `AudioContext` criado **lazy** na 1ª chamada de `play`. Listener único `pointerdown`/`keydown`/`touchstart` (capture, once) chama `ctx.resume()` para destravar autoplay (`FR-015`). Antes do unlock, `play` é no-op protegido por `try/catch` (`FR-015`/`FR-019`).
- Buffers decodificados sob demanda e cacheados (`fetch(url) → decodeAudioData`); falha de fetch/decode ⇒ cue silencioso, sem erro (`FR-019`).
- **Master gain**: um `GainNode` único; `gain = muted ? 0 : volume`. `play(cue)`: cria `BufferSourceNode → masterGain → destination`, `start()`. Sobreposição livre (vários ticks) — não-bloqueante (`FR-020`).
- **Throttle anti-spam** (`FR-009`): `Map<cue, lastPlayedAt>`; se `now - last < MIN_GAP_MS` (≈70ms, por cue) ⇒ descarta. Colapsa rajada de `auction-bid` no pregão simultâneo (031) e ticks redundantes. `now` via `performance.now()` (não-determinístico, mas é UI — fora do motor).

### Preferências (`prefs.ts`)

`useAudioPrefs` (zustand, middleware `persist` em `localStorage` chave `bm.audio`): `{ muted: boolean; volume: number }`, defaults `{ muted: false, volume: 0.6 }` (`FR-012`). Setters `setMuted`/`setVolume` atualizam o store **e** o `masterGain` do engine. `AudioControl.tsx` (ícone alto-falante + slider) montado no `GameHUD`.

### Pureza & testes

`classify.ts` e os `cueFor*` são **funções puras** (string/objeto → `SoundCue | null`), sem tocar Web Audio → unit-testáveis. O `SoundLayer` e o engine são verificados no `bun run dev` (de ouvido) — sem RTL de áudio.

## Project Structure

### Source Code

```text
src/
├── App.tsx                         # + <SoundLayer/>
├── assets/sfx/*.webm               # assets de áudio (CC0/royalty-free) — novos
└── game/ui/
    ├── LiveTokens.tsx              # + cues de passo/parada (canal 3)
    ├── GameHUD.tsx                 # + <AudioControl/>
    └── sound/                      # NOVO módulo
        ├── engine.ts
        ├── prefs.ts
        ├── cues.ts
        ├── classify.ts
        ├── SoundLayer.tsx
        └── AudioControl.tsx

tests/game/ui/sound/
├── classify.test.ts               # log→cue, roll→cue, resolution→cue, notice→cue
└── prefs.test.ts                  # defaults, persistência, mute/volume
```

**Structure Decision**: single project (`src/`), espelhando o padrão dos layers headless existentes (`GameDriver`/`NoticeLayer` em `src/game/ui/`, montados no `App.tsx`). Áudio isolado em `src/game/ui/sound/`.

## Estratégia de testes

- `classify.test.ts`: cada prefixo de log mapeia ao cue certo (e textos não cobertos → `null`); `card-draw` é genérico (não vaza raridade — `FR-016`/`SC-004`); `cueForRoll` ramifica dupla/Speed Die/Ônibus; `cueForResolution` cobre todos os `kind`.
- `prefs.test.ts`: defaults (`muted=false`, `volume=0.6`); `setMuted/setVolume` persistem e re-hidratam; mute zera o gain (mockando o engine).
- Regressão: `bunx vitest run tests/game` segue verde (nenhum campo novo no `GameState` ⇒ asserts de motor intactos — `SC-006`).
- Verificação visual/auditiva no `bun run dev`: rolar/comprar/aluguel/falência/prisão/loteria/pregão; mute/volume; reload preserva prefs; reconexão (re-hidratar log) **não** dispara histórico.

## Decisões de design (resumo — detalhe em research.md)

- **Web Audio API nativa** (não `howler`/`<audio>`): zero dependência, baixa latência, sobreposição e master-gain triviais.
- **Som derivado de transições, não de campo no estado**: preserva determinismo/serialização (`FR-018`); reconexão sem replay via cursor de log.
- **Um cue por canal**: idempotência sem coordenação entre canais.
- **Assets**: sourcing de arquivos CC0/royalty-free curtos (`.webm`/`.mp3`) na implementação; ausência degrada graciosamente.

## Gate

`bunx tsc --noEmit` + `bunx vitest run tests/game` (classify/prefs + regressão do motor) + `bun run build` verdes, e verificação auditiva no `bun run dev` (cues corretos, mute/volume, sem replay na reconexão).
