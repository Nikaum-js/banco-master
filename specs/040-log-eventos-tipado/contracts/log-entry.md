# Contrato: evento de log e descritor

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Modelo**: [../data-model.md](../data-model.md)

Contratos das três superfícies que esta fatia cria ou reforma: o **emissor** (`logEvent`), o **descritor** (`describeLogEntry`) e os **classificadores** (`classifyLogEntry`, `logIcon`).

---

## 1. `logEvent(state, entry)`

```ts
function logEvent(state: GameState, entry: LogEntry): void
```

**Antes:** `logEvent(state, who: string, what: string)`.

### Comportamento

1. Empilha `entry` no fim de `state.log`.
2. Se `state.log.length > 50`, remove a primeira (`shift`).
3. Não devolve nada — **muta o rascunho já clonado**, como hoje. Os reducers chamam `logEvent(s, …)` depois do `structuredClone`, nunca sobre o estado de entrada.

### Pré-condições (do chamador)

- `state` é um clone de trabalho, não o estado recebido pelo reducer.
- `entry.kind` ≠ `'legacy'` — nenhum reducer emite a variante de compatibilidade (invariante 9 do modelo; teste fixa).
- Todo campo obrigatório do `kind` está presente. O TS garante isso pela união; o teste garante contra `strict` desligado.

### Pós-condições

- `state.log.length ≤ 50`.
- `state.log` continua serializável (round-trip JSON idêntico).
- **Nada mais de `state` foi tocado.** `logEvent` não altera caixa, título, resolução ou vez — é a última linha do reducer e não influencia decisão nenhuma (FR-006).

### Não-objetivos

- Não deduplica: dois eventos idênticos em valor produzem duas entradas (é o que `countNewLogEntries` espera).
- Não ordena: a ordem de chamada **é** a ordem do log.
- Não valida regra: um evento incoerente com o estado é problema do chamador, não do emissor.

### Assinaturas descartadas

| Forma | Por que não |
|---|---|
| `logEvent(state, kind, who, fields)` | Separar `kind` dos campos impede o TS de correlacionar os dois — e o erro que mais interessa pegar (campo do `kind` errado) passaria batido. |
| `logEvent(entry): (state) => GameState` | Currying não paga nada aqui: o chamador sempre tem o `state` em mão. |
| `state.log.push(entry)` direto, sem helper | Perderia o teto de 50 em 25 pontos de emissão. |

---

## 2. `describeLogEntry(entry, room)`

```ts
function describeLogEntry(entry: LogEntry, room: Room | null): LogSentence
```

**Novo.** Vive em `src/game/ui/log/describeLog.ts` — camada de apresentação, fora do motor.

### Comportamento

Total sobre `LogKind`: `switch (entry.kind)` com um ramo por variante e `assertNever` no `default`. Devolve a frase como **lista de fragmentos tipados** (`LogSentence`), não string.

Resolve toda referência a jogador (`who`, `ownerId`, `winnerId`, `fromId`, `toId`, `creditorId`) via `identityOf(room, id)`, e todo valor monetário via `money(n)` — as duas únicas fontes.

### Pré-condições

Nenhuma além dos tipos. `entry` pode ser qualquer variante, inclusive `'legacy'`. `room` pode ser `null`.

### Pós-condições

- **Nenhum fragmento contém id de jogador** (FR-018, SC-001). Verificável inspecionando a estrutura devolvida, sem renderizar React — é o que torna SC-001 um teste e não uma inspeção visual.
- Autor `'bank'` produz fragmento de texto `"Banco"`, nunca `{ t: 'player' }` — o banco não tem assento na sala.
- `room: null` produz nomes de fallback (`Jogador 1`), nunca id (delega ao `fallbackIdentity` da 038).
- `kind: 'legacy'` produz exatamente `[{ t: 'text', text: entry.what }]` — texto solto, sem resolução e sem ícone (FR-022).
- **Pura**: mesma entrada, mesma saída. Sem `Date.now()`, sem leitura de store, sem hook.

### Não-objetivos

- Não decide cor de linha nem ícone: cor vem da `PlayerIdentity` no fragmento, ícone vem de `logIcon(kind)`. Três responsabilidades, três funções.
- Não trunca nem abrevia: limite de tamanho é decisão de layout, e o layout é do `CenterLog`.
- Não traduz: a frase é pt-BR literal. i18n está fora (D9 do plan) — mas fica **possível**, porque a frase agora nasce num só arquivo.

### Por que `LogSentence` e não `string`

Registrado em D3 do plan e 4.4 do research. Em uma linha: a UI precisa colorir o dinheiro e negritar nomes, e string a obrigaria a re-parsear a frase com regex — o mesmo acoplamento por texto que esta spec elimina, um andar acima.

### Por que `room` é parâmetro e não hook

Pureza e testabilidade em Node (4.5 do research). Quem tem o hook é o `CenterLog`, que passa a sala adiante.

