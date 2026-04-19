# Implementation Plan: Progressão de construção por posse

**Branch**: `main` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/048-progressao-construcao-posse/spec.md`

## Summary

Limitar a progressão parcial de uma cidade ao número de cidades daquele país possuídas pelo jogador: posse 1 libera nível 1, posse 2 libera nível 2 e país completo libera o topo da escada. O motor continuará puro e sem estado novo; um cálculo único de teto será consumido pela elegibilidade do comando e pela projeção da interface, preservando uniformidade, custo, aluguel, venda, hipoteca e compatibilidade com snapshots.

## Technical Context

**Language/Version**: TypeScript 6.0

**Primary Dependencies**: React 19, Zustand, Supabase Realtime; nenhuma dependência nova

**Storage**: `GameState` serializável e snapshots existentes; nenhum campo ou migration nova

**Testing**: Vitest 4, testes públicos de `buildHouse`/`canBuildHouse` e `deedView`, gates Bun

**Target Platform**: Navegadores modernos; partida local e multiplayer host-autoritativa

**Project Type**: Aplicação web multiplayer

**Performance Goals**: Elegibilidade derivada em tempo constante sobre grupos de no máximo três cidades; nenhuma nova renderização ou chamada remota

**Constraints**: Preservar construção parcial, aluguel 50%/75%/100%, uniformidade, escada 0–7 e snapshots acima do novo teto sem mutação retroativa

**Scale/Scope**: Dez países, grupos de duas ou três cidades, até oito jogadores; motor e popover de gestão

## Constitution Check

*GATE inicial e pós-design: aprovado.*

- **I. SRS**: SRS v1.17 e D-050 registram a regra antes da spec e do código.
- **II. Discovery**: o usuário confirmou explicitamente a progressão 1/3 → nível 1, 2/3 → nível 2 e país completo → escada integral; spec 048 está aprovada.
- **III. Tesouro**: não altera cartas.
- **IV. Catch-up discreto**: não introduz rótulo de catch-up; apenas remove o incentivo inverso da construção parcial.
- **V. Sem cooperação obrigatória**: uma cidade ainda permite construir uma casa; fechar o país amplia eficiência e progressão, sem bloquear todo o caminho parcial.
- **VI. Privacidade estratégica**: não altera cartas ou informação privada.
- **VII. Resiliência**: não muda o formato persistido e não rebaixa construções existentes; reconexões continuam compatíveis.

## Project Structure

### Documentation (this feature)

```text
specs/048-progressao-construcao-posse/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── elegibilidade-construcao.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── game/
│   ├── economy/
│   │   └── construction.ts       # teto derivado + elegibilidade e comando
│   └── ui/
│       └── deed/
│           └── deedView.ts       # motivo de bloqueio usa o mesmo teto
└── boards/
    └── shared.tsx                # mensagem curta do novo bloqueio

tests/
└── game/
    ├── economy/
    │   ├── construction.test.ts
    │   └── construcao-avancada.test.ts
    └── ui/
        └── deedView.test.ts
```

**Structure Decision**: manter as funções puras existentes. `construction.ts` será a fonte única do teto; o motor continua responsável por autorizar a mutação, e `deedView` apenas projeta a razão correspondente. Não haverá novo store, estado persistido ou regra paralela na camada React.

## Complexity Tracking

Sem violações constitucionais ou novas camadas que exijam justificativa.
