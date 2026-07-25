# Implementation Plan: Partida online jogável — perspectiva local, identidade real e roteamento

**Branch**: `main` (fluxo sem branch por feature) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/038-partida-online-jogavel/spec.md`

## Summary

A 037 entregou a sincronização; a 038 entrega a **experiência**. Hoje a UI foi escrita para um cliente único: **11 arquivos** derivam de `game.turnOrder[game.activeSeat]` e renderizam a perspectiva do *jogador da vez*, seja quem for que esteja olhando. Online, isso significa que a tela de todo mundo vira a tela do jogador ativo — inclusive a mão de cartas dele (viola o princípio VI) — e oferece botões que o host vai descartar.

**Chave técnica**: `actorOf(state, action)` (`src/game/commands.ts:192`) já responde "quem é o ator legítimo desta ação" e **é a função que o host usa para validar** (`host.ts:70`). A UI passa a consumir **a mesma função**: a affordance não pode divergir da autoridade porque ambas leem a mesma tabela. Nada de regra nova, nada de segunda lista de "quem pode o quê" para sair de sincronia.

Sobre isso, três camadas finas e puras — `localView` (quem sou eu, o que posso acionar), `identity` (playerId → nome/cor/peça, vindo da sala, nunca do `GameState`) e `roomStore` (assento local, identidades e conexão para a UI) — e a UI existente troca `activeSeat` por elas.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19, ES modules.

**Primary Dependencies**: Zustand 5 (store), `@supabase/supabase-js` (já instalado e em uso pela 037). Nenhuma dependência nova.

**Storage**: nenhuma mudança de schema. A identidade já vive em `rooms.seats` (jsonb) — a 038 só a consome. `GameState` segue sem PII (D-019).

**Testing**: Vitest (ambiente node). **Decisão de testabilidade**: toda a lógica desta spec nasce em módulos **puros** (`localView.ts`, `identity.ts`, reducers de sala) cobertos em `tests/net/`; a camada React fica fina o bastante para não precisar de suíte de componente (o projeto não tem DOM testing hoje, e esta spec não é o lugar para introduzi-lo). O smoke de infra (`scripts/net-smoke.ts`) ganha um passo de perspectiva.

**Target Platform**: Web (browser). Testes em node.

**Project Type**: SPA React/Vite — projeto único.

**Performance Goals**: nenhuma nova; a propagação medida na 037 é de 27ms (SC-002 pede <1s). O banner de pausa precisa aparecer em <2s (SC-004), o que a presença do Realtime já entrega.

**Constraints**: motor intacto (princípio I); `GameState` sem PII (D-019); autoridade permanece no host (D-020); privacidade de cartas é de apresentação (D-030); pausa não pune e não expira (VII, D-015, D-029).

**Scale/Scope**: 2–8 assentos por sala. Toca ~11 arquivos de UI existentes + 6 novos módulos.

## Constitution Check

*GATE — reavaliado após o design (seção "Re-check" ao final).*

| Princípio | Conformidade |
|---|---|
| **I. SRS é verdade absoluta** | ✅ Nenhuma regra nova. A única mudança de comportamento de regra é o gatilho de pausa ignorar eliminados — e ela **já virou ADR antes desta spec** ([D-029](../../docs/adr/D-029-desconexao-de-jogador-eliminado-nao-pausa-a-partida.md), SRS §11.3 v1.5). Os reducers de `src/game/{turn,economy,cards,...}` não são tocados. |
| **II. Discovery antes de código** | ✅ Spec 038 aprovada, sem `[NEEDS CLARIFICATION]`; este plan a operacionaliza. |
| **III. Tesouro precisa impactar** | ✅ Não afetado — nenhuma mecânica muda. |
| **IV. Catch-up é discreto** | ✅ As superfícies novas (banner de pausa, painel de jogadores com nomes) não destacam mecanismo de catch-up algum. |
| **V. Sem dependência de cooperação** | ✅ Não afetado. |
| **VI. Privacidade de cartas** | ✅ É o coração da US1: a mão exibida passa a ser a do **dono da tela**. Alcance da garantia (apresentação, não dados) fixado por [D-030](../../docs/adr/D-030-privacidade-de-cartas-e-garantia-de-apresentacao-no-v1.md) e registrado no SRS §10.3 — a spec não promete mais do que entrega. |
| **VII. Resiliência de sessão** | ✅ Torna visível o que a 037 já fazia: quem caiu, pausa sem timeout, retomada automática. A UI de pausa não tem contagem regressiva nem ação destrutiva. |

Sem violações. Complexity Tracking vazia.

## Arquitetura

### O problema em uma linha

```
hoje:   UI  ──lê──>  game.turnOrder[game.activeSeat]        "mostre a vez de quem está jogando"
038:    UI  ──lê──>  localView(game, room, meuToken)         "mostre o que EU posso ver e fazer"
```

### Camada 1 — `src/net/localView.ts` (puro, testável)

Fonte única de perspectiva. Não conhece React nem transporte.

```ts
type LocalRole = 'actor' | 'observer' | 'eliminated' | 'spectatorless' // último = single-player

