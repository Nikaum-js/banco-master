# Feature Specification: Efeitos sonoros (SFX) da partida

**Feature Branch**: `035-efeitos-sonoros`

**Created**: 2026-06-08

**Status**: Draft

**Input**: User description: "efeitos sonoros ao jogar, cair em casa, comprar, prisão etc. — avaliar todos os pontos de efeito sonoro, onde colocar, como usar. Só SFX (sem música ambiente); todos ouvem tudo; tick por casa + som ao parar; áudio ligado por padrão com mute/volume persistidos."

**Depende de**: M1 (motor) · 020 (painéis ao vivo) · 021 (event log) · 030 (modais/notificação) · `tokenAnim` (animação do peão) · taxonomia `resolution.kind` (economia/cartas).

> **Escopo desta spec:** camada de **apresentação sonora** — uma camada de áudio puramente client-side que toca **efeitos sonoros curtos** em resposta a ações e transições de estado da partida. **NÃO** cobre música/trilha ambiente (fora de escopo, possível spec futura), nem altera regra de negócio ou o `GameState` serializável (princípio VII — determinismo intacto). O áudio é derivado/observado do estado já existente; não cria nova fonte de verdade.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ações e eventos têm retorno sonoro (Priority: P1)

Como jogador, quando algo acontece na partida — eu (ou um oponente) rolo os dados, compro uma propriedade, pago aluguel, alguém falir — ouço um efeito sonoro curto e adequado àquele evento, tornando o jogo mais vivo e dando feedback imediato sem precisar olhar o log.

**Why this priority**: é o coração da feature; sem o mapeamento evento→som, não há nada. MVP entregável já com um subconjunto de gatilhos de alta frequência (rolar, comprar, aluguel, falência).

**Independent Test**: com áudio ligado, disparar cada gatilho coberto pelo motor/UI e confirmar (de ouvido / por inspeção do disparador) que o som correto toca uma vez por evento, em qualquer cliente que observe aquele estado.

**Acceptance Scenarios**:

1. **Given** áudio ligado e destravado, **When** um jogador rola os dados, **Then** toca o som de dados (com variação para dupla / Speed Die / face Ônibus).
2. **Given** uma compra de propriedade é confirmada, **When** o `resolution.kind = 'purchase'` resolve, **Then** toca o som de compra.
3. **Given** um jogador paga aluguel, **When** o aluguel é cobrado, **Then** toca o som de "dinheiro saindo".
4. **Given** um jogador falir, **When** o evento de falência resolve, **Then** toca o som de falência/eliminação.
5. **Given** dois clientes na mesma partida, **When** o jogador A rola/compra, **Then** o cliente do jogador B também ouve o som (perspectiva "todos ouvem tudo"), idêntico ao de A.

---

### User Story 2 - Controle de áudio: mute e volume (Priority: P1)

Como jogador, posso silenciar o jogo (mute) e ajustar o volume; minha escolha é lembrada entre sessões neste dispositivo. O áudio começa **ligado** por padrão.

**Why this priority**: sem controle, SFX vira incômodo e a feature é rejeitada pelo usuário. Acompanha o P1 do som para ser utilizável.

**Independent Test**: alternar mute → nenhum som toca; ajustar volume → intensidade muda; recarregar a página → preferências preservadas.

**Acceptance Scenarios**:

1. **Given** áudio ligado, **When** o jogador aciona mute, **Then** nenhum efeito sonoro toca até reativar.
2. **Given** o jogador ajusta o volume para X%, **When** um som dispara, **Then** ele toca no volume X%.
3. **Given** o jogador definiu mute/volume, **When** recarrega a página, **Then** as preferências são restauradas (persistência por dispositivo).
4. **Given** primeira visita sem preferência salva, **When** a partida começa, **Then** o áudio está ligado em volume padrão.

---

### User Story 3 - Movimento do peão soa casa a casa (Priority: P2)

