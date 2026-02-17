# Quickstart — Verificar o Fluxo de Turno

Como confirmar que a máquina de turno cumpre a spec. A verificação primária é por **testes unitários** (Vitest) com RNG injetado — os success criteria já estão escritos como asserções.

## Pré-requisitos (introduzidos por esta feature)

```bash
npm i zustand
npm i -D vitest
```

## Rodar os testes

```bash
npx vitest run tests/game/turn
```

## Mapa Success Criteria → teste

| SC | Verifica | Arquivo / caso |
|---|---|---|
| **SC-001** | ciclo completo passa a vez ao próximo (pula eliminados) | `turnMachine.test.ts › ciclo passa ao próximo` |
| **SC-002** | dupla = +1 rolagem; 3 duplas → prisão sem mover a 3ª | `turnMachine.test.ts › duplas e 3ª-dupla` |
| **SC-003** | Speed Die só após a 1ª volta; 100% das rolagens depois | `dice.test.ts › ativação por volta` |
| **SC-004** | prisão resolve em ≤3 tentativas; 3ª força $50 + move | `jail.test.ts › 3 tentativas` |
| **SC-005** | sem timer: turno ocioso não avança sozinho | `turnMachine.test.ts › finalizar é explícito` |
| **SC-006** | GO no cruze 47→0 credita 1×; ida à prisão não credita GO | `turnMachine.test.ts › gatilho de GO` |
| **SC-007** | `paused` não troca jogador ativo nem ativos; retoma o mesmo turno | `turnMachine.test.ts › pausa preserva turno` |

## Roteiro manual (smoke, quando houver wiring de UI)

> A UI completa (HUD, botões) é de outra spec; este roteiro usa o store direto (devtools/console) sobre um `GameState` semente de 3 jogadores.

1. `rollDice()` com RNG fixo (ex.: 3+4) → token anda 7, estado vira `casa-a-resolver`.
2. `resolvePending()` (handlers stub) → `aguardando-finalizacao`.
3. `finalizeTurn()` → `activeSeat` avança 1.
4. Forçar 2+2 → após resolver, `mayRollAgain = true`; novo `rollDice()` no mesmo jogador.
5. Forçar 3 duplas → jogador vai à Prisão, sem aplicar o 3º movimento, turno encerra.
6. Jogador preso: `jailDecision('try')` sem dupla 3×, na 3ª confirma débito de $50 (porta `onPayToCenter`) e movimento.
7. Posicionar token em `pos=45`, rolar 5 → cruza GO; confirmar 1 chamada a `onPassGo`.
8. `paused = true` → `rollDice()`/`finalizeTurn()` são no-op; `activeSeat` inalterado.

## Critério de pronto (Definition of Done desta fase de design)

- `plan.md`, `research.md`, `data-model.md`, `contracts/turn-machine.md` coerentes entre si e com a spec.
- Toda invariante do `data-model.md` §"Invariantes validáveis" tem um teste correspondente acima.
- Nenhuma mecânica de spec irmã implementada — só orquestração + cantos de prisão (verificável: handlers não-prisão são stubs).
