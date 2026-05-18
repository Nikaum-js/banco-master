# Data Model — Hipoteca (Fase 1)

**Nenhuma entidade nova.** A feature **escreve** estado já existente (003) e deriva valores dos preços (001).

---

## Estado tocado (existente)

| Campo | Origem | Uso aqui |
|---|---|---|
| `Title.mortgaged` | 003 | **escrito** por mortgage/unmortgage (liga/desliga) |
| `Title.ownerId` | 003 | lido (só o dono hipoteca) |
| `Title.houses` / `Title.hotel` | 004 | lido (bloqueio do §6.1) |
| `Player.cash` | 003 | creditado (hipotecar) / debitado (deshipotecar, taxa) |
| `square.price` | 001 | base do valor da hipoteca |

## Valores derivados (puros)

| Valor | Fórmula | Origem |
|---|---|---|
| Valor da hipoteca | `round(price / 2)` | §6.1 |
| Custo de deshipotecar | `round(valorHipoteca × 1,10)` | §6.2 + clarif. |
| Taxa de manter (transferência) | `round(valorHipoteca × 0,10)` | §6.3 + clarif. |

---

## Invariantes validáveis (viram testes)

1. Hipotecar: só dono, não-hipotecada, **sem construção no grupo**; credita `valorHipoteca`; seta `mortgaged = true`.
2. Deshipotecar: só dono, hipotecada, `cash ≥ custo`; debita `valorHipoteca × 1,10`; seta `mortgaged = false`.
3. Operação inválida → no-op (estado idêntico por referência).
4. Hipotecada não cobra aluguel (003) e bloqueia construir no grupo (004) — sem regressão.
5. `transferKeepFee` = `valorHipoteca × 0,10`; `unmortgageCost` = `valorHipoteca × 1,10` (helpers puros).
6. Estado permanece serializável (sem novos campos).