interface LocalView {
  seatId: string | null            // meu playerId ('p3') — null em single-player
  role: LocalRole
  isMe(playerId: string): boolean
  mayAct(kind: GameAction['kind']): boolean   // identidade: sou o ator legítimo desta ação?
  waitingFor: string | null        // playerId de quem o jogo aguarda (para "aguardando <nome>")
}
```

`mayAct` deriva de `actorOf` — a mesma tabela que o host consulta. Para isso, `src/game/commands.ts` ganha um irmão **derivado, não duplicado**:

```ts
// commands.ts — expõe a consulta por KIND, sem exigir a ação completa (a UI pergunta
// "posso rolar?" antes de ter os dados do comando). Mesma tabela do `actorOf`.
export function actorOfKind(state: GameState, kind: GameAction['kind']): string | null
// e `actorOf` passa a ser um fino wrapper sobre ela nos kinds que não dependem de payload.
```

**Distinção que o plan deve deixar explícita** (e que os testes vão fixar): `mayAct` responde **identidade** ("esta decisão é minha?"), não **elegibilidade** ("o motor aceita agora?"). Elegibilidade continua sendo dos gates que já existem (`activeBidders`, `canAcquire`, saldo suficiente…). Um lance de leilão, por exemplo, é legítimo de qualquer licitante — a UI já sabe filtrar por `auction.activeBidders`; o que a 038 acrescenta é "…e apenas o meu". As duas condições se compõem; nenhuma substitui a outra.

**Single-player (`seatId === null`)**: `mayAct` devolve sempre `true` e `isMe` casa com o jogador da vez — o comportamento de hoje, preservado por construção (FR-029/SC-007).

### Camada 2 — `src/net/identity.ts` + `src/net/roomStore.ts`

`identity.ts` (puro): `identityOf(room, playerId) → { name, color, piece }`, com **fallback local** quando não há sala (`Jogador 1..8` + cor do assento) — assim nenhuma superfície precisa de um `if (multiplayer)`, e `p1..pN` some da UI inteira de uma vez (FR-009).

`roomStore.ts` (Zustand, **aditivo** — mesma decisão de risco da 037, que não refatorou `store.ts`): guarda `room`, `myToken` e expõe a `LocalView` derivada. Alimentado por `connectMultiplayer` (que hoje só injeta o `game`); vazio em single-player.

> **Por que um store separado e não campos no `useGameStore`**: manter o `GameState` livre de PII é invariante de arquitetura (D-019), e misturar identidade de sala no store do jogo é justamente o caminho para vazá-la para o snapshot persistido. Separado, a fronteira é física.

### Camada 3 — a UI existente

Os 11 arquivos que hoje derivam de `activeSeat` passam a consumir `useLocalView()` / `useIdentity()`:

| Arquivo | O que muda |
|---|---|
| `game/ui/GameHUD.tsx` | nome/cor no lugar de `p.id` (linhas 181, 288, 377); barra de decisão só quando `mayAct`; status de conexão por assento |
| `game/ui/modals/ModalLayer.tsx` | modal de decisão só para o ator; para os demais, versão "assistindo" (mesmo conteúdo, sem controles) |
| `game/ui/modals/activeModal.ts` | seletor ganha o ator do modal, para o ModalLayer decidir sem recalcular |
| `game/ui/cards/HandPanel.tsx`, `handView.ts`, `HandCardLayer.tsx` | mão do **dono da tela** (hoje: do jogador da vez) — FR-005/006 |
| `game/ui/trade/TradeLayer.tsx` | proposta recebida aparece para o destinatário; para o proponente, "aguardando <nome>" |
| `game/ui/landAuction/LandAuctionLayer.tsx` | lance só do próprio assento (o seletor de licitante já existe; passa a ser fixo em mim) |
| `game/ui/LiveTokens.tsx`, `boards/shared.tsx` | peça/cor por identidade da sala |
| `game/ui/GameDriver.tsx` | **só o cliente do ator** dispara auto-resolve/auto-finalize — hoje N clientes enviariam o mesmo comando e o host descartaria N-1 (correto, mas é tráfego e log inútil) |
| `game/ui/deed/deedView.ts` | rótulo de dono por nome |

### Camada 4 — sala, pausa e roteamento (`src/net/`)

- **`host.ts`**: gatilho de pausa passa a ignorar assentos de jogadores **eliminados** (D-029) — `anyDisconnected(room)` vira `anyDisconnected(room, game)`; a retomada não espera eliminados. Ganha `kickSeat(token)` (só no lobby, FR-024/025).
- **`room.ts`**: `kickSeat` puro + sorteio da ordem inicial (`shuffleSeats(room, rng)`) alimentando `playerIdsInOrder` — `turnOrder` já existe no `GameState`, então é composição, não regra nova (FR-030/031).
- **`transport.ts`**: o evento de recusa ganha o motivo `kicked` (reusa `rejectJoin`, sem canal novo).
- **`ui/OnlineGate.tsx`** vira roteador de fases (`home | lobby | match | end`), com `HomeScreen.tsx` novo (criar sala / colar link) e `PauseBanner.tsx` novo. `LobbyScreen.tsx` ganha escolha de peça, botão de remover e a tela de ordem sorteada.

### Ordem de implementação sugerida (fatia vertical por vez)

1. `localView` + `actorOfKind` + testes → **US1 já demonstrável** com o HUD e os modais.
2. `identity` + `roomStore` → **US2**.
3. Pausa visível + D-029 no host → **US3**.
4. Roteamento + home + kick + peça → **US4**.
5. Ordem sorteada → **US5**.

Cada passo é entregável sozinho, na ordem de prioridade da spec.

## Project Structure

### Documentation (this feature)

```text
specs/038-partida-online-jogavel/
├── spec.md                  # já existe
├── plan.md                  # este arquivo
├── research.md              # decisões de design e alternativas descartadas
├── data-model.md            # entidades da perspectiva local
├── quickstart.md            # como rodar e verificar a fatia
├── contracts/
│   ├── local-view.md        # contrato de `LocalView` (o que a UI pode perguntar)
│   └── requirements.md      # checklist de qualidade (já existe, de /speckit-specify)
└── tasks.md                 # Fase 2 — gerado por /speckit-tasks
```

### Source Code

```text
src/
├── game/
│   ├── commands.ts          # editado — `actorOfKind` (mesma tabela do `actorOf`)
│   └── ui/                  # editado — 11 arquivos trocam activeSeat por localView/identity
└── net/
    ├── localView.ts         # NOVO — perspectiva local (puro)
    ├── identity.ts          # NOVO — playerId → nome/cor/peça, com fallback single-player
    ├── roomStore.ts         # NOVO — sala + assento local para a UI (Zustand, aditivo)
    ├── room.ts              # editado — kickSeat, sorteio de ordem
    ├── host.ts              # editado — pausa ignora eliminados (D-029), kick
    ├── transport.ts         # editado — motivo `kicked`
    ├── connectStore.ts      # editado — alimenta o roomStore junto com o game
    └── ui/
        ├── OnlineGate.tsx   # editado — roteador de fases
        ├── HomeScreen.tsx   # NOVO
        ├── LobbyScreen.tsx  # editado — peça, kick, ordem sorteada
        └── PauseBanner.tsx  # NOVO

