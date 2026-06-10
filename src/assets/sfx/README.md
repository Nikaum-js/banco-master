# SFX — assets de efeitos sonoros (spec 035)

Solte aqui arquivos de áudio curtos nomeados pelo **cue** (ver `src/game/ui/sound/cues.ts`):

```
buy.webm   rent-paid.webm   dice-roll.webm   step-tick.webm   bankruptcy.webm ...
```

- **Auto-wire**: `cues.ts` usa `import.meta.glob` — qualquer `<cue>.{webm,mp3,ogg,wav}` é
  automaticamente mapeado para `CUE_SRC[cue]`. Não precisa editar código ao adicionar um som.
- **Cue sem arquivo = silencioso** (FR-006) — o jogo funciona normalmente sem o asset (FR-019).
- **Formato**: prefira `.webm` (Opus) curto e leve; `.mp3` como fallback amplo.
- **Licença**: use apenas áudio CC0 / royalty-free.
- **Privacidade (FR-016)**: o cue `card-draw` é genérico — NÃO criar variações por raridade.
- **Catch-up discreto (FR-017)**: `go-bonus` / `free-parking` devem soar neutros.

> Os cues estão definidos e cabeados; só faltam os arquivos de áudio para soarem.
