# Quickstart — Verificar Sistema de Cartas

Verificação por testes unitários (Vitest), RNG injetável.

## Rodar

```bash
npx vitest run tests/game
```

## Mapa Success Criteria → teste

| SC | Verifica | Arquivo / caso |
|---|---|---|
| **SC-001** | saca do topo; imediata aplica + volta ao fundo; mão vai pra mão | `decks.test.ts` |
| **SC-002** | mão ≤ 3; 4ª de mão força descarte | `hand.test.ts` |
| **SC-003** | privacidade (só contador); Bus Ticket fora do limite | `hand.test.ts` |
| **SC-004** | efeitos autocontidos (caixa/movimento/desconto/ticket/deshipoteca) | `effects.test.ts` |
| **SC-005** | carta deferida → no-op + volta ao fundo | `effects.test.ts` |
| **SC-006** | deck nunca esgota após muitos saques | `decks.test.ts` |
| **SC-007** | "Saia da Prisão" (mão) sai via 002 | `effects.test.ts` |

## Roteiro manual (via store)

1. Parar numa casa Acaso → carta do topo sacada; se imediata (ex.: Boom Econômico) todos +200 e volta ao fundo.
2. Sacar 4 cartas de mão → na 4ª, `resolution.kind === 'card-discard'`; `discardCard(id)` resolve.
3. Conferir que outro jogador "vê" só `hand.length`.
4. Sacar Passagem de Ônibus → `busTickets += 1` (não conta no limite 3).
5. Investidor Anjo → próxima compra com 20% de desconto (003).
6. Sacar uma carta **deferida** (ex.: Boicote) → sem efeito, volta ao fundo (jogo não quebra).

## Definition of Done

- `plan/research/data-model/contracts` coerentes com a spec.
- Toda invariante do `data-model.md` tem teste.
- Suítes 002–005 continuam verdes (integração por composição, sem regressão).
- Efeitos deferidos = no-op seguro; uso de Bus Ticket / negociação fora.
- D-018 propagado (Surpresa→Acaso no SRS §10 + CARTAS.md).
