# Data Model: Log de eventos tipado

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Este documento fixa o delta em `GameState` — que é **um só campo**, `log`, cujo tipo de elemento muda de `{ who, what }` para uma união discriminada. Nenhum outro campo do estado é tocado; nenhuma entidade nova é persistida.

---

## O delta em `GameState`

```diff
 export interface GameState {
   …
-  log: LogEntry[]   // { who, what } — prosa em português, ids interpolados
+  log: LogEntry[]   // união discriminada por `kind` — fatos, sem prosa
   …
 }
```

`log` continua sendo array, continua **bounded em 50** com `shift` no teto, e continua ordenado por recência (mais recentes ao fim). Sem timestamp: o motor é determinístico, então a ordem **é** a recência (invariante da spec 021, preservada).

---

## O tipo

### `LogKind` deriva da lista, não o contrário

```ts
export const ALL_LOG_KINDS = [
  'roll', 'go', 'buy', 'rent', 'tax', 'bus-ticket-gain',
  'card-draw', 'card-immediate',
  'build', 'build-hangar', 'sell-building', 'sell-hangar',
  'mortgage', 'unmortgage',
  'auction-won', 'auction-unsold', 'lot-won', 'lot-unsold',
  'free-parking', 'jail-fine',
  'debt-paid', 'bankruptcy', 'trade',
  'loan-interest', 'loan-interest-short',
  'legacy',
] as const

export type LogKind = (typeof ALL_LOG_KINDS)[number]
```

A **lista é a fonte**, e o tipo deriva dela (D6 do plan). O motivo é o teste de exaustividade (FR-026): ele itera sobre `ALL_LOG_KINDS` em runtime, e se a lista fosse escrita à mão ao lado da união, uma lista desatualizada faria o teste passar verde exatamente quando deveria falhar.

**26 `kind`**: 13 preservados (FR-014), 12 novos (FR-007..013) e `'legacy'` (FR-022, nunca emitido pelo motor).

### O autor: `who`

Todas as variantes têm `who: string`, que é o **id** do jogador (`'p1'`…`'p8'`) ou o literal **`'bank'`**.

`'bank'` substitui a string `'Banco'` usada hoje. Rótulo em português dentro do estado é justamente o que esta spec remove de lá; a palavra "Banco" passa a ser escolha do descritor. Isso muda a comparação de `CenterLog` (`l.who === 'Banco'`, `shared.tsx:1583`) e é quebra de snapshot já coberta por FR-022.

`who` é o **autor do fato**, não o beneficiário. Em `rent`, `who` é quem **pagou** e `ownerId` é quem recebeu — a assimetria é deliberada e é o que permite a frase ter sujeito.

---

## As variantes, uma por uma

### Preservadas (FR-014) — 13 `kind`

