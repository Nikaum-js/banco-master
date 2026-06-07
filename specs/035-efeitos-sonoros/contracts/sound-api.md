# Contrato: API interna da camada de som

Contratos das funções/módulos expostos pela camada `src/game/ui/sound/`. São interfaces **internas** (UI), não APIs externas. Os tipos abaixo guiam a implementação e os testes.

## `cues.ts`

```ts
export type SoundCue =
  | 'dice-roll' | 'dice-double' | 'dice-speed' | 'dice-bus'
  | 'step-tick' | 'step-land'
  | 'go-bonus' | 'tax-paid' | 'busticket-gain'
  | 'buy' | 'decline' | 'build' | 'sell' | 'mortgage' | 'unmortgage'
  | 'rent-paid' | 'auction-bid' | 'auction-close' | 'debt'
  | 'loan-granted' | 'loan-interest'
  | 'card-draw' | 'card-reveal' | 'card-shortcut' | 'card-play' | 'card-discard'
  | 'apagao' | 'greve' | 'hostile-takeover' | 'reaction' | 'immunity'
  | 'free-parking' | 'jail-in' | 'jail-out' | 'win' | 'bankruptcy'
  | 'your-turn' | 'pause' | 'resume'

// URL por cue (import Vite). Cue ausente do mapa ⇒ silencioso (FR-006/FR-019).
export const CUE_SRC: Partial<Record<SoundCue, string>>
```

## `engine.ts`

```ts
// Toca o cue (no-op se: não destravado, mutado, asset ausente, ou throttled). Nunca lança.
export function play(cue: SoundCue): void

// Aplica volume/mute ao GainNode master (chamado pelo store de prefs).
export function setMasterGain(volume: number, muted: boolean): void

// Idempotente: registra o listener de unlock (1º gesto → ctx.resume()). Chamado no mount do SoundLayer.
export function ensureUnlockListener(): void
```

**Garantias**:
- `play` é **assíncrono/não-bloqueante** e **nunca lança** (`FR-019`/`FR-020`).
- Antes do 1º gesto, `play` não produz som e não quebra (`FR-015`).
- Throttle por cue: chamadas do mesmo cue em janela `< MIN_GAP_MS` são descartadas (`FR-009`).

## `prefs.ts`

```ts
export interface AudioPrefs { muted: boolean; volume: number } // volume 0..1
export const useAudioPrefs: UseBoundStore<...> // { muted:false, volume:0.6 } default; persist 'bm.audio'
// setMuted(b)/setVolume(v): atualizam o store E chamam engine.setMasterGain
```

## `classify.ts` — funções PURAS (alvo dos testes)

```ts
import type { LogEntry } from '@/game/economy/types'
import type { Roll } from '@/game/turn/types'
import type { ResolutionSlice, Notice } from ...

// Classifica UMA entrada de log nova → cue (ou null se não mapeada). Por prefixo estável.
export function classifyLogEntry(e: LogEntry): SoundCue | null

// Rolagem → cue, ramificando dupla/Speed Die/Ônibus.
export function cueForRoll(roll: Roll): SoundCue

// Borda de subida de resolução → cue.
export function cueForResolution(kind: ResolutionSlice['kind']): SoundCue | null

// Notice → cue.
export function cueForNotice(kind: Notice['kind']): SoundCue | null
```

**Contrato de `classifyLogEntry`** (prefixos — fonte: emissões reais do motor, spec 021):

| Prefixo do `what` | Cue |
|---|---|
| `pagou $… de imposto` | `tax-paid` |
| `pagou $… de aluguel a ` | `rent-paid` |
| `passou pelo GO` / `parou no GO` | `go-bonus` |
| `pagou R$ … de juros` | `loan-interest` |
| `faliu` | `bankruptcy` |
| `… troca aceita` | `trade-done`* |
| `sacou Acaso` / `sacou Tesouro` | `card-draw` (genérico — nunca por raridade) |
| `ganhou 1 Bus Ticket` | `busticket-gain` |
| (qualquer outro) | `null` |

\* `trade-done` pode ser adicionado ao union se desejado; caso contrário mapear para `null` nesta fatia.

**Contrato de `cueForResolution`**: `purchase→buy`, `auction→auction-bid|auction-close` (conforme momento; abertura/fechamento tratados no observador), `card-reveal→card-reveal`, `card-shortcut→card-shortcut`, `card-discard→card-discard`, `debt→debt`, `reaction-*→reaction`, `apagao→apagao`, `greve→greve`. Não mapeado ⇒ `null`.

## `SoundLayer.tsx` / `AudioControl.tsx`

- `SoundLayer`: componente headless (retorna `null`), montado no `App.tsx`. Observa o store (canais 1 e 2), chama `play()`. Mantém `logCursor` (ref) iniciado em `log.length` no mount.
- `AudioControl`: botão de mute (ícone alto-falante) + slider de volume; lê/escreve `useAudioPrefs`. Montado no `GameHUD`.

## Invariantes do contrato

- Nenhuma função escreve no `GameState` (`FR-018`).
- `classify.*` e `cueFor*` são puras e determinísticas (testáveis sem Web Audio).
- `play`/`setMasterGain`/`ensureUnlockListener` são as **únicas** que tocam `AudioContext`.
