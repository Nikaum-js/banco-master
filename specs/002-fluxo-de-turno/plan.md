# Implementation Plan: Fluxo de Turno

**Branch**: `main` (feature dir `002-fluxo-de-turno`) | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-fluxo-de-turno/spec.md`

## Summary

Operacionalizar a **máquina de estados de um turno** (SRS §3, §4, §13.2 + clarificações de 2026-05-23): `rolar → mover → resolver → finalizar`, duplas/re-roll, turno de Prisão, integração do Speed Die no movimento, gatilho de passagem pelo GO e rotação da vez.

Esta é a **primeira feature de lógica de jogo** do projeto — hoje o `src/` é só o protótipo de board (apresentacional). Por isso o plan **funda a camada de estado de runtime**: introduz o store **Zustand** (já previsto no CLAUDE.md §3, ainda não instalado) e modela o turno como **reducers puros + RNG injetável**, mantendo o estado **100% serializável** para sustentar pausa/reconexão (princípio VII, FR-028). A resolução da casa é desenhada como **dispatch por porta**: o turno orquestra *quando* cada tipo de casa é resolvido, mas os mecanismos (compra/leilão, aluguel, cartas, construção, hipoteca) ficam atrás de interfaces a serem preenchidas pelas specs irmãs. Transporte realtime/persistência (Supabase) e os valores de GO Progressivo / Free Parking são **deferidos** às specs de Sessão e Balanceamento — aqui entram como portas.

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19 + Vite 8)

**Primary Dependencies**: React 19, Vite, TailwindCSS v4, `motion` (animação do token), `lucide-react` (ícones de dado). **NOVO:** **Zustand** como store de estado de jogo (CLAUDE.md §3) — esta feature adiciona a dependência. **Supabase** *não* entra aqui: o transporte realtime é responsabilidade da spec de Sessão & Resiliência; o turno é desenhado como estado puro/serializável, *sync-ready*.

**Storage**: Estado de partida em **runtime/Zustand**. Nenhuma persistência nova nesta feature — o estado é serializável para a spec de Sessão consumir (snapshot → Supabase).

**Testing**: **NOVO:** **Vitest** para os reducers puros da máquina de turno (determinístico via RNG injetável). Os critérios de sucesso SC-001…SC-007 viram **testes unitários** (cada um mapeia para um teste). O projeto ainda não tinha framework de teste (001 era visual); a lógica de turno — contador de duplas, prisão, ativação do Speed Die — exige verificação determinística.

**Target Platform**: Web (desktop-first), mesmo alvo do board (001).

**Project Type**: Single-page web app (frontend único). Sem backend nesta feature.

**Performance Goals**: Transição de turno resolve em <16ms (lógica trivial, sem I/O); animação do token a 60fps via `motion`. RNG e reducers são síncronos e puros.

**Constraints**: Estado de turno **100% serializável** (sem closures/refs no estado) — pré-requisito de pausa/reconexão (princípio VII, FR-028). Lógica de turno **sem efeitos colaterais** fora do store (RNG injetado). Resolução de casa por **porta/registry**, sem acoplar a mecânica de cada tipo. UI (botões Rolar/Finalizar, §12.2/12.3) consome comandos da máquina, mas não é o foco deste plan.

**Scale/Scope**: Até 8 jogadores; turno cíclico pulando eliminados. Escopo de código: novo diretório `src/game/turn/` (~4-5 arquivos) + store raiz + wiring mínimo de UI. Sem tocar o board existente além de ler `pos`/`kind`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. SRS é verdade absoluta** | O plan operacionaliza SRS §3/§4/§13.2 e as 4 clarificações registradas na spec; não inventa regra. Onde o SRS é silencioso, segue o que a spec já decidiu. | ✅ |
| **II. Discovery antes de código** | Plan é **design**, não código. Usuário invocou `/speckit-plan` explicitamente (gate cumprido). Implementação só em `/speckit-implement`, com novo OK. | ✅ |
| **III. Tesouro precisa impactar** | Cartas não são desenhadas aqui — o turno só **dispara** o saque (porta). Mecânica/balanço de Tesouro fica na spec de Cartas. | ✅ N/A |
| **IV. Catch-up é discreto** | O turno dispara o bônus do GO via porta que retorna **apenas um valor**; nada de rótulo "catch-up". O cálculo (GO Progressivo) é da spec de Balanceamento. | ✅ |
| **V. Sem dependência obrigatória de cooperação** | A máquina de turno não introduz nenhum gate de cooperação. Ações facultativas (construir/negociar) são opcionais por design (FR-006). | ✅ |
| **VI. Privacidade estratégica de cartas** | O turno trata "descarte por limite de mão" como pendência obrigatória (FR-022) mas **não** expõe conteúdo de cartas; privacidade fica na spec de Cartas. | ✅ |
| **VII. Resiliência de sessão** | **Reforçado pelo design:** estado de turno puro/serializável + reducers determinísticos = snapshot/restore triviais. FR-028 (pausa não troca jogador ativo nem ativos) é invariante do estado. | ✅ |

**Resultado:** sem violações. Sem entradas em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-fluxo-de-turno/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões: FSM, reducers puros, Zustand, Vitest, portas
├── data-model.md        # Fase 1 — entidades de runtime (Turn, Roll, Player slice)
├── quickstart.md        # Fase 1 — como verificar (SC-001..007 → testes)
├── contracts/
│   └── turn-machine.md  # Fase 1 — contrato da FSM (estados/transições/guardas) + portas
├── checklists/
│   └── requirements.md  # Criado pelo /speckit-specify
└── tasks.md             # Fase 2 — criado por /speckit-tasks (NÃO aqui)
```

### Source Code (repository root)

```text
src/
├── game/                       # NOVO — camada de estado de jogo (fundada por esta feature)
│   ├── store.ts                # Zustand: store raiz da partida (turn slice + leitura do player slice)
│   └── turn/
│       ├── types.ts            # Turn, TurnState, Roll, SpeedFace, JailState, TurnOrder
│       ├── turnMachine.ts      # FSM pura: transições/guardas (rollDice, resolve, finalize, jail)
│       ├── dice.ts             # rolagem (2 brancos + Speed Die condicional) — RNG injetável
│       └── resolution.ts       # dispatch de resolução por kind → portas das specs irmãs
└── (board existente: lib/boardData.ts, boards/* — apenas LIDOS p/ pos/kind)

tests/
└── game/turn/
    ├── turnMachine.test.ts     # SC-001/002/005/006 — ciclo, duplas, sem-timer, GO
    ├── dice.test.ts            # SC-003 — ativação do Speed Die; faces; dupla só brancos
    └── jail.test.ts            # SC-004 — turno de prisão (3 tentativas, pagamento forçado)
```

**Structure Decision**: SPA única já existente. A feature **cria** a camada `src/game/` (não havia estado de jogo) e isola a lógica de turno em `turn/` com **fronteira limpa**: `turnMachine.ts`/`dice.ts` são funções puras (testáveis e serializáveis), o `store.ts` é o único ponto com efeito (set state), e `resolution.ts` define **portas** que as specs irmãs (Compra & Aluguel, Cartas, Construção, Balanceamento, Sessão) implementam depois. O board (001) não é alterado — o turno apenas consome `pos`/`kind` de `boardData.ts`.

## Complexity Tracking

> Sem violações de constituição. Seção intencionalmente vazia.