| `kind` | Campos | Origem hoje | Nota |
|---|---|---|---|
| `roll` | `white: [number, number]`, `isDouble: boolean`, `special: 'onibus' \| null`, `speed: number \| null`, `attempt: boolean` | `turnMachine.ts:165` e `:331` | Os dois pontos emitem o mesmo `kind`; `attempt: true` marca a tentativa de saída da prisão (`:331`), que hoje se distingue só por comentário. `special`/`speed` existem porque `cueForRoll` já ramifica sobre eles (FR-023 sem perda). |
| `go` | `amount: number`, `landed: boolean` | `turnMachine.ts:57` | `landed` substitui a escolha de frase entre "parou no GO" e "passou pelo GO". |
| `buy` | `pos: number`, `price: number` | `purchase.ts:44` | O nome da casa sai da string: `pos` → `BOARD[pos].name` na apresentação. |
| `rent` | `pos: number`, `amount: number`, `ownerId: string` | `resolveRentable.ts:36` | **O `ownerId` sai de dentro da frase** — é um dos três vazamentos de id (defeito 2). Não ganha `base`/`multiplicador` nesta fatia (D9 do plan). |
| `tax` | `amount: number` | `resolution.ts:74` | |
| `bus-ticket-gain` | — | `resolution.ts:61` | Sem campo: o fato é "ganhou uma passagem", sempre +1 (§2.7). |
| `card-draw` | `deck: DeckId` | `draw.ts:39` | **Genérico por construção** (FR-015): não há campo de carta nem de raridade. O que hoje é disciplina de quem escreve a frase passa a ser garantia do tipo (princípio VI). |
| `card-immediate` | `deck: DeckId`, `name: string`, `delta: number` | `draw.ts:51` e `:60` | Carta imediata é **pública** (§12.2), então o nome pode entrar. `delta` é a variação de caixa que `describeImmediate` hoje recebe. Os dois pontos convergem no mesmo `kind` — `:51` (Atalho, antes da escolha) emite `delta: 0`. |
| `debt-paid` | `amount: number` | `falencia.ts:58` | |
| `bankruptcy` | — | `falencia.ts:112` | |
| `trade` | `fromId: string`, `toId: string` | `trade.ts:181` | **Os dois ids saem da frase** (`${trade.fromId} ↔ ${trade.toId}`) — segundo vazamento. `who` = `fromId` (o proponente é o autor). |
| `loan-interest` | `amount: number`, `creditorId: string` | `emprestimos.ts:153` | **Terceiro vazamento** (`a ${loan.creditorId}`). É também o ponto do `R$` — que se revelou a convenção **certa** (D4 do plan). |
| `loan-interest-short` | `amount: number`, `creditorId: string`, `shortfall: number` | `emprestimos.ts:161` | `amount` = o que foi pago (o caixa inteiro do devedor); `shortfall` = o que virou dívida. Dois números distintos que a frase de hoje mistura. |

### Novas (FR-007..013) — 12 `kind`

| `kind` | Campos | Onde emitir | Nota |
|---|---|---|---|
| `build` | `pos: number`, `level: number`, `cost: number` | `construction.ts` `buildHouse` (após o `switch` do ladder) | **Um `kind` para os 4 degraus** (casa/hotel/2º hotel/arranha-céu), discriminados por `level` 1–7 (D5 do plan). `level` é o nível **resultante** (`cityLevel` após a construção), não o anterior — é o que a frase precisa. |
| `build-hangar` | `pos: number`, `cost: number` | `construction.ts` `buildHangar` | Separado de `build` porque hangar é melhoria de **aeroporto**, não degrau do ladder de cidade (§13.6). |
| `sell-building` | `pos: number`, `level: number`, `amount: number` | `construction.ts` `sellBuilding` | `level` = nível resultante (após a venda), mesma convenção de `build`. |
| `sell-hangar` | `pos: number`, `amount: number` | `construction.ts` `sellHangar` | |
| `mortgage` | `pos: number`, `amount: number` | `mortgage.ts` `mortgageProperty` | `amount` = `mortgageValue` (o que entrou no caixa). |
| `unmortgage` | `pos: number`, `cost: number` | `mortgage.ts` `unmortgageProperty` | `cost` = `unmortgageCost` (metade × 1,10). Campo chamado `cost`, não `amount`, porque **sai** do caixa — a assimetria de nome é intencional e ajuda a frase. |
| `auction-won` | `pos: number`, `amount: number`, `winnerId: string` | `auction.ts` `closeAuction` (ramo `highBidder`) | `who` = `'bank'` (o banco fecha o leilão), `winnerId` = quem arrematou. Autor e beneficiário são pessoas diferentes aqui — é o caso que justifica a separação. |
| `auction-unsold` | `pos: number` | `auction.ts` `closeAuction` (sem `highBidder`) | `who` = `'bank'`. |
| `lot-won` | `pos: number`, `amount: number`, `winnerId: string`, `origin: AuctionOrigin` | `landAuction.ts` `settleLot` (ramo com vencedor válido) | `origin` vem da 039 (`'scarcity' \| 'bankruptcy' \| 'mixed'`) e permite a frase distinguir pregão de escassez de espólio, sem consultar `state.landAuction` (que pode já ter sido esvaziado). |
| `lot-unsold` | `pos: number`, `origin: AuctionOrigin` | `landAuction.ts` `settleLot` (sem vencedor **ou** vencedor eliminado) | **Cobre os dois caminhos de "fica livre"**: sem lance, e líder eliminado antes do fecho (`landAuction.ts:161`). O segundo é invisível hoje e é exatamente o tipo de evento que merece log. |
| `free-parking` | `amount: number` | `balancing.ts` `collectCenter` | **Princípio IV:** carrega o valor e nada mais — nenhum campo que sugira catch-up, nenhum rótulo. A frase relata o recebimento como qualquer outro. |
| `jail-fine` | `amount: number` | `turnMachine.ts:316` (`jailDecision('pay')`) e `:344` (3ª tentativa) | **Mesmo `kind` nos dois pontos** (D5 do plan): voluntário e forçado são o mesmo fato para som, ícone e frase. Em `:344` o valor é `Math.min(JAIL_FINE, cash)`, que pode ser menor que $50 — daí `amount` ser campo, não constante. |