Como jogador, ao mover meu peão pelo tabuleiro ouço um "tick" curto a cada casa percorrida e um som distinto quando ele para, reforçando a sensação de movimento.

**Why this priority**: aumenta o polimento, mas depende do P1 (infra) e da animação existente; não é pré-requisito para o jogo soar vivo.

**Independent Test**: mover um peão N casas e confirmar N ticks (anti-spam respeitado) seguidos de 1 som de parada, alinhados à `tokenAnim`.

**Acceptance Scenarios**:

1. **Given** um peão move N casas, **When** a animação avança casa a casa, **Then** toca um tick por casa.
2. **Given** o peão chega ao destino, **When** a animação termina, **Then** toca o som de parada (uma vez).
3. **Given** um salto direto (Bus Ticket/atalho sem percorrer casas), **When** o peão é teletransportado, **Then** NÃO há ticks por casa — só o som de chegada.

---

### User Story 4 - Destravar áudio respeitando o autoplay do navegador (Priority: P2)

Como jogador, na primeira interação minha com a página (clique/toque) o áudio é destravado silenciosamente, para que os navegadores não bloqueiem os sons seguintes.

**Why this priority**: navegadores bloqueiam áudio antes de gesto do usuário; sem destravar, o P1 falha silenciosamente em muitos clientes. Mas é mecanismo de suporte, não valor direto.

**Independent Test**: carregar a página, não interagir → primeiro evento não falha o app (no máximo não soa); após o 1º clique/toque, os eventos seguintes soam normalmente.

**Acceptance Scenarios**:

1. **Given** página recém-carregada sem interação, **When** um evento sonoro dispara, **Then** o app não quebra (som pode ser suprimido).
2. **Given** o jogador fez o 1º gesto na página, **When** eventos seguintes disparam, **Then** os sons tocam normalmente.

---

### Edge Cases

- **Anti-spam / rajada de eventos**: quando muitos eventos do mesmo tipo disparam quase simultâneos (ex.: pregão simultâneo de terrenos da spec 031, vários lances/fechamentos), os sons devem ser limitados (debounce/throttle/coalescência por tipo) para não virar cacofonia. Definir janela e política (ex.: no máximo 1 som por tipo a cada ~80–120ms; ou tocar 1 representativo).
- **Privacidade de carta (princípio VI)**: o som de **saque** de carta NÃO pode revelar informação privada. Se variar o som por raridade (laranja/azul/verde) vazar a raridade da carta que foi para a mão de outro jogador, então o saque usa um som **genérico** (igual para todas as raridades). A variação por raridade só é permitida em momentos **públicos** (ex.: `card-reveal` de cartas de efeito imediato/público).
- **Catch-up discreto (princípio IV)**: GO Progressivo, Loteria/Free Parking e Tax Man não podem ter som que **denuncie** que o jogador está em desvantagem. Som de bônus/recebimento é neutro e igual para todos; nada de "fanfarra de coitado".
- **Reentrância / re-render**: um mesmo evento de estado não pode tocar o som mais de uma vez por ocorrência, mesmo com re-renders ou múltiplos componentes observando (idempotência por ocorrência de evento).
- **Reconexão/replay de estado (princípio VII)**: ao reconectar e re-hidratar o estado, eventos **passados** não devem retocar (sem "tempestade" de sons históricos). Apenas eventos **novos** a partir da reconexão soam.
- **Mute durante reprodução**: acionar mute deve silenciar imediatamente (ou impedir novos disparos); sons já em andamento podem terminar ou cortar — definir comportamento.
- **Asset ausente / falha de carregamento**: se um arquivo de som faltar ou falhar, o evento ocorre normalmente sem som (degradação graciosa, sem erro visível).
- **Vitória/fim de jogo coincide com falência**: priorizar o som de vitória (mais saliente) sobre o de eliminação se ambos resolverem no mesmo tick.

## Requirements *(mandatory)*

