# Implementation Plan: Propostas de negociação simultâneas

**Branch**: `047-propostas-simultaneas` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/047-propostas-simultaneas/spec.md`

## Summary

Trocar a proposta global por uma coleção pública de envelopes identificados, preservada no snapshot e endereçada por id nos comandos. O motor continuará validando a troca no envio e novamente na aceitação, sem reservar ativos. A UI passará a selecionar uma proposta pelo id: o painel renderiza somente as rotas em uma lista de altura limitada, o modal oferece decisão apenas ao destinatário e o compositor abre independentemente das propostas já ativas.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19

**Primary Dependencies**: React, Zustand, Motion, Supabase Realtime/Postgres

**Storage**: `GameState` serializado em snapshots; normalização aditiva de snapshots legados

**Testing**: Vitest 4, Testing Library, simulador determinístico e gates do Bun

**Target Platform**: Navegadores modernos; partida multiplayer online host-autoritativa

**Project Type**: Aplicação web multiplayer

**Performance Goals**: Listagem linear de propostas; somente a região de propostas rola; sem prévia de composição no painel

**Constraints**: Sem reserva de ativos; ids determinísticos; autoridade derivada da proposta identificada; turno não bloqueado; compatibilidade com `pendingTrade` legado

**Scale/Scope**: Até 8 jogadores, múltiplas propostas simultâneas e snapshots completos da partida

## Constitution Check

*GATE inicial e pós-design: aprovado.*

- **I. SRS**: SRS 1.15 e D-048 registram a regra antes do código.
- **II. Discovery**: a spec 047 está aprovada pela solicitação explícita de liberar múltiplas propostas e redesenhar a lista.
- **III–VI**: não altera Tesouro, catch-up, cooperação obrigatória ou privacidade de cartas.
- **VII. Resiliência**: propostas e próximo id vivem no snapshot; normalização cobre `pendingTrade` legado.
- **Autoridade multiplayer**: `actorOf` resolve aceitar/recusar pelo id e `LocalView` consulta a mesma função.

## Project Structure

### Documentation (this feature)

```text
specs/047-propostas-simultaneas/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── trade-proposals.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── boards/shared.tsx                  # lista compacta e CTA sempre disponível
├── game/
│   ├── commands.ts                    # ids nos comandos e autoridade por proposta
│   ├── economy/
│   │   ├── types.ts                   # TradeProposal
│   │   └── trade.ts                   # coleção e reducers identificados
│   ├── falencia/falencia.ts           # limpeza de propostas do eliminado
│   ├── setup.ts                       # seed da coleção/contador
│   ├── turn/types.ts                  # estado persistente
│   └── ui/
│       ├── lab/cases.ts               # casos visuais
│       └── trade/
│           ├── TradeLayer.tsx         # detalhe selecionado + compositor independente
│           └── tradeUI.ts             # selectedProposalId
└── net/
    ├── localView.ts                   # ação completa e turno não bloqueado
    └── supabaseTransport.ts           # migração do snapshot legado

tests/
├── game/economy/negociacao-ui.test.ts
├── net/localView.test.ts
├── sim/engine/
└── ui/tradePresentation.test.tsx
```

**Structure Decision**: manter o agregado no `GameState`, a regra pura em `economy/trade.ts` e a autoridade central em `commands.ts`. O store de UI guarda somente qual proposta está aberta; não duplica conteúdo ou regra.

## Complexity Tracking

Sem violações constitucionais. A coleção identificada substitui um campo singular e evita uma fila ou serviço novo.
