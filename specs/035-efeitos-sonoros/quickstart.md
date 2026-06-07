# Quickstart: Efeitos sonoros (SFX)

## O que é

Camada de áudio client-side que sonoriza a partida com efeitos curtos. **Só SFX** (sem música). Não toca no motor.

## Como funciona (mapa mental)

```
GameState (store zustand)  ──observa──▶  SoundLayer (headless, App.tsx)
   turn.lastRoll / resolution / notice / jail / phase / landAuction / loans   ─▶ Canal 1 (transições tipadas)
   log[] (tail, por prefixo)                                                  ─▶ Canal 2 (classify.ts)
LiveTokens (animação do peão)                                                 ─▶ Canal 3 (tick + parada)
                                   │
                                   ▼
                       engine.play(cue)  ── AudioContext + masterGain (volume/mute)
                                   ▲
                       useAudioPrefs ({muted,volume}, localStorage)  ◀── AudioControl (GameHUD)
```

Cada cue pertence a **um só canal** → toca uma vez por evento.

## Rodar e verificar

```bash
bun run dev          # abre o jogo; áudio LIGADO por padrão
bunx vitest run tests/game/ui/sound   # testes de classify + prefs
bunx tsc --noEmit && bun run build    # gate
```

### Checklist auditivo (no dev)

1. **Destravar**: clique uma vez na página → áudio liberado (política de autoplay).
2. **Rolar dados**: som base; dupla / Speed Die / face Ônibus soam diferente.
3. **Mover**: tick por casa + som de parada; Bus Ticket (salto) → só parada, sem ticks.
4. **Comprar / aluguel / imposto / GO**: cues respectivos.
5. **Cartas**: saque = cue genérico (sem revelar raridade); revelação pública pode variar.
6. **Prisão**: entrar/sair; **falência**: cue de eliminação.
7. **Loteria (Free Parking)**: cue neutro junto do confete.
8. **Pregão simultâneo** (031): muitos lances → sem cacofonia (throttle).
9. **Controle**: mute silencia tudo; slider muda volume; **reload preserva** as prefs.
10. **Reconexão**: re-hidratar o estado **não** redispara sons do histórico.

## Princípios (não quebrar)

- **VI** privacidade: saque nunca vaza raridade (`card-draw` genérico).
- **IV** catch-up discreto: GO Progressivo/Loteria/Tax Man com cue neutro.
- **VII** determinismo: zero escrita no `GameState`; sem replay na reconexão.

## Arquivos-chave

- `src/game/ui/sound/{engine,prefs,cues,classify,SoundLayer,AudioControl}.ts(x)`
- `src/assets/sfx/*` — assets (CC0/royalty-free); ausência ⇒ silencioso.
- Toques mínimos: `src/App.tsx` (+SoundLayer), `src/game/ui/LiveTokens.tsx` (passos), `src/game/ui/GameHUD.tsx` (+AudioControl).