### Compatibilidade (FR-022) — 1 `kind`

| `kind` | Campos | Nota |
|---|---|---|
| `legacy` | `what: string` | **Nunca emitida por reducer** (teste fixa isso). Existe só para receber entrada de snapshot anterior a esta fatia. A normalização acontece no **carregamento** do snapshot, não em cada consumidor — assim os três tratam `'legacy'` por exaustividade em vez de cada um ter um `if (!e.kind)` na frente (D8 do plan). Renderiza como texto solto, sem ícone e sem resolução de nome. |

---

## Entidades de apresentação (não persistidas)

Vivem em `src/game/ui/log/` e **não** fazem parte do `GameState`.

### `LogSentence` — a frase como estrutura

```ts
export type LogFragment =
  | { t: 'text'; text: string }
  | { t: 'money'; amount: number }
  | { t: 'player'; identity: PlayerIdentity }
  | { t: 'place'; pos: number }

export type LogSentence = LogFragment[]
```

Não é string (D3 do plan). A UI já colore dinheiro (`LogWhat`, `shared.tsx:1505`) e precisa negritar nomes com a cor do jogador; devolver string obrigaria a re-parsear a frase com regex para achar o dinheiro — o mesmo pecado que a spec elimina, um andar acima.

`{ t: 'player' }` carrega a `PlayerIdentity` **já resolvida** (nome + cor + peça), não o id: quem resolve é `describeLogEntry`, que recebeu a `Room`. É isso que faz FR-018 (zero id na tela) verificável por inspeção da estrutura, sem renderizar React.

### `describeLogEntry(entry, room) → LogSentence`

Pura. `room: Room | null` — sem sala, cai no `fallbackIdentity` da 038 (`Jogador N`), nunca no id.

### `logIcon(kind) → IconKind`

Pura, total sobre `LogKind`. Substitui `logEventIcon(what)` (`shared.tsx:1515`), cujos 8 padrões inalcançáveis são o defeito 1.

---

## Invariantes

Aplicam-se ao log depois desta fatia. As três primeiras são herdadas da spec 021 e **não mudam**; as demais são novas.

1. **Bounded**: `log.length ≤ 50`; ao exceder, a mais antiga sai (`shift`).
2. **Append-only**: entrada nunca é editada nem reordenada depois de emitida.
3. **Recência = ordem**: sem timestamp; a última posição é o evento mais recente.
4. **Serializável**: round-trip `JSON.parse(JSON.stringify(log))` é idêntico. Só literais, números, booleanos e arrays de números — nenhuma `Date`, nenhum `undefined` em campo obrigatório.
5. **Saída, nunca entrada** (FR-006): nenhum reducer lê `state.log` para decidir. O log não é event bus de regra.
6. **Sem prosa** (FR-002): nenhum campo contém frase formatada — exceto `legacy.what`, que é dado velho, não emissão.
7. **Sem id em texto** (FR-003): referência a jogador é sempre campo próprio (`who`, `ownerId`, `winnerId`, `fromId`, `toId`, `creditorId`).
8. **Convergência** (SC-007): o log é idêntico byte a byte entre clientes. A **frase** não é — ela depende da sala de cada cliente, e isso é o desenho, não um defeito (Complexity Tracking do plan).
9. **`legacy` não é emitida**: nenhum caminho do motor produz `kind: 'legacy'`.
10. **Privacidade de saque** (FR-015, princípio VI): `card-draw` não tem campo de carta nem de raridade. `card-immediate` tem `name` porque carta imediata é pública (§12.2).
