# Research — Fluxo de Turno (Fase 0)

Decisões técnicas que sustentam o plan. Como o `src/` ainda não tem lógica de jogo, estas decisões **fundam** a camada de estado — daí o cuidado extra em justificá-las (precedente para todas as features de jogo seguintes).

---

## D1 — Turno como máquina de estados finita (FSM) explícita

- **Decisão:** modelar o turno como uma FSM explícita com um campo `state` discriminado (`aguardando-rolagem` → `casa-a-resolver` → `aguardando-finalizacao` → `encerrado`, mais o ramo `prisao-decisao`). Transições são funções puras `(turn, event) → turn`.
- **Rationale:** o turno do SRS é literalmente uma máquina de estados com guardas (não pode finalizar sem resolver; re-roll só após resolver; 3ª dupla desvia pra prisão). FSM explícita torna as guardas (FR-007, FR-015, FR-022) verificáveis e impossíveis de "pular". Espelha 1:1 os acceptance scenarios.
- **Alternativas consideradas:** flags soltas (`hasRolled`, `pendingResolve`) espalhadas — rejeitada: estados ilegais representáveis, difícil de testar. Biblioteca de statecharts (XState) — rejeitada por ora: peso/dependência desproporcional para uma FSM pequena; pode ser revisitada se a complexidade crescer.

## D2 — Lógica como reducers puros + RNG injetável

- **Decisão:** `turnMachine.ts` e `dice.ts` são **puros** — sem acesso a `Math.random`, relógio ou store diretamente. O RNG é injetado (`roll(rng)`), permitindo testes determinísticos.
- **Rationale:** os critérios de sucesso (duplas, prisão em ≤3 tentativas, ativação do Speed Die) só são testáveis de forma confiável com RNG controlado. Pureza também garante o estado serializável exigido pela resiliência (D7/princípio VII).
- **Alternativas consideradas:** rolar dentro do componente/efeito — rejeitada: não determinístico, acopla lógica a React.

## D3 — Zustand como store de estado de jogo

- **Decisão:** adotar **Zustand** (CLAUDE.md §3) como store raiz da partida; o turn slice expõe **comandos** (`rollDice`, `chooseBusMove`, `resolvePending`, `finalizeTurn`, `jailDecision`) que aplicam os reducers puros via `set`.
- **Rationale:** já é a escolha de stack do projeto; store mínimo, sem boilerplate, serializável. O único ponto com efeito colateral é o setter — toda regra vive nos reducers puros.
- **Alternativas consideradas:** `useReducer`+Context — rejeitada: prop-drilling e re-renders amplos com 8 jogadores; Redux — rejeitada: boilerplate desnecessário.

## D4 — Vitest para a lógica de turno

- **Decisão:** introduzir **Vitest** (integra nativamente com Vite) para testes unitários dos reducers/dice. Cada SC-001…SC-007 vira ≥1 teste.
- **Rationale:** o 001 (dado+geometria) se contentou com verificação visual; o turno é **lógica de regra** onde um bug é silencioso e caro. Os success criteria já estão escritos como asserções — transcrevê-los para Vitest é direto e barato. Sem servidor, sem DOM (lógica pura) → testes rápidos.
- **Alternativas consideradas:** sem testes (só manual) — rejeitada: regressões de duplas/prisão são fáceis de introduzir. Jest — rejeitada: configuração redundante num projeto Vite.

## D5 — Resolução da casa por dispatch/portas

- **Decisão:** `resolution.ts` mapeia `SquareKind → handler`. O turno **só implementa** o que é puramente de turno (`corner-gotojail` → prisão; gatilho do bônus de GO; término do movimento). Os demais kinds (property, airport, utility, tax, acaso, tesouro, bus-ticket) chamam **portas** (interfaces) que retornam um `ResolutionOutcome` com `{ done: boolean; blocksFinalize?: boolean }`. Até a spec irmã existir, o handler é um **stub** que marca a casa como resolvida (no-op) para não travar o ciclo.
- **Rationale:** mantém o escopo de orquestração da spec (FR-010) sem implementar mecânicas de outras specs, e dá o ponto de extensão exato onde Compra & Aluguel, Cartas, Construção e Balanceamento se plugam. Evita reescrever o turno a cada feature nova.
- **Alternativas consideradas:** `switch` gigante com lógica inline — rejeitada: viraria o ponto de acoplamento de todo o jogo; quebra a fronteira de specs.

## D6 — Speed Die como propriedade condicional da rolagem

- **Decisão:** `dice.roll(rng, { speedDie: boolean })`. O store passa `speedDie = player.completouPrimeiraVolta`. A flag vira `true` **na rolagem seguinte** ao cruzamento do GO (clarificação Q2): o cruzamento seta a flag *após* computar o movimento daquela rolagem. Dupla é avaliada **só pelos dois brancos** (FR-014), independente da face/escolha do Ônibus (clarificação Q3). Triple encerra a rolagem, sem re-roll (clarificação Q1).
- **Rationale:** isola a regra de ativação num único lugar e respeita as 3 clarificações. Faces especiais (Mr. Banco Master, Ônibus, Triples) são resolvidas como variações de **movimento**, não de estado de turno.
- **Alternativas consideradas:** ativar Speed Die na mesma rolagem do cruzamento — rejeitada pela clarificação Q2 (opção A do usuário).

## D7 — Transporte realtime/persistência DEFERIDO (estado sync-ready)

- **Decisão:** o 002 **não** integra Supabase. Desenha o estado de turno como **snapshot serializável** (JSON puro) e os comandos como transições determinísticas — suficiente para a spec de Sessão aplicar `snapshot → Supabase` e `restore` na reconexão sem refatorar o turno.
- **Rationale:** separação de responsabilidades por spec (CLAUDE.md §4). Resiliência (FR-028) é uma **propriedade** que o design garante (estado puro), mas o *mecanismo* de sync é da spec de Sessão.
- **Alternativas consideradas:** acoplar realtime agora — rejeitada: invadiria o escopo da spec de Sessão e arriscaria decisões prematuras de sync/conflito.

## D8 — Valores de GO Progressivo e Free Parking via porta

- **Decisão:** o turno chama `ports.onPassGo(playerId) → amount` e `ports.onPayToCenter(amount)` sem conhecer a fórmula. Valores (GO $100–$400 por ranking; pote do Free Parking) são calculados pela spec de Balanceamento.
- **Rationale:** princípio IV (catch-up discreto) — o turno só recebe um número e o credita; nenhuma lógica de ranking vaza para a camada de turno nem para a UI do turno.
- **Alternativas consideradas:** calcular o ranking no turno — rejeitada: acopla balanceamento ao turno e dificulta tunar valores isoladamente.

---

## Itens explicitamente fora desta fase (consumidos como portas)

| Porta | Quem implementa (spec) |
|---|---|
| `resolveProperty` (compra/leilão/aluguel) | Compra & Aluguel |
| `drawCard` (acaso/tesouro) | Sistema de Cartas |
| `grantBusTicket` | Bus Tickets (estrutura já em 001) |
| `onPassGo` / `onPayToCenter` | Mecânicas de Balanceamento |
| `snapshot` / `restore` / pausa | Sessão & Resiliência |
| `isEliminated` / efeito de falência na ordem | Falência |

Nenhum `NEEDS CLARIFICATION` pendente — as 3 ambiguidades de regra foram resolvidas no `/speckit-clarify` e as decisões técnicas acima cobrem o resto.
