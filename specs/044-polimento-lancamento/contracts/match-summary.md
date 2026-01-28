# Contrato — `matchSummary(game)`

**Spec**: [../spec.md](../spec.md) · **Modelo**: [../data-model.md](../data-model.md) · **ADR**: [D-038](../../../docs/adr/D-038-fim-de-jogo-tem-classificacao-e-resumo.md)

Arquivo: `src/game/summary.ts`. Função **pura**: mesmo `GameState` → mesmo resultado, em qualquer tela, em qualquer momento, sem relógio e sem rede.

---

## Assinatura

```ts
export function matchSummary(game: GameState): MatchSummary
```

Tipos em [`data-model.md §2`](../data-model.md).

## Garantias

| # | Garantia | Por quê |
|---|---|---|
| G1 | **Determinística e pura** — sem `Date.now()`, sem `Math.random()`, sem leitura de store | é o que faz a classificação ser idêntica em 8 telas (SC-004) |
| G2 | `standings.length === players.length` | ninguém some do resumo, nem quem faliu primeiro |
| G3 | `standings[0].rank === 1` e os ranks são `1..n` sem buraco nem repetição | não há empate a representar (D-038) |
| G4 | Chamada com `phase !== 'ended'` devolve `winnerId: null` e a classificação parcial do momento | a tela de fim de jogo não é o único consumidor possível; a função não decide fase |
| G5 | `durationMs === null` quando `startedAt === 0` ou `endedAt === null` | duração ausente é dita, não estimada |
| G6 | `partial === true` quando existe eliminado sem registro em `eliminationOrder` | snapshot antigo não vira posição inventada (FR-009) |
| G7 | Não altera `game` | nenhuma mutação, nem em array aninhado — `eliminationOrder` é copiado antes de inverter |

## Casos de borda

| Caso | Resultado |
|---|---|
| Mesa de 2, um fali | `winnerId` = o outro; duas linhas |
| Partida ainda em curso | `winnerId: null`; linhas dos já eliminados com rank do fim para trás; vivos sem rank afirmado |
| Nenhum eliminado (fim impossível, estado inconsistente) | `winnerId: null`, `partial: true` — a função não lança |
| Todos eliminados (estado inconsistente) | `winnerId: null`; classificação pela ordem registrada; `partial: false` |
| `eliminationOrder` com id que não existe em `players` | a linha é ignorada e `partial: true` — nunca lançar dentro de um caminho de render (a lição da 040/042) |

> **A função nunca lança.** Ela é chamada durante o render da tela de fim de jogo; uma exceção ali cairia na `MatchErrorBoundary` e trocaria o encerramento da partida por uma tela de falha. Estado inconsistente vira `partial: true`, não exceção.

## Testes obrigatórios (`tests/game/summary.test.ts`)

1. Ordem inversa de eliminação em mesa de 2, 3 e 6 jogadores.
2. `netWorth` e `properties` do vencedor conferem com o estado final.
3. `eliminatedAtRound` bate com a rodada registrada na queda.
4. `durationMs` é `null` com `startedAt: 0`; é `endedAt - startedAt` com os dois presentes.
5. Snapshot sem os campos novos (após `normalizeGame`) → `partial: true`, sem exceção, sem posição inventada.
6. Pureza: `structuredClone` do estado antes e depois é idêntico.
7. Id órfão em `eliminationOrder` → ignorado, `partial: true`, sem exceção.