---

## 3. `classifyLogEntry(entry)` e `logKey(entry)`

```ts
function classifyLogEntry(entry: LogEntry): SoundCue | null
function logKey(entry: LogEntry): string
```

**Reformadas** (`src/game/ui/sound/classify.ts`, spec 035).

### `classifyLogEntry`

- Ramifica por `entry.kind`, **nunca** inspeciona texto (FR-023, SC-004).
- Total sobre `LogKind` com `assertNever` no `default`.
- `null` continua sendo resposta legítima — eventos já cobertos por canais tipados (compra, rolagem, dívida) devolvem `null` para não tocar duas vezes (FR-007 da 035, preservado).
- **`card-draw` devolve cue genérico**, sem ramificar por deck nem por carta (FR-015, princípio VI). O tipo não tem o campo, então isso deixa de ser disciplina e passa a ser impossível.

**Obrigação de não-regressão (SC-009):** a tabela atual (`classify.ts:72-83`) é o **oráculo**. Cada par (evento, cue) que ela produz hoje precisa continuar produzindo o mesmo cue depois. A tabela é transcrita para o teste **antes** de o código ser apagado — senão a prova vira circular (risco 1 do research).

| Frase de hoje | Cue | `kind` correspondente |
|---|---|---|
| `startsWith('comprou ')` | `buy` | `buy` |
| `includes('de imposto')` | `tax-paid` | `tax` |
| `includes('de aluguel a')` | `rent-paid` | `rent` |
| `includes('pelo GO') \|\| includes('no GO')` | `go-bonus` | `go` |
| `includes('juros')` | `loan-interest` | `loan-interest`, `loan-interest-short` |
| `includes('Bus Ticket')` | `busticket-gain` | `bus-ticket-gain` |
| `=== 'faliu'` | `bankruptcy` | `bankruptcy` |
| `startsWith('sacou ')` | `card-draw` | `card-draw` |
| resto | `null` | `roll`, `card-immediate`, `debt-paid`, `trade` |

Nota sobre `includes('juros')`: a frase de `loan-interest-short` ("não cobriu os **juros** de …") também casa hoje, então **os dois `kind` de juros mapeiam para `loan-interest`**. Preservar isso é preservar comportamento; mudar é decisão nova e fica fora.

Os 12 `kind` novos ganham cue **decidido nesta fatia** — inclusive a decisão explícita de `null` onde não há som apropriado. `null` por decisão é diferente de `null` por esquecimento, e é o teste de exaustividade que separa os dois.

### `logKey`

- Deriva da concatenação dos campos **em ordem fixa por `kind`** (D7 do plan).
- **`JSON.stringify(entry)` não serve**: a ordem das chaves depende da ordem de construção do objeto, e `structuredClone` no meio do caminho não garante nada. Chave instável quebraria `countNewLogEntries` de forma intermitente — o pior modo de falha possível para áudio.
- É chave de **valor**, não identidade: duas entradas idênticas em valor produzem a mesma chave, e `countNewLogEntries` as distingue por posição (comportamento preservado da 035).
- Barata: roda sobre 50 entradas a cada mudança de estado.

---

## 4. `logIcon(kind)`

```ts
function logIcon(kind: LogKind): IconKind
```

**Novo** (`src/game/ui/log/logIcon.ts`), substitui `logEventIcon(what)` (`shared.tsx:1515`).

- Recebe `kind`, não a entrada inteira: o ícone nunca depende de campo (nem de valor, nem de posição).
- **Total, sem `null` por omissão** (FR-021): todo `kind` tem ícone decidido. `'legacy'` é a única variante sem ícone, e por decisão explícita.
- Ramifica por `switch` com `assertNever`; a exaustividade é cobrada também por teste (FR-026).

**Sai de `shared.tsx` por motivo de lint, não de estética:** `logIcon` não é componente, e a sessão de 2026-07-25 gastou trabalho zerando exatamente os avisos de `react-refresh` que exportar não-componente de arquivo de componente produz (foi de onde nasceram `groupColors.ts`, `deedRents.ts`, `tradeUI.ts`, `handCardUI.ts`). Reintroduzir o padrão custaria o lint zerado.

### O que este contrato conserta

Os 8 padrões inalcançáveis de `logEventIcon` (`constru|hangar|hotel|arranha|vendeu`, `hipotec`, `leil`, `pote`, `fian`) deixam de ser regex sobre texto e passam a ser ramos sobre `kind` que **só existem porque o `kind` existe** (SC-002). Um ícone previsto para um evento inexistente deixa de ser possível: sem `kind`, não há ramo para escrever.

---

## 5. Desvios deste contrato

Como na 039 — se a implementação divergir de algo acima, o desvio é registrado **aqui** e no `tasks.md`, com o motivo. Contrato que a implementação contradiz em silêncio é pior que contrato nenhum.

*(nenhum desvio registrado ainda — a implementação não começou)*
