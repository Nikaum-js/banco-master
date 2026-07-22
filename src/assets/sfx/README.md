# SFX — assets de efeitos sonoros (spec 035)

Um arquivo por **cue** (ver `src/game/ui/sound/cues.ts`).

- **Auto-wire**: `cues.ts` usa `import.meta.glob` — qualquer `<cue>.{webm,mp3,ogg,wav}` é
  mapeado para `CUE_SRC[cue]`. Não precisa editar código ao trocar um som.
- **Cue sem arquivo = silencioso** (FR-006).
- **Privacidade (FR-016)**: `card-draw` é genérico — sem variação por raridade.
- **Catch-up discreto (FR-017)**: `go-bonus` / `free-parking` são uma ficha discreta cada
  (−20 LUFS), timbres distintos, zero celebração.

## Design

O conjunto segue [`SOUND-DESIGN.md`](./SOUND-DESIGN.md) — identidade de **mesa de jogo
premium**: foley físico (madeira, fichas, moedas, papel, sinos) com **material = domínio**
(madeira → tabuleiro, moedas/fichas → dinheiro, papel → cartas/documentos, metal → prisão,
sinos → atenção, música → momentos raros). Zero beeps sintéticos de interface.

## Origem e licença (só royalty-free, sem atribuição obrigatória)

- **33 cues** — [Kenney.nl](https://kenney.nl/assets) (**CC0**), packs *Casino Audio*,
  *Impact Sounds*, *RPG Audio*, *Music Jingles* (pizzicato) e *UI Audio* (interruptores
  físicos gravados).
- **6 cues** — [Mixkit](https://mixkit.co/free-sound-effects/) (Mixkit Free License):
  `buy` (registradora), `apagao` (power-down), `greve` (apito), `your-turn` ("Service
  bell" #931), `win` (fanfarra #226, recortada), `bankruptcy` ("Losing piano" #2024).

## Como as escolhas foram feitas

Cada candidato foi **decodificado e analisado** (duração, centroide espectral, direção de
f0) e casado por *timbre + significado* — detalhe por cue em `SOUND-DESIGN.md`. Nove cues
são **produzidos** por edição (layer/trim): dado duplo ganha pizzicato ascendente, hipoteca
é tomo + tranca, imposto é carimbo + moedas, leilão fecha com gavel duplo, prisão é porta +
trinco. Loudness: −16 LUFS (frequentes −20/−22), pico ≤ −1 dBFS, fades anti-click.
Pipeline reproduzível: `build_sfx.py` (sessão de design, fontes Kenney/Mixkit).

Trocar um som: solte outro `<cue>.{webm,mp3,ogg,wav}` aqui (uma extensão por cue).
Auditar: `afplay src/assets/sfx/<cue>.ogg`.

## Mapa atual (cue → fonte)

| cue | fonte | cue | fonte |
|---|---|---|---|
| dice-roll | dice-throw-1 | card-draw | card-slide-1 |
| dice-double | dice-throw-2 + PIZZI02 | card-reveal | card-fan-1 |
| dice-speed | dice-shake-3 (trim) | card-play | card-place-1 |
| dice-bus | die-throw-4 | card-discard | card-shove-1 |
| step-tick | footstep_wood_002 | card-shortcut | cloth1 (whoosh) |
| step-land | impactWood_light_000 | apagao | **Mixkit** power-down |
| buy | **Mixkit** registradora | greve | **Mixkit** apito |
| decline | bookClose | hostile-takeover | impactPunch_heavy_002 |
| build | impactPlank_medium_001 | reaction | drawKnife3 (schwing) |
| sell | chips-stack-3 | immunity | impactBell_heavy_003 |
| mortgage | bookPlace3 + metalClick | free-parking | chips-collide-4 |
| unmortgage | cards-pack-take-out-2 | jail-in | doorClose_3 + metalLatch |
| rent-paid | handleCoins (punhado) | jail-out | doorOpen_1 |
| tax-paid | bookPlace1 + handleCoins2 | your-turn | **Mixkit** Service bell |
| go-bonus | chip-lay-3 | win | **Mixkit** fanfarra (trim) |
| busticket-gain | switch16 (picotador) | bankruptcy | **Mixkit** Losing piano |
| debt | jingles_PIZZI04 (grave) | pause | switch1 (desliga) |
| loan-granted | chips-handle-2 | resume | switch10 (liga) |
| loan-interest | creak3 (rangido) | auction-bid | chip-lay-2 |
| auction-close | gavel duplo (impactWood_heavy_002 ×2) | | |
