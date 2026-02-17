# Implementation Plan: Ritual de Largada configurável

**Branch**: `main` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/045-leilao-da-largada/spec.md`

## Summary

Dar ao host, no lobby, uma escolha persistida entre dois rituais host-autoritativos. `sealed-bid` abre a fase simultânea e secreta já implementada, liquida cada lance na Loteria e revela a ordem. `dice-roll` gera dois dados brancos por assento, ordena pela soma sem alterar caixa/Loteria e revela as rolagens. Ambos gravam o primeiro snapshot com a ordem definitiva e entram no tabuleiro automaticamente.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19.2

**Primary Dependencies**: Vite 8, Tailwind CSS 4, Zustand 5, Supabase Realtime/Postgres, Motion 12

**Storage**: tabela PostgreSQL `rooms`; `opening_mode` para a preferência do host, `seats` JSONB para lances/rolagens por assento e `opening_auction` JSONB para fase/prazo; primeiro snapshot existente para o resultado

**Testing**: Vitest 4 (reducers, sessão, transporte e integração headless), Playwright 1.62 (dois contextos e revisão visual), axe-core

**Target Platform**: navegadores modernos desktop e mobile em paisagem; produção na Vercel

**Project Type**: aplicação web multiplayer host-autoritativa

**Performance Goals**: resposta visual ao lacre em até 250 ms na rede normal; fechamento único em até 1 s após o último lance/prazo; animações a 60 fps sem bloquear regra

**Constraints**: até 8 jogadores; somente o host muda o modo no lobby; lances alheios não trafegam antes da revelação; nenhuma cobrança antes do snapshot inicial; Maior dado não altera a economia; WCAG 2.2 AA; `prefers-reduced-motion`; compatibilidade com salas/snapshots antigos

**Scale/Scope**: uma preferência e uma fase de sala, um evento privado de transporte, uma migration aditiva, uma seleção no lobby, duas revelações e cobertura dos adapters local/Supabase

## Constitution Check

*GATE inicial e pós-design: APROVADO.*

- **I — SRS**: os dois modos e a escolha do host estão na D-046 e no SRS v1.12 antes do código.
- **II — Discovery**: spec 045 aprovada antes de código de produção; plan, contratos e tasks precedem implementação.
- **III — Tesouro**: não altera cartas.
- **IV — Catch-up discreto**: a UI chama o prêmio de Loteria e não rotula ninguém como desfavorecido.
- **V — Cooperação**: lance $0 preserva um caminho completo sem depender dos demais.
- **VI — Privacidade**: lances lacrados trafegam apenas no tópico privado do assento até a autoridade; publicação pré-fecho carrega apenas `bidLocked`.
- **VII — Resiliência**: fase/prazo/lances são persistidos; fechamento é atômico no primeiro snapshot; reload não duplica cobrança.

Nenhuma violação exige Complexity Tracking.

## Design técnico

### 1. Preferência e reducers da sala

`src/net/room.ts` ganha `OpeningMode = 'sealed-bid' | 'dice-roll'`, `RoomStatus: 'bidding'`, `OpeningAuction` e campos normalizáveis:

- `openingMode` — preferência pública do host; default compatível `sealed-bid`;
- `openingBid: number | null` — privado durante `bidding`, público em `playing`;
- `bidLocked: boolean` — público durante a coleta;
- `openingRoll: [number, number] | null` — resultado público do modo Maior dado;
- `openingAuction: { closesAt: number } | null` — prazo persistido da rodada.

Reducers puros:

- `selectOpeningMode(room, mode)` altera somente no lobby;
- `openOpeningAuction(room, closesAt)` valida mínimo e limpa resíduos;
- `lockOpeningBid(room, uid, amount)` valida assento, fase, faixa, passo e unicidade;
- `allOpeningBidsLocked(room)` fecha cedo;
- `finalizeOpeningAuction(room, rng)` completa faltantes com $0, embaralha somente grupos empatados, reindexa `playerId` e muda para `playing`.
- `rollOpeningOrder(room, rng)` gera dois d6 por assento, ordena pela soma, embaralha grupos empatados, reindexa `playerId` e muda para `playing`.

Shapes legados são normalizados com `openingMode: 'sealed-bid'`, `openingBid: null`, `bidLocked: false`, `openingRoll: null` e `openingAuction: null`.

### 2. Privacidade no transporte

`Transport` ganha `submitOpeningBid(amount)` e `onOpeningBid(cb)`. O evento reutiliza `room:<id>:s:<uid>`:

- o payload contém só `amount`;
- `fromUid` vem do tópico privado observado, nunca do payload;
- somente a autoridade observa os tópicos de todos os assentos;
- o adapter local aplica o mesmo recorte por `watchSeat`;
- a suíte de conformidade prova paridade e autoria.

`toPublicRoom` mascara `openingBid` enquanto `status === 'bidding'`, mantendo `bidLocked`, e sempre publica `openingMode`. O próprio cliente conserva o valor enviado e o recupera da prévia persistida. A migration 0005 atualiza `room_preview` para entregar o lance apenas ao próprio assento (e todos à autoridade), além de persistir `opening_mode` e `opening_auction`.

### 3. Fechamento e economia

`host.startMatch()` lê o modo persistido. Em `sealed-bid`, abre o leilão; `host.tick()` fecha no prazo e o último lance válido fecha antes. Em `dice-roll`, resolve as rolagens e cria o snapshot imediatamente. Um guard de fechamento impede duas criações concorrentes.

No fechamento:

1. finalizar o modo e ordenar a sala;
2. criar o `GameState` inicial com a ordem já definitiva;
3. em `sealed-bid`, aplicar `cash = 2000 - bid` e `centerPot = 500 + soma`; em `dice-roll`, preservar $2.000/$500;
4. gravar `seq = 0` e o snapshot completo;
5. publicar a sala `playing` com lances já públicos;
6. emitir telemetria `match_started` uma única vez.

Partida local continua usando `buildInitialGame` sem resultado de largada, preservando $2.000/$500.

### 4. Sessão e entrada automática

`RoomSession` ganha as fases `auction` e `reveal`, além da ação `submitOpeningBid`. `Client` não tenta ler snapshot ao ver `bidding`; apenas `playing|paused|ended` prometem snapshot.

O resultado `seq = 0` entra em `reveal`. A sessão transiciona automaticamente para `playing` após 4,2 segundos, sem ação local; reload durante a revelação relê o snapshot e pode reexibir o resultado, mas nunca recria ou recobra. `seq > 0` continua entrando direto no tabuleiro.

### 5. Interface

`LobbyScreen.tsx` oferece:

- **OpeningModePicker** no lobby: duas opções compactas e públicas, editáveis só pelo host;
- **OpeningAuction**: relógio de 15 s, seletor $0–$500, caixa preservado, destino para a Loteria e trilho dos assentos lacrados;
- **TurnOrderReveal**: em leilão, fileiras com lance/caixa e total da Loteria; em Maior dado, fileiras com os dois dados e a soma; sem botão.

A direção usa `EntryStage`, `EntryPanel`, `EntryHeader`, `PlayerFace`, `Button`, tokens `ink/starlight/brass/signal`, `--gradient-brass`, sombras e curvas existentes. CSS ornamental congela sob `prefers-reduced-motion`; texto e ordem já existem no DOM antes da animação.

## Project Structure

### Documentation (this feature)

```text
specs/045-leilao-da-largada/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── opening-auction.md
│   └── transport.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   └── openingAuction.ts          # aplicação econômica pura no estado inicial
└── net/
    ├── room.ts                    # fase, dados e reducers da largada
    ├── transport.ts               # evento privado de lance
    ├── localTransport.ts          # adapter headless
    ├── supabaseTransport.ts       # adapter Realtime/Postgres
    ├── client.ts                  # envio e recuperação do próprio lance
    ├── host.ts                    # autoridade, prazo e fechamento
    ├── roomSession.ts             # fases auction/reveal e ação da UI
    └── ui/
        ├── OnlineGate.tsx         # roteamento das novas fases
        └── LobbyScreen.tsx        # coleta e revelação animadas

supabase/migrations/
└── 0005_opening_auction.sql

tests/
├── game/openingAuction.test.ts
└── net/
    ├── openingAuction.test.ts
    ├── hostOpeningAuction.test.ts
    ├── boot.test.ts
    └── conformance.test.ts

e2e/
└── multiplayer.spec.ts
```

**Structure Decision**: manter o monólito React/Vite existente. Regra econômica fica em módulo folha de `game`; lifecycle/privacidade ficam na camada `net`; apresentação apenas projeta a sessão. Nenhuma biblioteca ou serviço novo.

## Complexity Tracking

Sem violações.
