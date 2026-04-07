# Plan: Cidade da Fuligem — segundo mapa jogável

**Spec**: [spec.md](./spec.md) · **ADR**: [D-069](../../docs/adr/D-069-segundo-mapa-jogavel-cidade-da-fuligem.md) · **Stack**: a do repo (React+Vite+TS+Tailwind+Zustand+Supabase) — nada novo.

## Decisões de design

### D1 — O esqueleto econômico continua sendo `BOARD`; o catálogo é overlay de apresentação

`src/lib/boardData.ts` é consumido por ~50 arquivos, incluindo todo o motor (`setup`, `turnMachine`, `rent`, `construction`, `cards/*`…). O motor só lê campos econômicos (`pos`, `kind`, `group`, `price`, `rent`, `amount`) — **idênticos nos dois mapas por exigência da spec (FR-002)**. Logo o motor **não muda uma linha**: continua importando `BOARD`.

O catálogo (`src/lib/mapCatalog.ts`) fornece por mapa: `id`, nome público, `board: Square[]` (o MESMO esqueleto com nomes/ícones próprios — o da Fuligem é **construído programaticamente a partir de `BOARD`**, o que dá paridade por construção), nomes de grupo por `GroupKey`, rótulos de apresentação (`labels`) e overrides de texto de carta. `GroupKey`, `SquareKind`, ids/efeitos de carta e `THEME` são contratos do motor e não mudam.

- `PropertySquare.uf` vira **opcional**; Fuligem não tem bandeira e ganha `icon?: PropertyIconId` (fábrica, chaminé, trem, engrenagem, lâmpada, prédio…). `ClassicSquare` desenha `FlagAvatar` quando há `uf`, senão o disco de ícone do mapa.
- Camada de UI que resolve casa/grupo/rótulo por apresentação troca `import { BOARD, GROUPS }` por `activeBoard()` / `activeGroups()` / `mapLabels()` — leitura imperativa do store (padrão zustand do repo), reativa onde importa (home) e estável em partida (o mapa não muda mid-game).

### D2 — O eixo visual e o mapa são o MESMO eixo (colapso do `boardTheme`)

`useBoardTheme` passa a ser o **store do mapa ativo**: `BOARD_THEMES = ['atlas','fuligem']` (tipo `BoardId`), `data-board-theme="fuligem"`. Quem o define:

1. **Sala publicada** (fonte da verdade): quando `roomStore.setRoom` recebe a sala, aplica `room.boardId`. Reload/reconexão/convidado herdam por aqui.
2. **Home**: a seleção do host (pré-sala) — viaja até `session.create` por query (`?host=1&map=fuligem`).
3. **Partida local de dev**: `?map=fuligem` junto de `?local=1`/`?players=N`.

Antes de a sala publicar, o paint inicial é `atlas` (fallback documentado na spec).

### D3 — `boardId` na sala segue a trilha do `opening_mode` (precedente literal)

- `Room.boardId?: BoardId` (opcional para salas legadas) + `PublicRoom` + `toPublicRoom` + `normalizeRoom` (coage: `'fuligem'` só quando explícito, senão `'atlas'`) + `createRoom(id, host, {boardId})`. `prepareRematch` preserva (mapa pertence à sala). **Sem mutador** — imutável por construção (não existe `selectBoardId`).
- Transportes: `supabaseTransport` (`saveRoom`/`loadRoom`/`reopenRoom`/`saveSnapshot`/`loadSnapshot` + fallbacks de assinatura para janela de deploy), `localTransport`, `tests/net/fakeSupabase.ts`.
- **Migration `0009_room_board_id.sql`**: coluna `board_id text not null default 'atlas'` + CHECK `in ('atlas','fuligem')` (modelo: 0005), recriação de `room_preview`/`read_snapshot` com `'boardId'`, overloads aditivos de `write_room`/`write_snapshot`/`reopen_room` (assinaturas antigas permanecem — comentário do 0007). `tests/db/rpc.sql` cobre. **A migration NÃO é aplicada em produção nesta entrega** (RUNBOOK §1 é o procedimento; sem deploy autorizado).

### D4 — Remoção do Neon é substituição de eixo, não convivência

`HomeNeonArcade` → `HomeFuligem`; `NeonBackdrop` → `FuligemBackdrop` (mantendo o contrato `data-entry-backdrop="<id>"` que os testes checam); `GridPattern` → `FoundryPattern` (miolo); CSS: blocos neon das faixas mapeadas (762–944, 4303–4312, 4454–4528, 4577–4587, 6248–6600, 6726–6728) substituídos pelos da Fuligem; `@fontsource/press-start-2p` sai do CSS e do `package.json`. **Crítico**: os seletores negados `:root:not([data-board-theme="neon"])` (Atlas como default, inclusive pré-hidratação) viram `:root:not([data-board-theme="fuligem"])` — o Atlas continua default sem atributo.

Os dois testes de tema são **atualizados, não removidos**: `entryThemeIsolation` mantém a asserção `mounts === 1` (a verificação de desempenho de troca de tema — a troca não pode remontar a subárvore de conteúdo) agora contra `fuligem`; `homeMapSelector` inverte de "prévia bloqueada" para "segundo mapa jogável".