tests/net/
├── localView.test.ts        # NOVO — identidade x elegibilidade, ator fora do turno, eliminado
├── identity.test.ts         # NOVO — nomes duplicados, fallback single-player, zero `pN`
├── kick.test.ts             # NOVO — remoção no lobby, cor liberada, host não se remove
├── pause.test.ts            # editado — eliminado que cai NÃO pausa (D-029)
└── lobby.test.ts            # editado — ordem sorteada idêntica em todos os clientes

scripts/net-smoke.ts         # editado — passo de perspectiva contra a infra real
```

**Structure Decision**: projeto único. A casca de rede continua concentrada em `src/net/`; a UI do jogo consome os módulos puros dela sem inverter a dependência (nada em `src/net/` importa de `src/game/ui/`).

## Riscos & mitigações

- **Divergência affordance × autoridade** — se a UI ganhasse a própria tabela de "quem pode agir", ela sairia de sincronia com o host no primeiro comando novo. Mitigação: `mayAct` deriva de `actorOf`; um teste fixa que **todo** `kind` de `GameAction` é coberto pela mesma tabela (falha ao adicionar comando novo sem tratar a perspectiva).
- **Regressão do single-player** — a UI é a mesma para os dois modos. Mitigação: `seatId === null` faz `mayAct` devolver `true` sempre; a suíte existente (397 testes) não muda e o SC-007 permanece verificável.
- **Vazamento de PII para o snapshot** — a tentação de colocar `name` no `Player` para simplificar a UI é real e quebraria D-019. Mitigação: identidade mora em store separado, e o teste de `identity` verifica que o `GameState` serializado não contém nome algum.
- **`GameDriver` em N clientes** — auto-comandos disparados por todos geram tráfego inútil (hoje descartado pelo host). Mitigação: gate por `mayAct` na fatia 1.
- **Eliminado e pausa (D-029)** — mudar o gatilho mexe em código coberto por `pause.test.ts`; a mudança precisa vir **test-first** para não afrouxar o que a 037 provou (pausa por jogador vivo continua valendo).

## Re-check da Constituição (pós-design)

Nada no design introduz regra, PII no `GameState`, dependência de cooperação ou pressão de tempo. A única alteração de comportamento (D-029) está ancorada em ADR e no SRS v1.5. **Gate: PASS.**
