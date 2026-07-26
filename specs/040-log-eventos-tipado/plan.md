# Implementation Plan: Log de eventos tipado

**Branch**: `main` (fluxo sem branch por feature) | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification de `specs/040-log-eventos-tipado/spec.md`

## Summary

Trocar `LogEntry` de `{ who, what }` por uma **união discriminada** por `kind`, mover a composição da frase para a UI, e fechar as famílias de evento que o motor hoje não registra.

O desenho tem uma única ideia estrutural: **o `kind` é o contrato**. Hoje há três consumidores do log (frase, som, ícone) e cada um faz sua própria arqueologia sobre a string. Depois, os três ramificam sobre o mesmo literal fechado, e o compilador cobra o caso novo em todos — pelo padrão de exaustividade que a 038 já usa em `localView.test.ts`.

A fatia tem três movimentos, na ordem em que serão implementados:

1. **O tipo e o emissor** — `LogEntry` vira união, `logEvent` recebe o evento montado, os 14 pontos existentes passam a emitir campos (FR-001..006, FR-014).
2. **A apresentação** — `describeLogEntry` compõe a frase resolvendo identidade e moeda; `CenterLog` passa a consumi-la (FR-016..022). É onde `p1` morre.
3. **Os eventos faltantes e os consumidores** — 12 `kind` novos nas 8 famílias silenciosas (FR-007..013) e `classify`/`logEventIcon` ramificando por `kind` (FR-023..026).

**O sinal de alarme desta fatia:** nenhum reducer deve ganhar lógica de decisão. `logEvent` é a última linha de cada reducer e não influencia nada — se durante a implementação um `if` de regra passar a depender de um campo de log, o desenho está errado (FR-006).

## Technical Context

**Language/Version**: TypeScript ~6.0 (`strict` **desligado** em todos os tsconfig do repo — ver sessão de 2026-07-26), React 19

**Primary Dependencies**: nenhuma nova. Zustand (store), Vitest (testes). O motor não depende de React; a **apresentação** do log depende (é onde ela passa a viver).

**Storage**: `GameState` serializável (snapshot Supabase). A união discriminada é JSON puro — literais e números, sem classe nem `Date`. Snapshot antigo não é migrado (FR-022).

**Testing**: Vitest. Motor em `tests/game/`, rede em `tests/net/`, UI/seletores em `tests/game/ui/`, simulação em `tests/sim/`.

**Target Platform**: browser (Vite). O motor e o descritor rodam headless — o descritor é função pura de `(entry, room) → string`, testável em Node.

**Project Type**: SPA + BaaS. Motor puro em `src/game/**`, rede em `src/net/**`, apresentação em `src/game/ui/**` e `src/boards/`.

**Performance Goals**: nenhuma meta nova. O log é limitado a 50 entradas e o descritor roda por linha renderizada — 50 chamadas de `switch` por render do histórico, irrelevante. **Ponto de atenção:** a chave de valor do som (`logKey`) roda sobre as 50 entradas a cada mudança de estado; ela precisa continuar barata (concatenação de campos, não `JSON.stringify` do estado).

**Constraints**:
- **Reducers puros** `(state, ctx) → state` com `structuredClone` (constitution). `logEvent` continua mutando o rascunho já clonado, como hoje.
- **O log é saída, nunca entrada** (FR-006): nenhum reducer lê `state.log`.
- **Convergência**: o evento é dado, então o log converge byte a byte (SC-007). A **frase** é composta no cliente e pode diferir entre clientes com salas diferentes — isso é correto e é o ponto do desenho, não um defeito.
- **Privacidade VI**: o evento de saque não ganha raridade nem id de carta (FR-015). O que hoje é garantido por logar só o deck passa a ser garantido pelo **tipo** — o campo não existe para ser esquecido.
- **Sem `Date.now()`** em `src/game/**`: o log não tem timestamp e continua sem (recência = ordem).

