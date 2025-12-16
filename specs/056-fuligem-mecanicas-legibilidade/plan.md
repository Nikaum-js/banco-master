# Implementation Plan: Fuligem — mecânicas próprias e legibilidade

**Branch**: `main` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

## Summary

Finalizar a mudança iniciada da Fuligem para 40 casas, retirando toda renda direta de Minas,
removendo as zonas do miolo, usando a área extra do anel para nomes completos e criando uma
variante transparente do `Overlay` somente para o leilão. A implementação mantém Atlas,
gatilhos do leilão, autoridade multiplayer e acessibilidade modal intactos.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19

**Primary Dependencies**: Vite, Zustand, Motion, Tailwind, Supabase

**Storage**: estado autoritativo já existente; nenhuma migration nova

**Testing**: Vitest, Testing Library, Playwright, lint e typecheck do Bun

**Target Platform**: navegador desktop/tablet/celular em paisagem

**Project Type**: aplicação web multiplayer

**Performance Goals**: nenhuma animação ou custo contínuo novo; mudança puramente geométrica

**Constraints**: preservar WCAG 2.2 AA no caminho de jogo; Atlas e demais modais sem mudança

**Scale/Scope**: motor econômico, apresentação de escritura, tabuleiro e modal de leilão

## Constitution Check

- **I — SRS absoluto:** passou. D-070/D-071/D-072 e SRS v1.32 antecedem a implementação vigente.
- **II — Discovery antes de código:** passou para as mudanças novas; a spec 056 está
  aprovada pelo brief explícito.
- **III — Tesouro impactante:** não afetado.
- **IV — Catch-up discreto:** preservado; a D-072 removeu a Taxa de Fumaça sem criar
  substituto ou destacar mecanismos de catch-up.
- **V — Sem cooperação obrigatória:** preservado.
- **VI — Privacidade de cartas:** não afetado; o leilão só revela saldos que já são públicos.
- **VII — Resiliência de sessão:** não há estado persistido novo.

Rechecagem pós-design: passou, sem exceções.

## Decisões de design

### D1 — Mina continua rentável apenas no sentido de aquisição

`isRentableKind` continua incluindo `mine`, pois o resolver usa essa categoria também para
abrir compra/leilão. Depois de descobrir o dono, `economyResolve` encerra imediatamente para
Mina ocupada. `rentDue` também retorna zero por defesa e para consumidores de resumo/cartas.
`MINE_RENT` e `rentMine` deixam de existir.

### D2 — Escritura de Mina tem somente bônus e fatos do título

`MineDeedPresentation` perde `rents` e usa `rentRows: []` pelo contrato comum. O popover
remove a tabela e diz explicitamente que a Mina não cobra aluguel, não recebe construções e
perde o bônus hipotecada.

### D3 — A geometria cresce só na Fuligem

`FULIGEM_TRACK_TEMPLATE` aumenta o peso das faixas de canto/perímetro; `CLASSIC_TOPOLOGY`
permanece byte-idêntica. No anel Fuligem, propriedades, Ferrovias, Minas e Bilhete usam
`square.name`, permitem quebra de linha e recebem ajuste tipográfico por classe do mapa.
Não se altera o nome curto usado em outras superfícies.

### D4 — Zonas deixam o modelo e a renderização

`MapZones`, `catalog.zones`, `BoardZones` e `.board-zones*` são removidos. Não fica estrutura
inativa capaz de reintroduzir as linhas ou textos.

### D5 — Overlay preserva semântica e troca apenas o véu

`Overlay` recebe `veil="default" | "clear"`. `clear` mantém `fixed inset-0`, foco, trap,
`aria-modal` e bloqueio de ponteiro, mas usa fundo transparente e não aplica backdrop blur.
Somente `view.kind === 'auction'` seleciona `clear`.

## Project Structure

```text
src/
├── boards/
│   ├── Board01Classic.tsx
│   ├── shared.tsx
│   └── topology.ts
├── game/
│   ├── economy/{rent,resolveRentable}.ts
│   ├── ui/deed/presentation.ts
│   ├── ui/modals/ModalLayer.tsx
│   └── ui/shell.tsx
├── lib/{fuligemBoard,mapCatalog}.ts
└── index.css

tests/
├── game/fuligem/minas.test.ts
├── ui/
└── boards/
```

**Structure Decision**: aprofundar os módulos existentes; nenhum componente, store ou
serviço paralelo é criado.

## Verification

1. Testes focados de Minas, topologia, deed e overlay.
2. `bun run lint`, `bun run typecheck`, suíte Vitest e `bun run build`.
3. Playwright local em Fuligem com screenshot do tabuleiro e do leilão.
4. Revisão do diff, micro-commits, push e monitoramento dos workflows associados ao SHA.
