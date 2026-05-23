# Quickstart — Verificar Balanceamento (GO Progressivo & Free Parking)

Verificação por testes unitários (Vitest), funções puras.

## Rodar

```bash
npx vitest run tests/game
```

## Mapa Success Criteria → teste

| SC | Verifica | Arquivo / caso |
|---|---|---|
| **SC-001** | GO: último +$400, primeiro +$100, meio entre | `balancing.test.ts › goBonus` |
| **SC-002** | imposto debita o jogador e aumenta o pote | `balancing.test.ts › pote/imposto` |
| **SC-003** | multa de $50 da prisão debita e soma ao pote | `tests/game/turn/jail.test.ts` (atualizado) |
| **SC-004** | parar em Férias coleta o pote e reseta a $500 | `balancing.test.ts › Férias` |
| **SC-005** | bônus do GO usa netWorth (caixa + ativos, hipotecada ÷2) | `balancing.test.ts › goBonus + ativos` |

## Roteiro manual (no jogo — `npm run dev`)

1. Passar pelo GO → o caixa do jogador **agora aumenta** (antes: nada). O HUD mostra o caixa subindo.
2. Cair numa casa de imposto → caixa cai; (o pote do centro sobe — visível quando coletado).
3. Parar em **Férias** (canto superior esquerdo, índice 24) → caixa recebe o pote acumulado.
4. Ir preso e **Pagar $50** → caixa cai $50 (antes: não caía).

## Definition of Done

- `goBonus`/pote testados; SC-001…005 verdes.
- Suítes 002–006 verdes **após** ajustar os mocks de porta (jail/efeitos) à nova assinatura `(state, …)`.
- Fora de escopo (Tax Man/Hangar/Skyscraper/2º hotel) não implementado.
- No jogo: passar pelo GO credita; imposto/prisão debitam; Férias coleta o pote.
