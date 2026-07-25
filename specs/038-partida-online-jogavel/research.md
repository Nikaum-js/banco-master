# Research — spec 038 (perspectiva local, identidade real, roteamento)

Fase 0 do plan. A spec 038 entrou em planejamento **sem** `[NEEDS CLARIFICATION]` (as duas ambiguidades viraram D-029 e D-030 antes de virar requisito), então esta fase não resolve incógnitas de produto — ela registra as **decisões de design** e o que foi descartado, para que o `/speckit-tasks` e a implementação não as re-litiguem.

---

## D1 — Como a UI sabe "quem pode agir"

**Decisão**: consumir `actorOf` de `src/game/commands.ts` — a mesma função que o host usa para validar (`host.ts:70`) — através de um `actorOfKind(state, kind)` derivado da mesma tabela.

**Rationale**: a UI e a autoridade respondendo à mesma pergunta com fontes diferentes é uma dessincronização garantida no primeiro comando novo. Uma tabela, dois consumidores. Um teste de exaustividade sobre o union `GameAction['kind']` faz o compilador/suíte reclamar quando alguém adicionar um comando sem decidir a perspectiva dele.

**Alternativas consideradas**:
- *Lista própria na UI* (`const MINHAS_ACOES = [...]`): descartada — é exatamente a duplicação que apodrece.
- *Perguntar ao host por round-trip* ("posso rolar?"): descartada — latência em cima de cada render, e o host já responde na prática descartando o comando.
- *Derivar só de `activeSeat`*: descartada — quebra em todas as decisões fora do turno (leilão, troca recebida, reação, empréstimo), que são justamente as que mais confundem hoje.

---

## D2 — Identidade fora do `GameState`

**Decisão**: `identityOf(room, playerId) → {name, color, piece}` num módulo puro, alimentado pelo estado da sala, com fallback sintético (`Jogador 1..8`) quando não há sala.

**Rationale**: D-019 mantém o `GameState` sem PII, e o snapshot é persistido a cada comando — nome dentro do `Player` iria para o Postgres a cada jogada e viraria dado pessoal em repouso, sem necessidade. O fallback existe para que a UI **nunca** precise de `if (multiplayer)`: um só caminho de render mata `p1..pN` de todas as superfícies (FR-009) e preserva o single-player.

**Alternativas consideradas**:
- *`name` no `Player`*: descartada — viola D-019 e contamina o snapshot.
- *Mapa de identidade no `useGameStore`*: descartada — mesma fronteira borrada, com o agravante de o store do jogo virar meio-sala.
- *Prop drilling a partir do `OnlineGate`*: descartada — 11 arquivos de UI, alguns profundos (`boards/shared.tsx`), tornariam a passagem de props ruído puro.

---

## D3 — Store separado para a sala

**Decisão**: `src/net/roomStore.ts` (Zustand) com `room`, `myToken` e a `LocalView` derivada; `connectMultiplayer` passa a alimentá-lo junto com o `game`.

**Rationale**: repete a decisão de risco que deu certo na 037 — **aditivo, sem refatorar `store.ts`**. O single-player continua com o store do jogo intocado; quem não está numa sala lê um `roomStore` vazio e recebe o fallback.

**Alternativas consideradas**:
- *Context React*: funciona, mas o projeto já padronizou Zustand para estado compartilhado; dois mecanismos para o mesmo papel é dialeto desnecessário.
- *Campos novos no `useGameStore`*: descartada (ver D2).

---

## D4 — O que ver quando a decisão é de outro

**Decisão**: mesma superfície, sem controles — o modal/painel aparece em modo "assistindo", com `aguardando <nome>`, em vez de sumir.

**Rationale**: o jogo é social; esconder o que está acontecendo transforma o turno alheio em tela morta e destrói a tensão do leilão e da negociação (que é metade da graça). Além disso, sumir/aparecer a cada troca de turno produz layout instável. O que sai são os **controles**, não a informação — respeitando o que já é público pelo SRS §12.3 (saldos, contadores, efeitos ativos).

**Alternativas consideradas**:
- *Esconder o modal para não-atores*: descartada pelo acima.
- *Deixar os controles visíveis porém desabilitados*: descartada — um botão cinza que nunca habilita é ruído permanente; o rótulo "aguardando Fulano" comunica melhor e ocupa menos.

---

## D5 — `GameDriver` em N clientes

**Decisão**: o auto-avanço (auto-resolve da casa, re-rolagem em dupla) só dispara no cliente do ator.

**Rationale**: hoje o driver roda igual em todos os clientes; online, N-1 deles enviariam o mesmo comando para o host descartar (FR-007 já protege o estado — o efeito é tráfego e log inútil, não corrupção). Gate por `mayAct` resolve com uma linha e mantém o motor intocado.

**Nota**: isso é affordance também no sentido de rede — não é validação. Se o gate falhar, o resultado é o de hoje: o host descarta.

---

## D6 — Kick reusando o canal de recusa

**Decisão**: remoção no lobby publica a sala sem o assento e envia `rejectJoin(token, 'kicked')`; sem canal novo no `Transport`.

**Rationale**: o efeito de "você não está mais nesta sala" é idêntico ao de uma recusa de entrada, e o cliente já trata `onJoinRejected` filtrando pelo próprio token (037). Um evento dedicado seria uma quarta rota fazendo o que a terceira já faz.

**Escopo**: apenas pré-início (FR-024). Kick mid-game colide com D-016/princípio VII e exigiria ADR — registrado nas Assumptions da spec.

---

## D7 — Ordem inicial sorteada

**Decisão**: o host sorteia a ordem no início (RNG dele, como já faz com o embaralho) e o resultado vive no `turnOrder` que o `GameState` **já tem**; a tela de ordem lê `turnOrder` + identidades.

**Rationale**: composição, não regra nova — `turnOrder` existe desde a 002 e o motor já joga na ordem que receber. O embaralho de cartas no `buildInitialGame` é o precedente exato: valor sorteado pelo host que vive no snapshot e chega aos clientes por leitura, sem precisar de replay.

**Alternativas consideradas**:
- *Rolagem de dados interativa por jogador*: mais bonita e mais cara (fluxo de N rolagens, empates, desconexão no meio). Fica para quando o lobby ganhar produção própria; a spec já a prioriza como P5 justamente por isso.

---

## D8 — Onde os testes vivem

**Decisão**: lógica em módulos puros cobertos por `tests/net/`; camada React fina, sem suíte de componente.

**Rationale**: o projeto roda Vitest em ambiente **node** (`vitest.config.ts`), sem DOM. Introduzir testing-library aqui seria uma segunda infraestrutura de teste no meio de uma spec de produto. Mantendo `localView`/`identity` puros, o que precisa de garantia (quem pode agir, o que é exibido de quem) é testável headless — e o que sobra em React é ligação de hook.

**Alternativas consideradas**:
- *Adicionar jsdom + testing-library agora*: descartada por escopo; é candidata legítima ao backlog técnico da auditoria, não a esta spec.
- *Cobrir por E2E Playwright* (o 036 deixou um smoke): possível depois, mas E2E multi-cliente com Realtime real é lento e flaky para ser gate de cada fatia.