**Scale/Scope**: 1 tipo reformado, 26 `kind` (13 preservados, 12 novos, 1 de compatibilidade), 14 pontos de emissão reescritos, 12 `kind` novos em 13 pontos de emissão (`jail-fine` tem dois), 1 módulo de apresentação novo, 3 consumidores reescritos. Estimativa: ~450 linhas de produção, ~60 casos de teste. É a maior fatia desde a 038 — daí a ordem em 3 movimentos, cada um verde antes do próximo.

## Constitution Check

*GATE: passou antes do Phase 0; re-checado após o design.*

| Princípio | Situação |
|---|---|
| **I — SRS é verdade absoluta** | ✅ Nenhuma regra muda. §12.2 pede "log de eventos (últimas ações)" e passa a ser **mais** cumprido (8 famílias que faltavam). Sem bump de SRS. A decisão de representação foi registrada em **D-032 antes** da spec. |
| **II — Discovery antes de código** | ✅ ADR → spec → plan → tasks → implement. |
| **III — Tesouro precisa impactar** | ➖ Não se aplica: nenhuma carta é criada ou alterada. O log **descreve** o efeito, não o define. |
| **IV — Catch-up é discreto** | ⚠️ **Ponto real.** FR-012 acrescenta entrada de log para o Free Parking, que é mecânica de catch-up. A entrada relata o **valor recebido** e nada mais — sem "porque você está atrás", sem rótulo. Mesma régua que a 030 aplicou ao modal de Free Parking (que já existe e já é neutro). O Fiscal (§13.8) e o bônus de GO seguem o mesmo padrão. |
| **V — Sem dependência obrigatória de cooperação** | ➖ Não se aplica. |
| **VI — Privacidade estratégica de cartas** | ✅ **Reforçado.** Hoje a privacidade do saque depende de um humano lembrar de logar só o deck; passa a depender do **tipo**, que não tem campo de raridade nem de carta. FR-015 + teste. A reserva da [D-030](../../docs/adr/D-030-privacidade-de-cartas-e-garantia-de-apresentacao-no-v1.md) (garantia de apresentação, não de dados) continua exatamente como está — esta fatia não a piora nem a resolve. |
| **VII — Resiliência de sessão** | ✅ O log continua 100% serializável e parte do snapshot. **Custo declarado:** snapshot anterior a esta fatia tem entrada sem `kind`; FR-022 a tolera em exibição, sem migração (D-032, "custo aceito"). |

## Project Structure

### Documentation (this feature)

```text
specs/040-log-eventos-tipado/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # o que foi descartado e por quê
├── data-model.md        # a união discriminada, kind por kind
├── contracts/
│   └── log-entry.md     # contrato do evento e do descritor
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/game/
├── economy/
│   ├── types.ts              # ALTERADO: LogEntry vira união discriminada; LogKind
│   ├── construction.ts       # NOVO log: build / build-hangar / sell-building / sell-hangar
│   ├── mortgage.ts           # NOVO log: mortgage / unmortgage
│   ├── auction.ts            # NOVO log: auction-won / auction-unsold (closeAuction)
│   ├── landAuction.ts        # NOVO log: lot-won / lot-unsold (dentro de settleLot)
│   ├── purchase.ts           # ALTERADO: emissão tipada
│   ├── resolveRentable.ts    # ALTERADO: emissão tipada (ownerId sai da string)
│   └── trade.ts              # ALTERADO: emissão tipada (fromId/toId saem da string)
├── balancing/
│   └── balancing.ts          # NOVO log: free-parking (collectCenter)
├── turn/
│   ├── turnMachine.ts        # ALTERADO: roll / go tipados; NOVO log: jail-fine (2 pontos)
│   └── resolution.ts         # ALTERADO: tax / bus-ticket tipados
├── cards/
│   └── draw.ts               # ALTERADO: card-draw (genérico) / card-immediate tipados
├── falencia/
│   └── falencia.ts           # ALTERADO: debt-paid / bankruptcy tipados
├── emprestimos/
│   └── emprestimos.ts        # ALTERADO: loan-interest tipado — o `R$` morre aqui
└── log.ts                    # ALTERADO: logEvent(state, entry); helper por kind

src/game/ui/
├── log/
│   ├── describeLog.ts        # NOVO: entry → frase (resolve identidade + moeda)
│   └── logIcon.ts            # NOVO: kind → ícone (sai de shared.tsx)
└── sound/
    └── classify.ts           # ALTERADO: classifyLogEntry por kind; logKey por campos

src/lib/
└── money.ts                  # NOVO (ou existente reusado): formatação única de dinheiro

src/boards/
└── shared.tsx                # ALTERADO: CenterLog consome describeLog + logIcon;
                              #           logEventIcon (linha 1515) REMOVIDO daqui

tests/game/
├── log/
│   ├── logEntry.test.ts      # NOVO: forma do evento, exaustividade, cobertura por família
│   └── describeLog.test.ts   # NOVO: frase, identidade, fallback, legado, moeda
└── (arquivos existentes)     # ALTERADO: asserções que afirmavam o formato antigo

tests/game/ui/
└── logIcon.test.ts           # NOVO: ícone por kind + exaustividade

tests/net/
└── logConverge.test.ts       # NOVO: SC-007 — log idêntico em 3 clientes
```

