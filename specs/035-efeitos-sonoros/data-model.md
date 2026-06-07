# Data Model: Efeitos sonoros (SFX)

> **Nenhuma mudança no `GameState`** (princípio VII / `FR-018`). Todas as entidades abaixo vivem **fora** do estado serializável do motor — são estado de UI/preferência.

## SoundCue (`src/game/ui/sound/cues.ts`)

Identificador semântico do som. `type SoundCue = ...` (union de string literais), com mapa `CUE_SRC: Record<SoundCue, string>` (URL importada pelo Vite).

| Cue | Gatilho (canal) | FR | Notas |
|---|---|---|---|
| `dice-roll` | rolagem normal (C1) | FR-001 | base |
| `dice-double` | rolagem dupla (C1) | FR-001 | `roll.isDouble` |
| `dice-speed` | Speed Die numérico (C1) | FR-001 | `roll.speed` |
| `dice-bus` | face Ônibus (C1) | FR-001 | `roll.special` |
| `step-tick` | +1 casa andada (C3) | FR-002/010 | throttle por `STEP_MS` |
| `step-land` | parada no destino (C3) | FR-002/010 | snap/teleporte só este |
| `go-bonus` | passar/parar no GO (C2) | FR-002/017 | **neutro** (catch-up) |
| `tax-paid` | casa de imposto (C2) | FR-002 | |
| `busticket-gain` | casa de Bus Ticket (C2) | FR-002 | log "ganhou 1 Bus Ticket" |
| `buy` | oferta/compra `purchase` (C1) | FR-003 | |
| `decline` | declinar compra (C1) | FR-001 | opcional/sutil |
| `build` | casa/hotel/hangar (C1) | FR-001 | |
| `sell` | vender construção (C1) | FR-001 | |
| `mortgage` | hipotecar (C1) | FR-001 | |
| `unmortgage` | desfazer hipoteca (C1) | FR-001 | |
| `rent-paid` | aluguel pago (C2) | FR-003 | "dinheiro saindo" |
| `auction-bid` | lance no pregão (C1) | FR-003 | **throttle forte** |
| `auction-close` | fechamento do pregão (C1) | FR-003 | |
| `debt` | dívida `debt` (C1) | FR-003 | |
| `loan-granted` | empréstimo concedido (C1) | FR-003 | `loans.length`↑ |
| `loan-interest` | cobrança de juros (C2) | FR-003 | log "juros" |
| `card-draw` | saque (C2) | FR-004/016 | **genérico** (privacidade) |
| `card-reveal` | `card-reveal` público (C1) | FR-004 | pode variar por raridade |
| `card-shortcut` | atalho (C1) | FR-004 | |
| `card-play` | jogar carta da mão (C1) | FR-001 | |
| `card-discard` | descartar (C1) | FR-004 | |
| `apagao` / `greve` | efeitos temporários (C1) | FR-004 | |
| `hostile-takeover` | sofrer aquisição (C1) | FR-004 | via `notice`/`resolution` |
| `reaction` | boicote/bunker/diplomacia (C1) | FR-004 | |
| `immunity` | imunidade temporária (C1) | FR-004 | |
| `free-parking` | Loteria (C1, `notice`) | FR-005/017 | **neutro** |
| `jail-in` | entrar na prisão (C1) | FR-005 | `jail.inJail` ↑ |
| `jail-out` | sair da prisão (C1) | FR-005 | `jail.inJail` ↓ |
| `win` | vitória/fim de jogo (C1) | FR-005 | prioritário sobre `bankruptcy` |
| `bankruptcy` | falência/eliminação (C2) | FR-005 | log "faliu" |
| `your-turn` | sua vez (C1) | FR-005 | depende de identidade local (Lobby/M3) |
| `pause` / `resume` | desconexão/reconexão (C1) | FR-005 | `paused` ↑/↓ |

> Cues sem asset nesta fatia ficam **silenciosos** (`FR-006`) — não é erro.

## AudioPreferences (`src/game/ui/sound/prefs.ts` — `useAudioPrefs`)

| Campo | Tipo | Default | Regra |
|---|---|---|---|
| `muted` | `boolean` | `false` | `FR-012`; mute ⇒ `masterGain=0` |
| `volume` | `number` (0..1) | `0.6` | `FR-013`; reflete no `masterGain` |

Persistido em `localStorage` (chave `bm.audio`) via middleware `persist` (`FR-014`). Fora do `GameState`.

## Estado interno do engine (`engine.ts` — módulo, não store)

| Campo | Tipo | Papel |
|---|---|---|
| `ctx` | `AudioContext \| null` | lazy; criado no 1º `play` |
| `unlocked` | `boolean` | resume após 1º gesto (`FR-015`) |
| `master` | `GainNode` | volume/mute global |
| `buffers` | `Map<SoundCue, AudioBuffer>` | cache de decodificados |
| `lastAt` | `Map<SoundCue, number>` | throttle anti-spam (`FR-009`) |

## Cursor do classificador de log (`SoundLayer.tsx` — `useRef`)

| Campo | Tipo | Regra |
|---|---|---|
| `logCursor` | `number` (ref) | = `log.length` ao montar (sem replay — `FR-011`); avança ao consumir entradas novas |

## Invariantes

- `GameState` inalterado; áudio não serializa nem afeta determinismo (`SC-006`).
- Cada cue em **um único canal** ⇒ no máx. 1 disparo por ocorrência (`FR-007`).
- `logCursor` nunca retrocede; ao montar, ignora histórico (`SC-007`).
- `volume ∈ [0,1]`; `muted ⇒ ganho efetivo 0`.
