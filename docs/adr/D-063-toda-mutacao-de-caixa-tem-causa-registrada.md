# D-063 — Toda mutação de caixa tem causa registrada

**Data:** 2026-07-29 · **Status:** aceita · **Refina:** [D-032](D-032-log-de-eventos-tipado-narrativa-e-da-ui.md) (log tipado)

**Decisão:** nenhuma linha do motor escreve `player.cash` diretamente. Todo movimento de caixa passa por **uma** função (`moveCash`), que recebe o motivo como argumento obrigatório e registra, no estado, uma entrada de **razão** com `{ who, before, delta, reason, after }`. O conjunto de motivos é fechado e tipado: um mecanismo novo que mova dinheiro precisa nomear-se antes de compilar.

A razão vive num campo próprio do `GameState` (`ledger`), separado do `log` narrativo. Os dois têm públicos diferentes e não devem competir pelo mesmo espaço:

- **`log`** é a narrativa que o jogador lê. Cabe 50 entradas e é escrito para ser frase em português (`describeLogEntry`).
- **`ledger`** é a contabilidade que a mesa audita. Guarda saldo anterior, delta, motivo e saldo final de cada movimento, e existe para responder "de onde saiu esse dinheiro?" sem depender de alguém ter escrito uma frase bonita para o caso.

**E o `log` narrativo fica completo no mesmo passo.** Auditando o motor contra este critério, seis regras moviam dinheiro sem emitir **nenhum** fato narrativo:

| Regra | O que o jogador via |
|---|---|
| **Fiscal / Tax Man** (§13.8) | nada — o caixa do dono caía na troca de vez, sem linha no histórico |
| **Aquisição Hostil** (§10.6) | só um aviso efêmero; nada no histórico, nem o valor pago |
| **Auditoria Fiscal** (§10.6) | nada |
| **Despejo** (§10.6) | nada |
| **Aniversário / Boom / Crise** (§10.6) | só o delta de **quem sacou** a carta; os outros jogadores mudavam de saldo sem fato |
| **Troca aceita** (§8.3) | `{ who, toId }` — quem trocou com quem, sem nenhum valor |

O Fiscal é o caso que mais custou: é a **única** regra do jogo que debita um jogador **fora da vez dele**, roda automaticamente na passagem de turno, e era completamente muda. Três relatos de bug distintos — "perdi dinheiro quando não era minha vez", "perdi 200 fora da vez", "as contas oscilam" — descrevem exatamente o que uma regra correta e invisível produz. Não havia bug de cálculo em nenhum dos três: havia uma cobrança legítima que o jogo se recusava a explicar.

**Por quê:** o motor já tinha conservação de dinheiro verificada — a simulação recomputa cada mecanismo de forma independente e acusa qualquer jogador cujo delta não seja explicado (`tests/sim/engine/conservation.ts`). Ela passou em todos os lotes e não pegou nenhum destes casos, e o motivo é instrutivo: **conservação e explicabilidade são propriedades diferentes**. O dinheiro do Fiscal está conservado — sai do dono, é destruído pelo banco, e a simulação sabe disso e marca `taxman-sink` como esperado. O que ninguém verificava é se **existia uma frase** para o jogador entender aquilo. Um invariante contábil não vira invariante narrativo de graça.

Pior: a simulação tinha **espelhado o bug como especificação**. O checker do Aniversário calculava o esperado com `Math.min(50, p.cash)` — a mesma truncagem que a [D-061](D-061-obrigacao-a-outro-jogador-nao-e-truncada.md) reconheceu como furo. Recomputar "de forma independente" copiando a fórmula do reducer não é independência: é a mesma afirmação escrita duas vezes. Um oráculo derivado do código sob teste só prova consistência interna.

**Como aplicar:** `src/game/economy/cash.ts` passa a ser o único escritor de `player.cash`; `CashReason` é a união fechada dos motivos. `GameState.ledger` é `CashEntry[]`, bounded — snapshot anterior não tem o campo e lê-se como `[]`. Novos `LogKind`: `tax-man`, `hostile-takeover`, `audit`, `evict`, `card-collect` (movimento de carta imediata em jogador que **não** sacou), `sell-to-bank`; `trade` ganha os valores movidos; `debt-paid` ganha `creditorId`. Simulação — o oráculo de conservação para de espelhar truncagem (o esperado passa a ser a obrigação **cheia**, e a diferença tem de aparecer como dívida pendente), e ganha dois invariantes novos: **narração** (todo jogador com Δcaixa num despacho tem fato narrativo que o nomeia) e **razão** (todo Δcaixa é coberto pelas entradas de `ledger` daquele despacho). Um teste de guarda falha se `\.cash\s*[+\-]?=` aparecer em `src/` fora de `cash.ts` — a regra precisa ser mais barata de seguir que de burlar.