**Structure Decision**: duas pastas novas, ambas justificadas por lint que já morde. `src/game/ui/log/` existe porque `describeLog` e `logIcon` **não são componentes** — colocá-los em `shared.tsx` reintroduziria exatamente o erro de `react-refresh` que a sessão de 2026-07-25 gastou trabalho zerando (foi de onde saíram `groupColors.ts`, `deedRents.ts`, `tradeUI.ts`, `handCardUI.ts`). `tests/game/log/` espelha o motor.

O import novo é **apresentação → rede** (`describeLog` importa `identityOf` de `src/net/identity.ts`). Direção que já existe: `boards/shared.tsx` e os layers da 038 já importam de `src/net/`. **O motor não ganha import nenhum** — `src/game/economy/types.ts` continua sem conhecer `src/net/`, e é isso que mantém o log puro.

## Decisões de design

### D1 — União discriminada por `kind`, com os campos no topo do objeto

```ts
type LogEntry =
  | { kind: 'rent'; who: string; pos: number; amount: number; ownerId: string }
  | { kind: 'build'; who: string; pos: number; level: number; cost: number }
  | …
```

Campos **no topo**, não num `payload` aninhado. Aninhar daria um tipo mais arrumado no papel e um consumidor pior na prática: toda leitura viraria `e.payload.amount` com um `switch` em volta só para o TS aceitar. Com os campos no topo, o narrowing por `kind` entrega o campo direto.

`who` continua em todas as variantes e continua sendo **id** (ou `'bank'`). Não é redundante com os campos de alvo: `who` é o **autor** do fato (quem rolou, quem pagou), e alvo é quem recebeu.

**`'bank'` em vez de `'Banco'`**: hoje o autor-banco é a string `'Banco'` — um rótulo em português dentro do estado, que é precisamente o que esta spec está tirando de lá. Vira o literal `'bank'`, e a UI escreve "Banco". Isso muda a comparação em `CenterLog` (`l.who === 'Banco'`) e é uma quebra de snapshot já coberta por FR-022.

### D2 — `logEvent(state, entry)`: um argumento, montado no ponto de emissão

Hoje: `logEvent(state, who, what)`. Passa a: `logEvent(state, entry)`, com o evento inteiro montado pelo chamador. Descartado o formato `logEvent(state, kind, who, fields)` — separar `kind` dos campos impede o TS de correlacionar os dois, e o erro que mais interessa pegar (campo do `kind` errado) passaria batido.

O `shift` no teto de 50 fica onde está (FR-005).

### D3 — A frase mora em `describeLogEntry(entry, room)`, fora do motor

Assinatura: `describeLogEntry(entry: LogEntry, room: Room | null): LogSentence`.

