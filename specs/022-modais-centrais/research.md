# Research — Modais centrais (022)

Decisões técnicas que destravam o plano. Tudo é camada de apresentação; o motor (`src/game/` puro) não muda.

## D1 — Seletor puro `activeModal(game)` como fonte única

- **Decisão**: uma função pura `activeModal(game: GameState): ModalView | null` decide **qual** modal mostrar e **com quais dados**, derivando tudo de `game.resolution` (+ jogador da vez). Tanto o `ModalLayer` (renderizar) quanto o `GameHUD` (esconder os ramos cobertos) consultam o mesmo predicado.
- **Rationale**: replica o padrão validado de `playersView` (020) — lógica testável por Vitest sem RTL (que o projeto não tem). Evita divergência entre "o que mostrar" e "o que o HUD esconde" (FR-009).
- **Alternativas**: lógica inline no `ModalLayer` (não-testável isolada; risco de o HUD duplicar) — rejeitada.

## D2 — Quais `resolution.kind` viram modal central

- **Decisão**: cobrir `purchase`, `auction`, `house-auction`, `card-discard`, `card-shortcut`. Os demais (`debt`, `reaction-diplomacia`, `reaction-bunker`) **não** — `activeModal` retorna `null` para eles e o `GameHUD` segue tratando-os.
- **Rationale**: são exatamente os estados em que o motor já pausa e que a barra do HUD hoje trata; é o escopo fechado com o usuário. Dívida/reação têm fluxo de negociação/empréstimo melhor servido pela barra por ora.
- **Alternativas**: incluir `debt`/reação agora — fora do escopo decidido; aumenta superfície sem fechar o ciclo de aquisição (foco do MVP).

## D3 — Texto/cor das cartas no modal de descarte

- **Decisão**: `activeModal` devolve, para o descarte, a lista de cartas da mão do jogador da vez como `{ id, rarity, effect }` (obtidas via `cardById(id)`). A **cor** vem da raridade (laranja/azul/verde — SRS §10.2); o **nome legível** vem de um pequeno mapa de apresentação `effect → rótulo` no `ModalLayer` (não no motor), com fallback para o próprio `effect` humanizado.
- **Rationale**: a entidade `Card` (006) só guarda `effect` (uma chave), não nome/prosa. Um catálogo completo de textos é conteúdo à parte (rascunho em `docs/CARTAS.md`) e não é pré-requisito desta fatia. Mapa de apresentação mínimo mantém a privacidade (só a mão do jogador) e não toca o motor.
- **Alternativas**: (a) mostrar o `id` cru como hoje no HUD — pobre de UX; (b) cablar um catálogo de textos completo agora — escopo de conteúdo, diferido. Escolhido o meio-termo testável.

## D4 — Campo de valor no lance e cronômetro do leilão

- **Decisão**: o incremento +$50 é o caminho principal; um campo opcional de valor é **estado local** do `ModalLayer` (default `currentBid + 50`), nunca no `GameState`. O fechamento automático pelo prazo **já é** do store (timer `rearmAuction`); o modal só **exibe** o deadline.
- **Rationale**: princípio VII — nada essencial fora do estado serializável; reabrir a partida reabre o mesmo leilão (o deadline está no `auction`). Não duplicar timer evita corrida com o store.
- **Alternativas**: guardar o valor digitado no estado global (poluição desnecessária) — rejeitado; criar timer próprio no componente (duplicação) — rejeitado.

## D5 — Onde mora o código

- **Decisão**: `src/game/ui/modals/activeModal.ts` (puro) + `src/game/ui/modals/ModalLayer.tsx` (efeito: chama o store). Teste em `tests/game/ui/activeModal.test.ts`.
- **Rationale**: vizinho do `GameHUD` (camada de apresentação), fora de `src/game/`-motor; espelha `tests/game/ui/playersView.test.ts` (020).
- **Alternativas**: dentro de `boards/` — `boards/shared.tsx` já é gigante; melhor isolar a camada de modais.

## D6 — Reúso visual

- **Decisão**: reaproveitar o **vocabulário** visual de `PropertyPopover`/`AirportPopover`/`UtilityPopover` (cartão de propriedade: nome, cor do grupo, preço, aluguéis) e o da faixa de raridade das cartas. O `ModalLayer` centraliza o cartão (overlay no miolo), **sem** reusar o posicionamento adjacente do popover (que ancora numa casa clicada).
- **Rationale**: consistência visual sem reimplementar a face da propriedade; o popover existente é ancorado a uma casa, não serve para o centro.
- **Alternativas**: reusar o popover inteiro com posição central — o cálculo de posição adjacente atrapalha; extrair só o miolo visual é mais limpo (decisão fina fica para a implementação, com referência visual do usuário).

## Aberto para a implementação (não bloqueia o plano)

- **Acabamento visual** dos cartões centrais (moldura, sombra, animação de entrada): definir com **referência visual do usuário** antes de codar a UI (preferência registrada do projeto). O contrato de `activeModal` independe disso.
