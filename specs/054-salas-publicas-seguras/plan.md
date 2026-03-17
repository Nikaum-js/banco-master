# Implementation Plan: Diretório opt-in de salas públicas anônimas

**Branch**: `codex/054-salas-publicas-seguras` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/054-salas-publicas-seguras/spec.md`

## Summary

Adicionar descoberta opt-in sem transformar `public.rooms` em fonte enumerável. Uma migration
aditiva cria o estado de publicação e os contadores server-side, expõe apenas RPCs
`security definer` com allowlist de resposta e admite a entrada pública de forma atômica.
O frontend acrescenta o diretório à home e um controle exclusivo do host no lobby, mantendo
inalterados o convite privado, a sessão anônima, a reentrada, o kick e a revanche.

## Technical Context

**Language/Version**: TypeScript 6, React 19, PostgreSQL 17

**Primary Dependencies**: Vite 8, Supabase Auth/Postgres/Realtime, Tailwind CSS 4, lucide-react; nenhuma biblioteca nova

**Storage**: `public.public_room_listings` e `public.public_room_rate_events`; `public.rooms.created_at` aditivo

**Testing**: Vitest 4, Testing Library, SQL real via Supabase CLI, Playwright 1.62 com BrowserContexts isolados, axe

**Target Platform**: navegador desktop/celular + Supabase; home em retrato ou paisagem e partida com orientação existente

**Project Type**: aplicação web multiplayer frontend-first com contratos Postgres server-side

**Performance Goals**: listagem converge em até 5 s; ausência contínua do host remove em até 90 s; uma consulta por sessão a cada 5 s

**Constraints**: zero enumeração privada; zero `roomId` antes da admissão; sem `service_role` no browser; falha do diretório isolada do fluxo privado

**Scale/Scope**: até 8 assentos por lobby; 5 campos por item; filtros locais; 4 limites de abuso e 5 histórias de usuário

## Constitution Check

*GATE antes da pesquisa e rechecado depois do design: aprovado.*

- **I — SRS absoluto**: D-068 e SRS v1.30 autorizam todos os comportamentos antes deste plano.
- **II — Discovery antes do código**: spec clarificada e explicitamente aprovada em 2026-07-30.
- **III–V**: economia, catch-up e cooperação não são alterados.
- **VI — Privacidade estratégica**: nenhuma mão, carta, deck, snapshot ou serializer de `Room`
  entra no diretório; a resposta é construída campo a campo no servidor.
- **VII — Resiliência**: presença controla somente elegibilidade da listagem; sala, assentos,
  pausa, reentrada e código permanecem intactos.
- **Autoridade**: host atestado decide publicação; Supabase decide enumeração, limites e a
  admissão atômica do novo assento público; o host continua autoridade integral da partida.
- **Compatibilidade**: sala sem `public_room_listings` é privada; convite privado não chama
  nenhuma RPC do diretório.

Rechecagem pós-design: nenhuma violação. A única regra de domínio nova no servidor é a
admissão pública definida pela D-068, paralela ao precedente de `reattach_by_code`; comandos
e regras econômicas continuam host-autoritativos.

## Project Structure

### Documentation (this feature)

```text
specs/054-salas-publicas-seguras/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   ├── directory-rpcs.md
│   ├── publication-lifecycle.md
│   └── public-admission.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/net/
├── publicRoomDirectory.ts
├── roomSession.ts
├── session.ts
├── supabaseClient.ts
└── ui/
    ├── HomeScreen.tsx
    ├── LobbyScreen.tsx
    ├── PublicRoomControl.tsx
    ├── PublicRoomDirectory.tsx
    ├── home/HomeAtlas.tsx
    ├── home/HomeMapPanel.tsx
    ├── home/HomeNeonArcade.tsx
    └── home/homeShared.ts

src/telemetry/
├── port.ts
└── supabaseSink.ts

supabase/migrations/0008_public_room_directory.sql

tests/
├── db/public_room_directory.sql
├── net/publicRoomDirectory.test.ts
├── net/roomSession.test.ts
├── telemetry/port.test.ts
└── ui/publicRoomDirectory.test.tsx

e2e/publicRooms.spec.ts
scripts/attack-public-rooms.ts
src/index.css
.github/workflows/ci.yml
package.json
```

**Structure Decision**: regras de autorização e rate limiting ficam numa única migration;
o módulo `publicRoomDirectory.ts` é uma anti-corruption layer de DTOs/RPCs e nunca lê
`rooms`; a máquina de sessão apenas coordena a admissão antes de abrir o transporte da sala;
componentes da home e do lobby recebem contratos estreitos. A suíte real é separada dos
doubles e entra no job de banco/CI sem depender de credencial administrativa no frontend.

## Design

### Projeção deny-by-default

- `public_room_listings` referencia `rooms`, mas não tem policy de leitura ou escrita.
- `list_public_rooms()` exige `authenticated`, aplica o limite de 5 segundos e monta JSON
  por allowlist: `listingId`, rótulo, vagas, capacidade, `openingMode` e minutos aproximados.
- Elegibilidade é calculada dentro da consulta: publicação vigente, `status = 'lobby'`,
  `last_host_seen_at >= now() - interval '60 seconds'` e menos de 8 assentos.
- Não existe view aberta, `select` de `rooms`, fallback ou serializer compartilhado.

### Publicação e presença

- `publish_public_room()` e `unpublish_public_room()` comparam `auth.uid()` ao host atual
  lido de `rooms`; o identificador público é rotacionado em cada nova publicação.
- Eventos de publicação contam salas distintas por identidade numa janela de 10 minutos.
  Uma consulta transacional também impede segundo lobby publicado pela mesma identidade.
- O host chama `heartbeat_public_room()` ao publicar e a cada 30 segundos enquanto estiver
  no lobby. Parar o heartbeat só esconde após 60 segundos; nunca despublica nem escreve sala.
- Trigger em `rooms` encerra a publicação ao primeiro estado diferente de `lobby`. Sala cheia
  é somente filtrada e pode reaparecer; `reopen_room` não republica.

### Admissão pública atômica

- `join_public_room()` conta toda tentativa, trava a linha da sala, revalida publicação,
  presença, lobby, vaga e identidade, valida a apresentação e adiciona no máximo um assento.
- A função só retorna `roomId` depois de a admissão efetiva. Recusa nunca o devolve.
- O novo assento recebe `reentryCode` e `historyId` aleatórios no servidor. Um aviso Realtime
  faz o host recarregar a sala, reconciliar tópicos e publicar o estado vigente.
- A entrada privada continua chamando `request_seat` e não compartilha contadores.

### Interface e recuperação

- A home mantém uma única consulta mesmo com os dois temas montados e aplica filtros
  client-side sobre a projeção já autorizada.
- Estados loading, vazio, erro, limite e indisponibilidade têm texto, região viva e ação
  recuperável; filtros e cards são operáveis por teclado e em viewport móvel.
- O lobby mostra ao host um controle explícito com estados privada, pública visível e
  pública oculta; convidado não recebe mutação.
- Telemetria acrescenta somente eventos sem identificadores (`public_directory_opened`,
  `public_room_published`, `public_room_joined`) à união fechada da D-040.

## Complexity Tracking

Nenhuma violação a justificar.