### D5 — Direção visual da Fuligem (tokens)

Edição física premium da Revolução Industrial. Papéis (mesmos nomes de token, valores novos):

- Escala tinta → **carvão/ferro** quente (`#151210` → `#070605`); superfícies com grão de ferro fundido.
- `--color-starlight` → **creme de papel antigo** (`#f0e7d4`); muted → sépia.
- `--color-brass` → **laranja de fogo/cobre** (`#d9822e`, soft `#a35a1b`, glow `#ffb36b`) — a luz de fornalha é o "latão" deste mundo; detalhes frios (verde/azulado) só em elétrico.
- `--color-signal` mantém papel de perigo (vermelho-ferrugem).
- **Grupos**: os 10 `--color-group-*` mantêm os valores calibrados do Atlas (contraste e dicromacia já verificados) — a identidade do mundo vem das superfícies, não da cor-informação.
- **Fontes**: as do Atlas (Bebas/Inter/Roboto Slab) servem o industrial — nenhuma família nova, nenhum problema de 14px.
- Cromo das casas: **rebites de ferro** nos cantos (substituem cantoneiras neon) e moldura de painel de fábrica com parafusos no frame; hipoteca ganha placa "HIPOTECADA" (padrão + texto, não só cor).
- Cenários: `FuligemBackdrop` (skyline industrial em planos, chaminés com fumaça lenta e POUCOS elementos, fornalhas acesas, trem de carga ao fundo, postes, névoa — gerador semeado como o do Neon, disciplina de perf igual), `FoundryPattern` no miolo, palco de partida próprio no `StageBackdrop` (hoje `null` fora do atlas).
- Lobby: `FuligemBackdrop` lê `useRoomStore` e acende janelas/fornalhas da fábrica por assento ocupado, na cor do assento (estado→luz, sem timeline por janela); sirene curta + portões na transição de início.

### D6 — Cartas e log: override de apresentação por nome canônico

O motor guarda `effect` id e loga `name` canônico (spec 040 — o casamento por nome em `describeLog` é acoplamento registrado). Nomes canônicos **não mudam**. O catálogo fornece `cardText: Record<nomeCanônico, {label?, desc?}>` aplicado nos pontos de apresentação (`cardMeta.cardLabel/cardDesc` e fragmentos do `describeLog`): ex. "Passagem de Ônibus" exibe "Bilhete de Trem", "Obras na Pista" fala em Ferrovia. Efeitos, raridades, decks e timing intocados (`catalog.ts` do motor sem diff).

### D7 — Sons por variante de cue

`cues.ts` mapeia cue→asset por `import.meta.glob`. Ganha resolução por tema: asset `fuligem--<cue>.*` quando existir e o mapa for `fuligem`, senão o asset base (fallback silencioso já existente). Entram cues da identidade Fuligem priorizando os eventos do brief (sirene de início, carimbo+máquina na compra, registradora no aluguel, martelo na construção, máquina desligando na hipoteca, sino no leilão, portão na prisão, parada gradual na falência, fábrica inteira na vitória), gerados por script offline (Web Audio/ffmpeg, mesmo espírito dos assets atuais). Autoplay/preferências: sistema existente, intocado.

### D8 — Escopo de superfícies

Home (nova), telas de entrada/lobby/erro/reentrada (EntryStage por tema), tabuleiro completo (casas, cantos, marcas de construção — rótulos Oficina/Fábrica/Complexo/Torre de Ferro —, Estação de Carga, popovers/escrituras, miolo, pote Sorte Grande), modais (revelação de carta como telegrama/desenho de invenção via cromo CSS por tema), HUD, log, leilões, trocas, empréstimos, dívida, classificação, aviso de orientação, landing (`aside.mk-next-board` vira o slot do segundo mapa — só isso).

## Riscos e mitigação

- **Cauda longa de strings de apresentação** ("aeroporto", "hangar", "casa/hotel", "Loteria") espalhadas em UI/describeLog → varredura por grep + `mapLabels()`; teste de paridade garante que o Atlas segue byte-idêntico nos textos atuais.
- **E2E multiplayer contra infra real**: a coluna `board_id` não existe em produção até a migration ser aplicada (fora desta entrega). O fluxo é provado headless (LocalTransport + fakeSupabase com as RPCs novas) e no browser conforme o transporte disponível no projeto `built` (investigar o mecanismo do `inviteRetention.spec.ts` com credenciais falsas e seguir o mesmo caminho).
- **Perf**: mesmas regras do Neon removido (steps/poucos elementos), animação só `transform`/`opacity`, `<Activity>` continua pausando o mapa escondido (asserção `mounts === 1` preservada).

## Fases

1. **Fundação de dados**: `BoardId` + catálogo + Fuligem board + testes de paridade.
2. **Sala**: `Room.boardId` ponta a ponta (room → session → host → transportes → SQL 0009 → fakeSupabase) + testes de rede.
3. **Eixo visual**: boardTheme colapsado, aplicação pela sala, `?map=` local.
4. **Remoção Neon + Fuligem visual**: componentes, CSS, fontes, home nova, lobby, palco, tabuleiro, cartas/labels.
5. **Som**.
6. **Testes obrigatórios + E2E + screenshots + gates**.
