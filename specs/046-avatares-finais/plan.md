# Implementation Plan: Avatares finais

**Branch**: `046-avatares-finais` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/046-avatares-finais/spec.md`

## Summary

Fechar o catálogo em cinco avatares, restaurar as oito skins anteriores como camadas combináveis, transformar as duas escolhas do formulário em parte persistente do assento e fazer toda representação de jogador consultar a mesma identidade `nome + cor + avatar + skin`. A arte canônica ficará junto do `PlayerFace`; o lobby usará esse mesmo componente como preview e nos dois catálogos. A compatibilidade será aditiva: estado ou valor legado cai em Clássico Vivo + Careca, e o parâmetro opcional já existente no pedido de assento transporta o envelope versionado das duas escolhas sem migration.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19

**Primary Dependencies**: React, Motion, Zustand, Supabase Realtime/Postgres, Tailwind CSS

**Storage**: `rooms.seats` em JSONB e snapshots existentes; nenhuma tabela nova

**Testing**: Vitest 4, Testing Library, Playwright, gates de typecheck/lint/build do Bun

**Target Platform**: Navegadores modernos em desktop, tablet e celular; partida em paisagem

**Project Type**: Aplicação web multiplayer

**Performance Goals**: Animações de transform/opacity a 60fps; token legível de 16px a 72px; nenhuma renderização por frame via estado React

**Constraints**: Cinco ids de avatar e oito ids de skin fechados; matriz 5×8 completa; escolhas não exclusivas; cor continua única; `prefers-reduced-motion`; compatibilidade com salas sem os campos; sem migration remota

**Scale/Scope**: Até 8 assentos por sala; lobby, token do tabuleiro e superfícies que já exibem `PlayerFace`

## Constitution Check

*GATE inicial e pós-design: aprovado.*

- **I. SRS**: SRS 1.13 e D-047 foram atualizados antes do contrato e da implementação.
- **II. Discovery**: spec 046 está aprovada pelo pedido explícito de tornar o catálogo final no jogo.
- **III–VI**: não altera Tesouro, catch-up, cooperação ou privacidade estratégica.
- **VII. Resiliência**: avatar e skin pertencem ao assento persistido e sobrevivem à reconexão; fallbacks cobrem estado legado.
- **Hierarquia documental**: `Avatar` entrou no `CONTEXT.md`; entidade e invariantes vivem nesta spec.

## Project Structure

### Documentation (this feature)

```text
specs/046-avatares-finais/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── avatar-identity.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── boards/
│   ├── playerAvatarCatalog.ts  # ids, rótulos e normalização sem React
│   ├── playerAvatars.tsx       # camadas SVG canônicas
│   ├── playerSkinCatalog.ts    # ids, rótulos e normalização das skins
│   ├── playerSkins.tsx         # acessórios SVG sobrepostos
│   └── shared.tsx              # PlayerFace compõe avatar + skin
├── game/ui/
│   ├── LiveTokens.tsx          # token móvel consulta identidade da sala
│   └── panels/playersView.ts   # projeção inclui avatar
├── net/
│   ├── room.ts                 # Seat/Identity + normalização
│   ├── identity.ts             # projeção nome/cor/avatar/skin
│   ├── transport.ts            # JoinRequest
│   ├── supabaseTransport.ts    # envelope legado piece → avatar + skin
│   └── ui/
│       ├── AvatarConceptLab.tsx # dois catálogos controlados usando PlayerFace
│       ├── LobbyScreen.tsx
│       └── OnlineGate.tsx
└── index.css                   # estado selecionado e idles lentos

tests/
├── net/
│   ├── room.test.ts
│   ├── identity.test.ts
│   └── conformance.test.ts
└── ui/
    └── avatarConceptLab.test.tsx
```

**Structure Decision**: preservar a separação existente: o assento é a fonte persistente, `identityOf` é a projeção de exibição e `PlayerFace` é a única composição canônica. Catálogos de ids ficam sem React; os seletores não duplicam SVG. `PlayerSkinArtwork` separa camadas traseiras e dianteiras para que acessórios envolvam qualquer forma sem substituí-la.

## Complexity Tracking

Sem violações constitucionais ou camadas novas que exijam justificativa.