Devolve **estrutura, não string crua** — a UI precisa colorir o dinheiro (já faz, via `LogWhat`) e negritar nomes. `LogSentence` é uma lista de fragmentos (`{ text }` / `{ money }` / `{ player: identity }`), e `CenterLog` renderiza cada tipo com seu estilo. String pura obrigaria a UI a re-parsear a frase com regex para achar o dinheiro — o mesmo pecado que a spec está eliminando, um andar acima.

`room` entra como parâmetro em vez de ser lido de hook dentro da função: mantém `describeLogEntry` **puro e testável em Node**, que é o que permite provar SC-001 (zero id na frase) sem montar React.

### D4 — Moeda numa fonte única, e a convenção vencedora é a da UI (`R$`, pt-BR)

**Levantamento antes de decidir mudou a direção desta decisão.** A suposição inicial era que `emprestimos.ts:153` (`R$ 100`) fosse o desvio e o `$` do resto do motor o padrão. É o inverso: **a UI inteira usa `R$` no formato pt-BR** com separador de milhar — `LandAuctionLayer.tsx:25` e `TradeLayer.tsx:27` (`const money = (v) => \`R$ ${v.toLocaleString('pt-BR')}\``), `GameHUD.tsx:48` (`fmt`), e inline em `NoticeLayer.tsx:106`, `ModalLayer.tsx:639` e cinco pontos de `shared.tsx`. O log é o único lugar do produto que escreve `$1200` sem separador, e o `R$` dos juros estava acidentalmente **certo**.

Então a fonte única é `money(n)` → `R$ 1.200` (pt-BR), e o defeito real é maior do que a spec descreveu: não é "uma entrada de log com símbolo errado", é **o log falando uma moeda diferente do resto do jogo**, mais **seis definições locais** do mesmo formatador espalhadas pela UI.

`money` vai para `src/lib/money.ts` (não em `game/ui/log/`: quem consome não é só o log). As seis definições locais convergem para ela — é o que torna FR-020 verdade em vez de aspiração. Nenhum formatador novo é criado sem que os existentes morram; duas fontes únicas não são fonte única.

**Cuidado de escopo:** trocar as seis definições locais é edição mecânica, mas cada uma está numa superfície visível. Elas produzem exatamente a mesma string que `money` produz (mesma expressão, copiada), então a troca é comportamentalmente neutra — se alguma divergir, é bug preexistente e vai aparecer como diferença de render. Vale conferir uma a uma em vez de confiar no substituir-tudo.

### D5 — Os 12 `kind` novos, e por que `build` é um só

As 8 famílias silenciosas viram 12 `kind` (detalhe campo a campo em [data-model.md](./data-model.md)):

| Família | `kind` | Onde emitir |
|---|---|---|
| Construção | `build`, `build-hangar` | `construction.ts` (`buildHouse`, `buildHangar`) |
| Venda de construção | `sell-building`, `sell-hangar` | `construction.ts` (`sellBuilding`, `sellHangar`) |
| Hipoteca | `mortgage`, `unmortgage` | `mortgage.ts` |
| Leilão comum | `auction-won`, `auction-unsold` | `auction.ts` (`closeAuction`) |
| Pregão | `lot-won`, `lot-unsold` | `landAuction.ts` (`settleLot`) |
| Free Parking | `free-parking` | `balancing.ts` (`collectCenter`) |
| Fiança | `jail-fine` | `turnMachine.ts` (`jailDecision` + 3ª tentativa) |

**`build` é um `kind` só, com `level: number`** (1–7), em vez de um `kind` por degrau do ladder. O ladder já é modelado por nível em `cityLevel` — abrir `build-house`/`build-hotel`/`build-hotel2`/`build-skyscraper` duplicaria essa modelagem no log e obrigaria som e ícone a tratar 4 casos que querem o mesmo som e o mesmo ícone. A frase deriva o substantivo do nível, que é uma escolha de apresentação e pertence ao descritor.

**`lot-won`/`lot-unsold` são emitidos dentro de `settleLot`**, que a spec 039 prometeu manter intacta. A promessa era daquela fatia (e foi cumprida lá); aqui é o ponto certo, porque é a única função por onde os dois caminhos de fecho passam (`closeExpiredLandLots` e `closeLandAuction`). Emitir nos dois chamadores duplicaria a lógica e deixaria o force-close silencioso no dia em que alguém esquecesse.