### Functional Requirements

#### Catálogo de gatilhos

- **FR-001**: O sistema MUST tocar um efeito sonoro para cada **gatilho de ação do jogador** coberto: rolar dados (variações: normal, dupla, Speed Die, face Ônibus), comprar propriedade, declinar compra, construir casa/hotel/hangar, vender construção, hipotecar e desfazer hipoteca, jogar carta da mão, descartar carta, usar Bus Ticket.
- **FR-002**: O sistema MUST tocar efeitos para **movimento/casa**: tick por casa percorrida, som de parada no destino, passar/parar no GO (+bônus), cair em casa de imposto, cair em casa de Bus Ticket.
- **FR-003**: O sistema MUST tocar efeitos para **economia** (a partir de `resolution.kind` e eventos): oferta de compra (`purchase`), leilão/pregão (`auction`) nos momentos de lance e de fechamento, aluguel pago, dívida (`debt`), falência, empréstimo concedido e cobrança de juros.
- **FR-004**: O sistema MUST tocar efeitos para **cartas & eventos**: virar carta pública (`card-reveal`), atalho (`card-shortcut`), apagão, greve, sofrer aquisição hostil (`hostile-takeover`), reações (boicote, bunker, diplomacia), imunidade temporária.
- **FR-005**: O sistema MUST tocar efeitos para **celebração/fim e sessão**: Loteria/Free Parking (`free-parking`), vitória/fim de jogo, eliminação de jogador, entrar e sair da prisão, alerta de "sua vez de jogar", e (princípio VII) pausa por desconexão / retomada por reconexão.
- **FR-006**: Cada gatilho MUST ter um mapeamento explícito evento→som; gatilhos sem som definido nesta fatia ficam **silenciosos por padrão** (extensíveis depois) e isso é documentado, não um erro.

#### Comportamento

- **FR-007**: O som MUST tocar **uma única vez por ocorrência** de evento, idempotente a re-renders e a múltiplos observadores.
- **FR-008**: Perspectiva **"todos ouvem tudo"**: o sistema MUST derivar os sons das transições do **estado compartilhado** observadas localmente, de modo que todos os clientes da partida toquem o **mesmo** som para o **mesmo** evento (a autoria do evento não restringe quem ouve).
- **FR-009**: O sistema MUST aplicar **anti-spam** em rajadas: sons do mesmo tipo disparados em janela curta são limitados (throttle/coalescência) por tipo, conforme política definida, para evitar cacofonia (notadamente no pregão simultâneo).
- **FR-010**: O movimento do peão MUST emitir **um tick por casa** percorrida e **um som de parada** ao fim, alinhados à animação (`tokenAnim`); saltos sem percurso (Bus Ticket/atalho) NÃO emitem ticks, só chegada.
- **FR-011**: Ao re-hidratar/reconectar, o sistema MUST tocar som apenas para eventos **novos** (a partir da reconexão), nunca re-soar o histórico.

#### Controle e persistência

- **FR-012**: O áudio MUST iniciar **ligado** por padrão (sem preferência salva), em um volume padrão definido.
- **FR-013**: O jogador MUST poder **silenciar (mute)** e **ajustar o volume**; mute MUST suprimir todos os SFX.
- **FR-014**: Mute e volume MUST ser **persistidos por dispositivo** e restaurados ao recarregar (preferência local, não faz parte do `GameState`).
- **FR-015**: O sistema MUST **destravar** o áudio no primeiro gesto do usuário (clique/toque) para respeitar a política de autoplay; antes disso, eventos não devem quebrar o app (no máximo não soam).

#### Privacidade, dignidade e robustez (princípios)

