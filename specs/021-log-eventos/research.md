# Research: Log de eventos real (M2)

Sem NEEDS CLARIFICATION.

## R1 — `LogEntry`/`log` e `logEvent`

**Decisão**: `LogEntry = { who: string; what: string }` (economy/types); `GameState.log: LogEntry[]` (turn/types, seed `[]`). `logEvent(state, who, what)` em `src/game/log.ts`: `state.log.push({who,what}); if (length>50) shift()`. Sem timestamp (motor determinístico — recência = ordem).

**Rationale**: estado mínimo, serializável, bounded. `log.ts` é leaf (importa só os tipos) → sem ciclo; qualquer reducer importa `logEvent`.

## R2 — Pontos de emissão (núcleo do turno)

| Reducer | Evento |
|---|---|
| `rollDice` | `who=ativo`, "rolou a+b(+speed)" |
| `advance` (passou GO) | `who=player`, "passou pelo GO (+$bônus)" (bônus = retorno de `onPassGo`) |
| `buyProperty` | `who=comprador`, "comprou {nome} por ${preço}" |
| `resolveRentable` (aluguel) | `who=pagador`, "pagou ${valor} de aluguel a {dono}" |
| handler `tax` (pago) | `who=jogador`, "pagou ${valor} de imposto" |
| `payDebt` | `who=devedor`, "pagou dívida ${valor}" |
| `declareBankruptcy` | `who=devedor`, "faliu" |
| `cardResolve` (saque) | `who=jogador`, "sacou {Acaso\|Tesouro}" (só o deck — privacidade) |

**Rationale**: cobre o loop principal com info local em cada reducer. Demais eventos (construção/hipoteca/trade/loan/reação) ficam para adições futuras (one-liner).

## R3 — Painel Histórico consome o log

**Decisão**: `PlayersPanel` Histórico = `[...game.log].reverse()` (newest-first), substituindo `MOCK_LOG`; coluna "when" deixa de ser exibida (motor não tem relógio). `who==='Banco'` mantém a cor de sistema (não emitido nesta fatia, mas suportado).

**Rationale**: reuso do componente; só troca a fonte e remove o timestamp.

## R4 — Testes

**Decisão**: `tests/game/log.test.ts` cobre cada emissão (rolar/comprar/aluguel/GO/imposto/dívida/falência/saque) e o bound de 50. UI validada no `bun run dev`.

**Rationale**: o emissor é engine (determinístico/testável); o painel é trivial (mapeia o array).