**`jail-fine` tem dois pontos** de emissão (`jailDecision('pay')` em `turnMachine.ts:316` e a multa forçada da 3ª tentativa em `:344`), com o mesmo `kind` — o fato é o mesmo, e a distinção "voluntário vs. forçado" não muda som, ícone nem frase. Se um dia mudar, entra um campo, não um `kind`.

### D6 — Exaustividade cobrada pelo compilador **e** por teste

Duas camadas, porque cada uma pega o que a outra não pega:

1. **Compilador**: `describeLogEntry`, `classifyLogEntry` e `logIcon` usam `switch` sobre `entry.kind` com `default: assertNever(entry)`. Acrescentar um `kind` sem tratá-lo é erro de tipo.
2. **Teste** (FR-026, SC-003): uma lista `ALL_LOG_KINDS` (derivada do tipo, não escrita à mão duas vezes) e um caso que exige som e ícone decididos para cada. É o padrão de `localView.test.ts` da 038.

A camada 1 sozinha não basta: com `strict` desligado no repo (estado registrado em 2026-07-26), `assertNever` é mais frágio do que aparenta, e `default: return null` é fácil de escrever por acidente — o que compila e silencia. A camada 2 sobrevive a isso.

**`ALL_LOG_KINDS` como fonte única:** a lista precisa ser exportada em runtime (teste itera sobre ela) e o tipo `LogKind` derivado dela (`typeof ALL_LOG_KINDS[number]`), não o contrário. Escrever a lista à mão ao lado da união criaria dois lugares para esquecer — e o teste de exaustividade passaria verde justamente quando a lista ficasse desatualizada.

### D7 — `logKey`: chave de valor derivada dos campos, com um cuidado

`logKey` alimenta `countNewLogEntries` (spec 035, FR-011), que decide o que é entrada nova para não re-tocar histórico. Ela passa de `` `${who}|${what}` `` para a concatenação ordenada dos campos do evento.

O cuidado: a chave **não é identidade**, é valor — e duas entradas idênticas em valor (dois `rolou 3+4` seguidos) têm que continuar contando como duas. `countNewLogEntries` já resolve isso por posição, comparando o sufixo, e continua funcionando desde que a chave seja **estável e determinística**. Ordem de campos fixa, portanto: `JSON.stringify` do objeto **não** serve, porque a ordem das chaves depende da ordem de construção, e um `structuredClone` no meio do caminho não garante nada.

### D8 — A entrada legada tem lugar no tipo, não um `any` no consumidor

FR-022 pede tolerar `{ who, what }` sem `kind`. Isso entra como uma variante explícita — `{ kind: 'legacy'; who: string; what: string }` — e o **carregamento** do snapshot normaliza a entrada sem `kind` para ela. Assim os três consumidores tratam `'legacy'` por exaustividade, como qualquer outro caso, em vez de cada um ter um `if (!e.kind)` na frente.

`'legacy'` **não é emitida pelo motor** — nenhum reducer a produz, e um teste fixa isso. Existe só como porta de entrada de dado velho.

### D9 — O que NÃO entra, apesar de o tipo permitir

O evento de aluguel **pode** carregar os campos que a explicação de aluguel vai precisar (base, multiplicador, fator de posse). Não vai: nesta fatia `rent` carrega `pos`, `amount` e `ownerId`, e nada mais. Acrescentar campo que ninguém lê é peso morto — e a lição da 039 está fresca (o `{ state, claimed }` do contrato que se revelou desnecessário). Quando a explicação de aluguel for construída, ela acrescenta os campos que usar, e o custo de acrescentar campo a uma união é baixo justamente porque ela é tipada.

Igualmente fora: cor por tipo no histórico, i18n, agregação de eventos repetidos, timestamp.

### D10 — Ordem de implementação: 3 movimentos, cada um verde

