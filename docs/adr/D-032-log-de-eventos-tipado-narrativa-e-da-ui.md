# D-032 — Log de eventos tipado: o motor emite fatos, a narrativa é da UI

**Data:** 2026-07-26 · **Status:** aceita

**Decisão:** `LogEntry` deixa de ser `{ who: string, what: string }` e passa a ser um **evento tipado e discriminado** — `{ kind, who, ...campos do kind }` — onde `kind` é um literal fechado (`'roll' | 'rent' | 'buy' | 'build' | 'mortgage' | 'tax' | 'go' | …`), `who` continua o **id** do autor (ou `'bank'`), e os dados do evento entram como **campos estruturados** (`amount`, `pos`, `targetId`, `deck`, …), nunca interpolados em prosa.

A **frase em português é responsabilidade da UI**, não do motor. `src/game/log.ts` para de produzir texto; um renderizador na camada de apresentação traduz evento → frase, resolvendo `who`/`targetId` pela **identidade da sala** (spec 038) e formatando dinheiro num só lugar.

Consumidores param de **adivinhar por substring**. O som (`classifyLogEntry`, hoje 9 testes de `includes`/`startsWith` sobre a frase) e o ícone do histórico (`logEventIcon`, 6 regexes) passam a ramificar sobre `kind`, com `switch` exaustivo — o compilador cobra o caso novo.

O log passa a **cobrir os eventos que hoje não registra**: construção, venda de construção, hipoteca/deshipoteca, abertura e fecho de leilão e de pregão, coleta do Free Parking, fiança de prisão, concessão/transferência de imunidade e carta jogada da mão.

**Por quê:** três defeitos medidos, todos com a mesma causa — o motor grava prosa e quem precisa do fato tem que reconstruí-lo do texto.

1. **O log é cego para metade do jogo.** São 14 pontos de emissão em `src/game/**`, e nenhum cobre construção, hipoteca, leilão, venda de construção, coleta do pote ou fiança. O `logEventIcon` (`boards/shared.tsx:1515`) testa `constru|hangar|hotel|arranha|vendeu`, `hipotec`, `leil`, `pote` e `fian` — **oito padrões que o motor nunca emite**. Os ramos são inalcançáveis: o histórico não perde só o ícone, perde o evento. Quem constrói um hotel não vê nada acontecer no diário de bordo.

2. **O log vaza `p1..pN`, que a 038 tirou do resto da UI.** `CenterLog` renderiza `{l.who}` cru (`shared.tsx:1600`) e colore por índice em `PLAYER_COLORS` em vez da cor da sala; os textos do motor embutem ids nas próprias frases — `aluguel a ${owner}` (`resolveRentable.ts:36`), `${trade.fromId} ↔ ${trade.toId}` (`trade.ts:181`), `juros a ${loan.creditorId}` (`emprestimos.ts:153`). A 038 trocou `p.id` por identidade real em `playersView` e declarou o `pN` extinto da tela; o histórico ficou fora, e nenhum teste pega porque o motor está certo — é a apresentação que está errada, e ela não tinha onde resolver o nome. Enquanto o id estiver **dentro da string**, não tem: a frase chega pronta.

3. **Classificação por substring é frágil no ponto onde ninguém olha.** `classifyLogEntry` decide o som por `w.includes('de aluguel a')`, `w.includes('juros')`, `w.includes('pelo GO')`. Reescrever uma frase por motivo de redação — coisa que ninguém trata como mudança de comportamento — muda o som que toca. Já há prova do modo de falha na casa ao lado: a sessão de 2026-07-25 registrou que o E2E de 6 jogadores travou porque um rótulo de botão mudou e o roteiro procurava o antigo. O acoplamento por texto é o mesmo. E `emprestimos.ts:153` já emite **`R$`** onde todo o resto emite `$` — inconsistência que só existe porque cada ponto formata dinheiro por conta própria.

Tipar o evento resolve os três de uma vez, e é pré-requisito de três coisas que o backlog quer depois: **explicação de aluguel** na UI (precisa de `base`/`multiplicador`/`posse`, não de uma frase), **cor por tipo** no histórico e **i18n** (impossível com português compilado no reducer).

**Alternativa considerada e rejeitada:** manter `what` e **acrescentar** `kind` ao lado, sem tocar as frases. Custa menos e destrava o som e o ícone, mas deixa os ids dentro da string — ou seja, não fecha o defeito 2, que é o mais visível — e cria a obrigação permanente de manter frase e campos coerentes em 14 pontos, sem nada que verifique. Dois lugares onde a verdade pode divergir é pior que um lugar novo.

Nenhum princípio muda. A regra de jogo não é tocada: `logEvent` não decide nada, e nenhum reducer lê `state.log`. Princípio VI segue valendo — o log **não** ganha campo de raridade nem de carta sacada por outrem (o evento de saque continua genérico, como a 035 já fixou em FR-016), e a mesma reserva da [D-030](D-030-privacidade-de-cartas-e-garantia-de-apresentacao-no-v1.md) se aplica: é garantia de apresentação.

**Custo aceito:** `GameState` é serializado e persistido (D-020), então **snapshot com log no formato antigo deixa de casar com o tipo**. Não há migração: o produto é pré-lançamento e a única sala real é de teste. O renderizador tolera a entrada legada (`kind` ausente → imprime `what` como texto solto) para que um snapshot velho não derrube a tela, e nada mais.

**Como aplicar:** o SRS não muda — §12.2 pede "log de eventos (últimas ações)" e continua satisfeito; esta é decisão de representação, não de regra. `LogEntry` vira união discriminada em `economy/types.ts`; `logEvent(state, entry)` recebe o evento montado; os 14 pontos passam a emitir campos e os eventos faltantes ganham emissão. Um módulo de apresentação (`describeLogEntry`) concentra a frase e resolve identidade via `src/net/identity.ts`; `classify.ts` e `logEventIcon` ramificam por `kind` com exaustividade verificada por teste, como `localView.test.ts` já faz para os comandos (spec 038). **Não** transformar o log em event bus de regra: nenhum reducer passa a ler `state.log` — se um comportamento precisar de histórico, o dado vive no `GameState`, não na narrativa.
