# Contrato — `LocalView` (o que a UI pode perguntar)

Interface interna que a UI do jogo consome no lugar de `game.turnOrder[game.activeSeat]`. É o "contrato público" desta feature: quem renderiza pergunta, quem sabe responde é `src/net/localView.ts`.

## Superfície

```ts
import type { GameAction } from '@/game/commands'

export type LocalRole = 'actor' | 'observer' | 'eliminated' | 'local'

export interface LocalView {
  readonly seatId: string | null
  readonly role: LocalRole
  isMe(playerId: string): boolean
  mayAct(kind: GameAction['kind']): boolean
  readonly waitingFor: string | null
}

export function localView(game: GameState, room: Room | null, myToken: string | null): LocalView
```

Hook de conveniência (React): `useLocalView()` — lê `roomStore` + `useGameStore` e memoiza por `(game, room)`.

## Perguntas que a UI faz, e a resposta certa

| Pergunta da UI | Chamada | Observação |
|---|---|---|
| "mostro o botão de rolar?" | `mayAct('roll')` | identidade apenas; o estado do turno continua sendo condição à parte |
| "este painel é meu?" | `isMe(p.id)` | substitui toda comparação com o jogador da vez |
| "posso dar lance?" | `mayAct('place-bid') && auction.activeBidders.includes(seatId)` | **as duas** condições: identidade **e** elegibilidade |
| "respondo esta troca?" | `mayAct('accept-trade')` | resolve sozinho: `actorOf` já deriva o destinatário de `pendingTrade.toId` |
| "de quem o jogo está esperando?" | `waitingFor` | `null` quando não há decisão pendente |
| "mostro a mão de quem?" | `seatId ?? jogadorDaVez` | única regra de exibição da mão (FR-005) |

## Garantias

1. **Espelho da autoridade** — `mayAct` deriva da mesma tabela (`actorOf`) que o host consulta ao validar. Se divergirem, é bug de implementação, não de configuração: não há segunda lista para manter.
2. **Nunca é validação** — nenhuma decisão de segurança depende desta interface. Cliente adulterado que ignore `mayAct` tem o comando descartado pelo host (FR-004/FR-007 da 037, provado em `antispoof.test.ts` e no smoke contra a infra real).
3. **Neutra em single-player** — `seatId === null` ⟹ `mayAct` sempre `true` e `isMe` casa com o jogador da vez. Nenhuma superfície precisa saber em que modo está.
4. **Eliminado não age** — `role === 'eliminated'` ⟹ `mayAct` sempre `false`, mas a tela continua acompanhando a partida (FR-007).

## Exaustividade (teste obrigatório)

`localView.test.ts` deve iterar **todos** os `kind` de `GameAction` e afirmar que cada um tem ator definido (ou `null` explicitamente justificado, como comandos de sistema). Comando novo adicionado sem decidir a perspectiva quebra a suíte — que é o ponto: a perspectiva deixa de ser algo que se esquece de atualizar.
