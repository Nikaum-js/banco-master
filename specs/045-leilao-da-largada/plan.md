# Implementation Plan: Ritual de Largada configurável

**Branch**: `main` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/045-leilao-da-largada/spec.md`

## Summary

Dar ao host, no lobby, uma escolha persistida entre dois rituais host-autoritativos. `sealed-bid` abre a fase simultânea e secreta já implementada, liquida cada lance na Loteria e revela a ordem. `dice-roll` abre uma disputa compartilhada: cada dono de assento pede a própria rolagem, a autoridade publica um arremesso por vez, gera os dois dados e só então libera o próximo. Ambos gravam o primeiro snapshot com a ordem definitiva e entram no tabuleiro automaticamente.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19.2

**Primary Dependencies**: Vite 8, Tailwind CSS 4, Zustand 5, Supabase Realtime/Postgres, Motion 12

**Storage**: tabela PostgreSQL `rooms`; `opening_mode` para a preferência do host, `seats` JSONB para lances, rolagens e instante do arremesso por assento, e `opening_auction` JSONB para prazo do leilão; primeiro snapshot existente para o resultado

**Testing**: Vitest 4 (reducers, sessão, transporte e integração headless), Playwright 1.62 (dois contextos e revisão visual), axe-core

**Target Platform**: navegadores modernos desktop e mobile em paisagem; produção na Vercel

**Project Type**: aplicação web multiplayer host-autoritativa

**Performance Goals**: resposta visual ao lacre ou pedido de rolagem em até 250 ms na rede normal; cada arremesso dura 1,4 s e fecha em um único `tick`; fechamento único em até 1 s após o último lance/prazo; animações a 60 fps

**Constraints**: até 8 jogadores; somente o host muda o modo no lobby; lances alheios não trafegam antes da revelação; nenhuma cobrança antes do snapshot inicial; Maior dado não altera a economia; WCAG 2.2 AA; `prefers-reduced-motion`; compatibilidade com salas/snapshots antigos

**Scale/Scope**: uma preferência, duas fases pré-partida, dois eventos privados de transporte, uma seleção no lobby, uma disputa sequencial, duas revelações e cobertura dos adapters local/Supabase; a disputa usa o JSONB de assentos já persistido e não exige migration nova

## Constitution Check

*GATE inicial e pós-design: APROVADO.*

- **I — SRS**: os dois modos, a escolha do host e a rolagem individual estão na D-046/D-051 e no SRS v1.18 antes do código.
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
- `openingRollStartedAt: number | null` e `openingRollResolvesAt: number | null` — janela pública e persistida do único arremesso em curso;
- `openingAuction: { closesAt: number } | null` — prazo persistido da rodada.

Reducers puros:

- `selectOpeningMode(room, mode)` altera somente no lobby;
- `openOpeningAuction(room, closesAt)` valida mínimo e limpa resíduos;
- `lockOpeningBid(room, uid, amount)` valida assento, fase, faixa, passo e unicidade;
- `allOpeningBidsLocked(room)` fecha cedo;
- `finalizeOpeningAuction(room, rng)` completa faltantes com $0, embaralha somente grupos empatados, reindexa `playerId` e muda para `playing`.
- `openOpeningRolls(room)` valida mínimo, entra em `rolling` e limpa resíduos;
- `requestOpeningRoll(room, uid, now, duration)` aceita somente o dono do primeiro assento ainda sem resultado e persiste a janela do arremesso;
- `resolveOpeningRoll(room, rng)` gera dois d6 para o arremesso vencido; libera o próximo ou ordena por soma, embaralha empates, reindexa `playerId` e muda para `playing`.

Shapes legados são normalizados com `openingMode: 'sealed-bid'`, `openingBid: null`, `bidLocked: false`, `openingRoll: null` e `openingAuction: null`.

### 2. Privacidade no transporte

`Transport` ganha `submitOpeningBid(amount)`/`onOpeningBid(cb)` e `submitOpeningRoll()`/`onOpeningRoll(cb)`. Os eventos reutilizam `room:<id>:s:<uid>`:

- o payload contém só `amount`;
- o pedido de rolagem usa payload vazio, sem identidade nem resultado;
- `fromUid` vem do tópico privado observado, nunca do payload;
- somente a autoridade observa os tópicos de todos os assentos;
- o adapter local aplica o mesmo recorte por `watchSeat`;
- a suíte de conformidade prova paridade e autoria.

`toPublicRoom` mascara `openingBid` enquanto `status === 'bidding'`, mantendo `bidLocked`, e sempre publica `openingMode`. O próprio cliente conserva o valor enviado e o recupera da prévia persistida. A migration 0005 atualiza `room_preview` para entregar o lance apenas ao próprio assento (e todos à autoridade), além de persistir `opening_mode` e `opening_auction`.

### 3. Fechamento e economia

`host.startMatch()` lê o modo persistido. Em `sealed-bid`, abre o leilão; `host.tick()` fecha no prazo e o último lance válido fecha antes. Em `dice-roll`, publica a sala `rolling`. Cada `opening-roll` válido abre uma janela persistida de 1,4 s; `host.tick()` resolve o resultado com seu RNG. Depois do último, cria o snapshot. Guards de fase e assento impedem rolagens simultâneas ou duplicadas.

No fechamento:

1. finalizar o modo e ordenar a sala;
2. criar o `GameState` inicial com a ordem já definitiva;
3. em `sealed-bid`, aplicar `cash = 2000 - bid` e `centerPot = 500 + soma`; em `dice-roll`, preservar $2.000/$500;
4. gravar `seq = 0` e o snapshot completo;
5. publicar a sala `playing` com lances já públicos;
6. emitir telemetria `match_started` uma única vez.

Partida local continua usando `buildInitialGame` sem resultado de largada, preservando $2.000/$500.

### 4. Sessão e entrada automática

`RoomSession` ganha as fases `auction`, `rolling` e `reveal`, além das ações `submitOpeningBid` e `submitOpeningRoll`. `Client` não tenta ler snapshot ao ver `bidding|rolling`; apenas `playing|paused|ended` prometem snapshot.

O resultado `seq = 0` entra em `reveal`. A sessão transiciona automaticamente para `playing` após 4,2 segundos, sem ação local; reload durante a revelação relê o snapshot e pode reexibir o resultado, mas nunca recria ou recobra. `seq > 0` continua entrando direto no tabuleiro.

### 5. Interface

`LobbyScreen.tsx` oferece:

- **OpeningModePicker** no lobby: duas opções compactas e públicas, editáveis só pelo host;
- **OpeningAuction**: relógio de 15 s, seletor $0–$500, caixa preservado, destino para a Loteria e trilho dos assentos lacrados;
- **OpeningRolls**: um lançador em foco, dois dados compartilhados, placar parcial persistente e CTA apenas para o dono do assento da vez;
- **TurnOrderReveal**: em leilão, fileiras com lance/caixa e total da Loteria; em Maior dado, fileiras com os dois dados e a soma; sem botão.

A direção usa `EntryStage`, `EntryPanel`, `EntryHeader`, `PlayerFace`, `Button`, tokens `ink/starlight/brass/signal`, `--gradient-brass`, sombras e curvas existentes. Somente os dados do assento em curso se movem; o placar não reordena durante a coleta. CSS ornamental congela sob `prefers-reduced-motion`; vez, estado e resultados têm equivalentes textuais em `aria-live`.

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
    ├── transport.ts               # eventos privados de lance e pedido de rolagem
    ├── localTransport.ts          # adapter headless
    ├── supabaseTransport.ts       # adapter Realtime/Postgres
    ├── client.ts                  # envio e recuperação do próprio lance
    ├── host.ts                    # autoridade, prazo e fechamento
    ├── roomSession.ts             # fases auction/rolling/reveal e ações da UI
    └── ui/
        ├── OnlineGate.tsx         # roteamento das novas fases
        └── LobbyScreen.tsx        # coleta, disputa de dados e revelação animadas

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