- **FR-016**: (Princípio VI) O som de **saque de carta privada** MUST NOT variar de forma que revele a raridade/identidade da carta a outros jogadores; usar som genérico para saque. Variação por raridade só em eventos públicos.
- **FR-017**: (Princípio IV) Sons de mecânicas de catch-up (GO Progressivo, Loteria/Free Parking, Tax Man) MUST ser neutros e idênticos aos equivalentes comuns — sem destacar desvantagem.
- **FR-018**: (Princípio VII) A camada de áudio MUST NOT alterar o `GameState` serializável nem o determinismo do motor; é puramente apresentação.
- **FR-019**: Falha ao carregar/tocar um som MUST degradar graciosamente — o evento de jogo ocorre normalmente, sem erro visível ao usuário.
- **FR-020**: SFX MUST NOT bloquear o turno, a UI nem a entrada do jogador (reprodução assíncrona, não-bloqueante).

### Key Entities *(include if feature involves data)*

- **SoundEvent (cue)**: um identificador semântico de som (ex.: `dice-roll`, `dice-double`, `buy`, `rent-paid`, `bankruptcy`, `step-tick`, `step-land`, `card-reveal`, `auction-bid`, `auction-close`, `hostile-takeover`, `jail-in`, `jail-out`, `win`, `your-turn`…). Mapeia 1:N para um asset de áudio; não faz parte do `GameState`.
- **AudioPreferences**: `{ muted: boolean; volume: number (0..1) }` — preferência local por dispositivo (persistida), com defaults `muted=false`, `volume=` valor padrão. Fora do `GameState`.
- **TriggerBinding**: associação entre uma fonte observável (comando do store, `resolution.kind`, `notice`, fase, passo de `tokenAnim`, transição de log) e um `SoundEvent`, com política de anti-spam aplicável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos gatilhos listados como cobertos no catálogo (FR-001..FR-005) tocam o som correto exatamente uma vez por ocorrência (verificável pelo disparador/observador).
- **SC-002**: Em uma partida com 2+ clientes, para qualquer evento do estado compartilhado, todos os clientes tocam o mesmo som (perspectiva "todos ouvem tudo") — divergência = 0.
- **SC-003**: Mute silencia 100% dos SFX; volume ajustado reflete na intensidade; preferências sobrevivem a recarregar a página em 100% das vezes.
- **SC-004**: Nenhum som de saque de carta revela raridade privada; nenhum som de catch-up denuncia desvantagem (revisão qualitativa contra princípios IV e VI — 0 violações).
- **SC-005**: Em uma rajada (ex.: pregão simultâneo de N terrenos), o número de sons tocados respeita a política de anti-spam (não 1:1 com cada micro-evento) — sem cacofonia perceptível.
- **SC-006**: O motor permanece determinístico e serializável: suíte de testes do motor segue verde e o `GameState` não ganha campos de áudio; `bun run build` verde.
- **SC-007**: Em re-hidratação/reconexão, 0 sons de eventos históricos são retocados.

## Assumptions

- **Só SFX**: música/trilha ambiente está fora de escopo (possível spec futura); esta fatia cobre apenas efeitos pontuais.
- **Perspectiva "todos ouvem tudo"**: confirmada como decisão de produto — sons derivam do estado compartilhado observado, idênticos em todos os clientes.
- **Tick por casa + som de parada**: confirmado; saltos diretos não geram ticks.
- **Controle**: áudio ligado por padrão; mute/volume persistidos localmente por dispositivo (não no `GameState`).
- **Assets de som**: a obtenção/curadoria dos arquivos de áudio (licença livre/royalty-free, formato leve) é parte da implementação; até existirem, gatilhos podem ficar silenciosos sem quebrar o app. A escolha de formatos/biblioteca é decisão de `plan.md`.
- **Fatiamento**: P1 (catálogo de alta frequência + controle) é o MVP; movimento casa-a-casa (P2) e cobertura completa de cartas/eventos podem vir em fatias seguintes com a mesma infra.
- **Verificação**: o disparo (binding evento→som) é coberto por testes/inspeção; a qualidade sonora em si é validada pelo usuário no `bun run dev`.
