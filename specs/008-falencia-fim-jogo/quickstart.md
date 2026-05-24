# Quickstart — Verificar Falência & Fim de jogo

Verificação por testes unitários (Vitest), funções puras.

## Rodar

```bash
npx vitest run tests/game
```

## Mapa Success Criteria → teste

| SC | Verifica | Arquivo / caso |
|---|---|---|
| **SC-001** | `isBankrupt` (liquidação < dívida) → eliminado; quem cobre liquidando não fale | `falencia.test.ts › insolvência` |
| **SC-002** | falência devendo a jogador → props+caixa ao credor; devendo ao banco → props ao banco | `falencia.test.ts › destino dos ativos` |
| **SC-003** | turno pula o eliminado (sem regressão 002) | `falencia.test.ts › eliminação` |
| **SC-004** | 1 não-eliminado → `phase='ended'` (vencedor); ≥2 → continua | `falencia.test.ts › fim de jogo` |

## Roteiro manual (no jogo — `npm run dev`)

1. Cair numa propriedade cara de outro sem caixa → HUD mostra **dívida** (Pagar / Falir) e o turno trava.
2. Vender construção / hipotecar (comandos) pra levantar caixa → **Pagar**; ou **Falir**.
3. Ao falir devendo a um jogador → as propriedades e o caixa vão pra ele; o falido some do tabuleiro.
4. Eliminar todos menos um → tela de **fim de jogo** com o vencedor.

## Definition of Done

- `liquidationValue`/`payDebt`/`declareBankruptcy`/`checkEndGame` testados; SC-001…004 verdes.
- Suítes 002–007 verdes (aluguel/imposto sem caixa agora abrem dívida — ajustar testes que assumiam débito direto/`onInsolvency`).
- HUD com dívida (Pagar/Falir) + fim de jogo.
- Fora de escopo (§9.3 empréstimo, imunidades, leilão-em-cascata) não implementado.