A fatia toca 14 arquivos do motor. Fazer tudo num passo deixaria a suíte vermelha por muito tempo, sem saber qual movimento quebrou o quê.

1. **Movimento 1 (tipo + emissão existente)** — a suíte do motor volta ao verde com as asserções de log reescritas. Nada de novo funciona ainda; a UI exibe frase composta pelos campos dos eventos que já existiam.
2. **Movimento 2 (apresentação)** — `describeLog` + `logIcon` + `CenterLog`. Aqui SC-001 passa a ser verificável, e `p1` morre.
3. **Movimento 3 (eventos novos + consumidores)** — 12 `kind` novos e som/ícone por `kind`. SC-002, SC-003, SC-008.

O movimento 1 é o único com risco de asserção reescrita em massa; ele vem primeiro de propósito, para que o barulho apareça isolado.

### D11 — Testes: onde cada requisito é provado

| Camada | Arquivo | O que prova |
|---|---|---|
| Motor — forma | `tests/game/log/logEntry.test.ts` | FR-001..006, FR-014, FR-015. Inclui: `'legacy'` nunca emitida pelo motor; nenhum reducer lê `state.log` (grep-teste); teto de 50; serializável (round-trip JSON idêntico). |
| Motor — cobertura | `tests/game/log/logEntry.test.ts` | FR-007..013, SC-008. Uma partida dirigida por cada família silenciosa, verificando o `kind` emitido. |
| Apresentação | `tests/game/log/describeLog.test.ts` | FR-016..020, FR-022, SC-001, SC-006. Frase por `kind`, identidade com e sem sala, jogador eliminado e jogador fora da sala, entrada legada, moeda única. |
| Ícone | `tests/game/ui/logIcon.test.ts` | FR-021, FR-024, FR-026, SC-002, SC-003. Exaustividade + os 8 padrões hoje inalcançáveis agora alcançados. |
| Som | `tests/game/ui/sound/*` (existentes, ALTERADOS) | FR-023, FR-025, SC-009. Tabela caso a caso contra os cues atuais — **a tabela de hoje é o oráculo**, e é o que impede regressão silenciosa de áudio. |
| Rede | `tests/net/logConverge.test.ts` | SC-007. Log idêntico byte a byte em 3 clientes sobre o `LocalHub`. |
| Estático | busca em `src/` | SC-004. Nenhuma comparação de substring sobre frase de log sobrevive. |

**SC-009 merece nota**: a suíte de som existente hoje afirma cues a partir de **frases**. Ao reescrevê-la para `kind`, é fácil "consertar" um caso mudando a expectativa em vez de preservar o comportamento. A tabela atual de `classifyLogEntry` (`classify.ts:72-83`) precisa ser transcrita **antes** de ser apagada, e a nova suíte conferida contra ela — senão a prova de não-regressão se torna circular.

## Complexity Tracking

Sem violação de constitution a justificar. Três pontos de acompanhamento:

| Tema | Situação | Encaminhamento |
|---|---|---|
| **Volume da fatia** | 14 arquivos do motor tocados, 26 `kind`. É a maior fatia desde a 038 e o risco não é conceitual, é de churn: asserção reescrita em massa esconde regressão. | Mitigado por D10 (3 movimentos, cada um verde) e por SC-005, que limita a reescrita de asserção ao que afirmava o formato antigo. Qualquer outra asserção que precisar mudar é sinal de regra alterada — e regra não muda nesta spec. |
| **Quebra de snapshot** | Sala persistida antes desta fatia não casa com o tipo novo. | Aceito e declarado em D-032. FR-022 + D8 tratam a exibição; não há migração. A sala real é de teste. |
| **Frase divergente entre clientes** | Dois clientes com salas diferentes compõem frases diferentes para o mesmo evento. | **É o desenho, não um defeito** — a convergência exigida é do `GameState` (SC-007), e a frase deixou de fazer parte dele. Vale registrar porque um teste ingênuo de convergência que comparasse texto renderizado falharia por motivo certo e conclusão errada. |
