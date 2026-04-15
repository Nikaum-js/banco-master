# Research — Compra & Aluguel (Fase 0)

Decisões técnicas. Esta feature **introduz a economia** (dinheiro + posse) e **estende** a resolução de casa do 002 sem reabrir a FSM.

---

## D1 — Posse por mapa `titles: Record<pos, Title>` (chave = índice do board)

- **Decisão:** representar a posse como `titles[pos] = { ownerId: string | null; mortgaged: boolean }` (`null` = banco/livre). Consultas derivadas (quantas do grupo / aeroportos / utilidades o dono tem) por varredura do board.
- **Rationale:** ao resolver a casa, o lookup é por `pos` (O(1)). As contagens de posse são pequenas (≤4 por grupo, ≤4 aeroportos) e raras (só ao cobrar aluguel). Mantém o título junto da casa, alinhado ao board estático (001).
- **Alternativas:** lista de propriedades por jogador — rejeitada: o caso quente é "quem é dono desta `pos`", que ficaria O(n).

## D2 — Integrar com a FSM do 002 sem alterá-la

- **Decisão:** a compra/leilão são interativas → `resolveSquare` (chamado pelo `resolvePending` do 002) retorna `{ done: false }` para propriedade livre e abre um slice transitório `game.resolution` (modal de compra ou leilão). Comandos novos (`buyProperty`/`declineProperty`/`placeBid`/`closeAuction`) **completam** a resolução, setando `turn.pendingResolve = false` e `turn.state = 'aguardando-finalizacao'`. Aluguel é síncrono → `{ done: true }`.
- **Rationale:** o 002 está fechado e testado; ele só precisa saber que a casa **continua pendente** (já bloqueia finalizar — FR-022 do 002). 003 preenche o "como". Sem tocar `turnMachine.ts`.
- **Alternativas:** adicionar um hook genérico de interação no 002 — rejeitada: reabriria a FSM estável por algo que o flag `pendingResolve` já sustenta.

## D3 — Cronômetro do leilão serializável (`deadline`), efeito no store

- **Decisão:** o estado do leilão guarda `deadline: number` (epoch ms) — **não** um handle de timer. `placeBid` recalcula `deadline = now + AUCTION_WINDOW`. O `setTimeout` que dispara `closeAuction` vive **só no store** e é reconstruível a partir do `deadline` (na reconexão / após pausa).
- **Rationale:** princípio VII — estado puro/serializável. A pausa do 002 (`paused`) congela logicamente; ao retomar, o store reagenda pelo `deadline` restante.
- **Alternativas:** guardar o handle do timer no estado — rejeitada: não serializável, quebra resiliência.

## D4 — `cash` no Player; transferências diretas (não por porta)

- **Decisão:** adicionar `Player.cash` (semente $2.000, SRS §3.1). Compra (jogador→banco), aluguel (jogador→dono) e lance (vencedor→banco) movem `cash` **diretamente** na lógica de 003. As portas do 002 (`onPassGo`/`onPayToCenter`) seguem para a spec de Balanceamento.
- **Rationale:** 003 é a dona da economia de compra/aluguel; abstrair essas transferências atrás de portas seria over-engineering. O crédito do GO Progressivo (valor) continua responsabilidade de Balanceamento.
- **Alternativas:** rotear tudo por um "banco" abstrato/porta — rejeitada agora (YAGNI); pode ser extraído se a spec de Falência/Empréstimos exigir.

## D5 — Insolvência por porta `onInsolvency` (deferida a Falência)

- **Decisão:** se o pagador não tem `cash` para um aluguel obrigatório, 003 chama `ports.onInsolvency(playerId, amount, creditorId)` e **não** força saldo negativo; a resolução é considerada concluída (o fluxo de Falência assume).
- **Rationale:** falência (vender/hipotecar/negociar/eliminar) é uma spec própria. 003 só **sinaliza**.
- **Alternativas:** permitir saldo negativo — rejeitada: mascara a regra de falência.

## D6 — Aluguel sem construção; ponto de extensão para Construção

- **Decisão:** `rent.ts` calcula o aluguel **sem construção** (cidade base/150%/200%, aeroporto por contagem, utilidade por múltiplo dos dados). A função de cidade recebe a posse do grupo e expõe claramente onde a spec de **Construção** somará os multiplicadores (casas/hotéis/Skyscraper).
- **Rationale:** fronteira de spec (§5.1: linhas de construção são da Construção). Mantém 003 focado.
- **Alternativas:** já modelar a tabela de construção — rejeitada: invade a spec de Construção.

---

## Decisões de regra já fixadas (clarificações da spec)

- **Leilão:** cronômetro curto reiniciado a cada lance; sem lance no tempo → fecha (timer de leilão, não de turno).
- **Aluguel cidade, grupos de 4:** maioria **3 de 4** → 150%; completo → 200%; 1-2 → base.
- **Lance:** mínimo inicial $1; cada lance só precisa ser maior que o atual e não exceder o caixa.

Nenhum `NEEDS CLARIFICATION` pendente.
