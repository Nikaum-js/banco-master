# Feature Specification: Sala Online e Estado Sincronizado (fundação do multiplayer host-autoritativo)

**Feature Branch**: `037-sala-online-estado-sincronizado`

**Created**: 2026-07-24

**Status**: Draft

**Depende de**: specs 001–034 (motor M1 completo — reducers puros, `GameState` serializável), 020–030 (UI M2 — HUD/modais que passam a refletir estado remoto) · ADRs [D-016](../../docs/adr/D-016-desconexao-pausa-a-partida.md), [D-019](../../docs/adr/D-019-autenticacao-anonima-por-link-sem-contas-no-v1.md), [D-020 + Refinamento 2026-07-24](../../docs/adr/D-020-modelo-de-autoridade-sincronizacao-host-autoritativo-realtim.md) · SRS §11, §12.3, §12.5, §16

**Input**: User description: "Sala online e estado sincronizado (fundação do multiplayer host-autoritativo)"

> **Conformidade com a constitution**: esta feature é a **casca de transporte/autoridade/persistência** do multiplayer (M3). Ela **não cria nem altera nenhuma regra de jogo** — o motor M1 (reducers puros) permanece intacto (princípio I; validação continua nos gates existentes). Operacionaliza diretamente o princípio **VII (resiliência de sessão)**: desconexão pausa, reconexão sempre possível, nada se perde. Princípios II–VI não são afetados (nenhuma mecânica muda).

## Clarifications

### Session 2026-07-24

- Q: Mesmo token de sessão abrindo o link numa segunda aba/dispositivo com a conexão antiga viva — quem fica com o assento? → A: **A última conexão assume**; a anterior é derrubada (recupera aba zumbi sem suporte manual).
- Q: Sem a rolagem de ordem inicial (038+), qual a ordem de turno nesta fatia? → A: **Ordem de entrada na sala** (host = 1º); a rolagem do 038 substitui depois.
- Q: UI otimista no cliente remetente ou esperar a confirmação do host? → A: **Pessimista**: o remetente só reflete o efeito quando o comando aceito volta pela difusão. UI otimista fica como mitigação futura de latência (D-020).
- Q: Nome duplicado no lobby mínimo é permitido? → A: **Nome livre, cor única por sala** — a cor é o identificador visual único (§12.5).

## Escopo desta fatia

Fundação que faz **dois ou mais clientes, em dispositivos diferentes, jogarem a MESMA partida**:

- Criar sala (host) e entrar por link (convidado), **sem conta** — identidade = token de sessão + nome/cor (D-019).
- **Host-autoritativo**: cliente envia COMANDO (carregando o `playerId` do remetente); host valida pelos gates já existentes do motor, aplica o reducer puro e **difunde o comando aceito** (não o snapshot); cada cliente aplica localmente (reducer determinístico → convergência).
- **Persistência do snapshot** do `GameState` a cada comando aceito; snapshot completo lido **só ao entrar e ao reconectar**. Reload/reconexão pelo mesmo link não perde a partida (§11.4, princípio VII).
- **Desconexão de qualquer jogador → pausa global**; host desconectado → pausa indefinida, sem transferência (§11.3 / D-016). Status de desconectados visível (§12.3).

### Fora do escopo (viram specs 038+)

| Item | Destino |
|---|---|
| Lobby rico: lista de presença em tempo real, kick pelo host, rolagem de ordem inicial, seleção rica de token visual (§12.5) | 038+ (Lobby & Sala) |
| Roteamento de telas (home → sala → partida → fim) | 038+ (Roteamento) |
| Leilão dos bens do falido-ao-banco (§9.2) | 038+ |
| Notificações/modais roteados por cliente (cada jogador vê só o que lhe cabe) | 038+ |
| Espectadores, chat, histórico de partidas, contas/perfis | Fora do v1 (SRS §16) |

Esta fatia inclui apenas o **mínimo de sala** para a fundação ser testável ponta a ponta: criar sala, entrar com nome+cor, host inicia com 2+ jogadores. Toda a experiência rica de lobby fica no 038+.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dois dispositivos, uma partida (Priority: P1)

Nikolas cria uma sala no notebook e manda o link para um amigo, que abre no celular. Cada um escolhe nome e cor, o host inicia a partida e, a partir daí, **toda ação de um aparece na tela do outro**: rolagem de dados, compra, construção, trade — a partida é uma só, vista de dois lugares.

**Why this priority**: é a razão de existir do M3. Sem dois clientes convergindo sobre o mesmo estado, nenhuma outra fatia do multiplayer (lobby, resiliência, roteamento) tem onde se apoiar.

**Independent Test**: abrir a sala em dois navegadores/dispositivos, jogar uma sequência de turnos alternados e verificar que ambos exibem estado idêntico após cada ação.

**Acceptance Scenarios**:

1. **Given** ninguém tem sala, **When** o host cria uma sala, **Then** recebe um link único compartilhável e ocupa o primeiro assento com o nome e a cor que escolheu.
2. **Given** uma sala criada e ainda não iniciada, **When** um convidado abre o link, escolhe nome e cor disponível, **Then** ocupa um assento — sem cadastro, e-mail ou senha (D-019).
3. **Given** sala com 2+ jogadores, **When** o host inicia a partida, **Then** todos os clientes carregam o mesmo estado inicial e veem o primeiro turno.
4. **Given** partida em andamento, **When** o jogador do turno ativo age no seu dispositivo (ex.: rola dados e compra a propriedade), **Then** todos os demais clientes refletem o resultado idêntico (posição, saldo, dono) sem recarregar a página.
5. **Given** partida em andamento, **When** o convidado envia um comando válido (é seu turno), **Then** o host valida pelos gates existentes do motor, aplica e difunde — e o próprio remetente vê o efeito confirmado.
6. **Given** um comando **inválido** pelas regras existentes (ex.: comprar sem saldo, agir fora do turno), **When** ele chega ao host, **Then** é rejeitado como no-op: nenhum estado muda em nenhum cliente e nada é difundido (mesmo padrão de comando inválido do motor).
7. **Given** sala com 8 jogadores, **When** um nono tenta entrar pelo link, **Then** a entrada é recusada com mensagem clara (sala cheia, §11.1).

---

### User Story 2 - Reload/reconexão sem perda (Priority: P2)

No meio da partida, o amigo dá F5 sem querer (ou o navegador cai). Ao reabrir **o mesmo link no mesmo dispositivo**, ele volta direto para **o seu assento**, com a partida exatamente no ponto em que estava — nenhuma propriedade, carta ou saldo perdido.

**Why this priority**: princípio VII é não-negociável — "frustração por queda de internet é falha do produto". É também o que o snapshot persistido existe para garantir (§11.4). Sem isso, a US1 é uma demo frágil.

**Independent Test**: com partida em andamento em dois clientes, forçar reload em um deles e verificar que retorna ao assento com estado idêntico ao do outro cliente.

**Acceptance Scenarios**:

1. **Given** partida em andamento, **When** um convidado recarrega a página e reabre o mesmo link com o mesmo token de sessão, **Then** re-anexa ao **mesmo assento** e recebe o snapshot completo do estado atual — a partida continua sem perda (§11.4).
2. **Given** partida em andamento, **When** o **host** recarrega a página e volta pelo mesmo link/token, **Then** reassume o assento **e a autoridade**: recarrega o snapshot, volta a validar/difundir comandos e a partida retoma.
3. **Given** um cliente que perdeu comandos difundidos (ex.: rede instável durante a difusão), **When** ele detecta a lacuna na sequência de comandos, **Then** se recupera lendo o snapshot atual — convergindo de volta sem intervenção do usuário.
4. **Given** partida pausada há horas (ou dias), **When** os jogadores reabrem seus links, **Then** a partida retoma do ponto exato — não há timeout de sessão nem expiração da partida em andamento (§11.3).
5. **Given** um token de sessão desconhecido abrindo o link de uma partida **já iniciada**, **When** tenta entrar, **Then** é recusado com mensagem clara — não há novos assentos após o início (§11.2) e espectadores estão fora do v1 (§16).

---

### User Story 3 - Pausa global por desconexão (Priority: P3)

Durante a partida, a internet do amigo cai. **Para todos**, o jogo pausa na hora, com aviso de quem desconectou. Quando ele volta, a partida retoma sozinha do ponto em que parou. Se quem caiu foi o host, a partida fica pausada esperando — indefinidamente se preciso.

**Why this priority**: comportamento obrigatório do §11.3/D-016 e a metade "proteção" do princípio VII. Depende da US1 (precisa haver partida sincronizada para pausar) e complementa a US2 (reconexão).

**Independent Test**: derrubar a conexão de um cliente (fechar aba/desligar rede) e verificar pausa + status em todos os demais; reconectar e verificar retomada automática.

**Acceptance Scenarios**:

1. **Given** partida em andamento, **When** qualquer jogador desconecta, **Then** a partida **pausa automaticamente para todos** e cada cliente exibe quem está desconectado (§11.3, §12.3).
2. **Given** partida pausada por desconexão, **When** qualquer cliente tenta enviar um comando de jogo, **Then** o comando é rejeitado — nenhum estado avança durante a pausa.
3. **Given** partida pausada por desconexão, **When** prazos de jogo estavam correndo (ex.: cronômetro soft-close de leilão, janela de reação de 10s), **Then** esses prazos **congelam** e retomam do ponto ao despausar — ninguém perde janela de decisão por causa da pausa.
4. **Given** partida pausada, **When** o desconectado reconecta (mesmo link + token), **Then** a partida **retoma automaticamente** para todos, sem ação manual do host.
5. **Given** o **host** desconectado, **Then** a partida pausa **indefinidamente** aguardando o host — **não há transferência de host** (§11.3, D-020) — e os convidados veem o status.
6. **Given** um jogador desconectado, **Then** suas propriedades, cartas e saldo permanecem **intactos** durante toda a pausa (D-016) — nada vai ao banco.

---

### User Story 4 - Integridade: ninguém age pelos outros (Priority: P4)

Um jogador tecnicamente habilidoso tenta forjar comandos como se fosse outro jogador (hoje o motor aceita o `playerId` de quem chamar — `store.ts:262` / item 17 da auditoria). Com a fundação no ar, **todo comando carrega a identidade real do remetente** e o host rejeita qualquer comando cujo `playerId` não corresponda ao assento de quem enviou.

**Why this priority**: pré-requisito de confiança do multiplayer competitivo, e decisão travada pela D-020 ("identidade nos comandos"). Vem depois de US1–US3 porque só é observável com o transporte funcionando — mas é inegociável para sair da fatia.

**Independent Test**: injetar comando com `playerId` de outro jogador a partir de um cliente e verificar rejeição sem efeito de estado.

**Acceptance Scenarios**:

1. **Given** partida em andamento, **When** o host recebe um comando cujo `playerId` declarado **não corresponde** à sessão/assento do remetente, **Then** rejeita sem aplicar nem difundir — o estado de nenhum cliente muda.
2. **Given** partida em andamento, **When** chega comando de uma sessão que não ocupa assento na sala, **Then** é descartado.
3. **Given** ações legítimas fora do próprio turno (ex.: lance em leilão, resposta a proposta de trade, carta de reação), **When** o remetente age **pelo próprio** `playerId`, **Then** o comando é aceito normalmente — a checagem de identidade não restringe além do que os gates do motor já permitem.

---

### Edge Cases

- **Mesmo token em duas abas/conexões simultâneas** (link reaberto enquanto a conexão antiga segue viva): a **última conexão assume o assento** e a anterior é derrubada (Clarifications). A troca de conexão do mesmo token NÃO conta como desconexão para fins de pausa (FR-006a).
- **Difusão vs. persistência fora de ordem**: host aplica o comando mas falha ao persistir o snapshot (ou vice-versa) — o sistema deve garantir que um cliente que entre/reconecte nunca receba estado **mais novo** que o do fluxo de comandos que passará a receber (sem "buracos" entre snapshot e sequência).
- **Comando em trânsito no instante da pausa**: comando enviado antes da desconexão ser detectada e recebido depois — deve ser rejeitado pela regra de pausa (US3-2), não aplicado "atrasado".
- **Host fecha a aba no meio de uma resolução pendente** (dívida, leilão, modal de compra): ao reconectar, o snapshot restaura a resolução em voo — o `GameState` serializável já carrega `resolution`/eventos autônomos (princípio VII).
- **Dois comandos concorrentes** (ex.: dois lances de leilão "ao mesmo tempo"): o host lineariza — um é aplicado primeiro, o outro é revalidado contra o estado resultante e aceito ou rejeitado pelos gates normais. Não existe merge.
- **Colisão de nome/cor no lobby mínimo**: cor é **única por sala** (obrigatória — §12.5 exige identidade visual única); **nome é livre**, duplicata permitida (Clarifications).
- **Sala nunca iniciada e abandonada**: sem partida, não há snapshot a preservar — salas não iniciadas podem expirar (retenção definida no plan; nada no SRS exige preservá-las).

## Requirements *(mandatory)*

### Functional Requirements

**Sala e identidade (D-019, §11.1–11.2)**

- **FR-001**: O sistema MUST permitir criar uma sala e gerar um **link único** compartilhável; quem cria é o **host** da sala. A sala suporta de 2 a 8 jogadores (§11.1).
- **FR-002**: Qualquer pessoa com o link MUST conseguir entrar na sala **antes do início da partida**, sem conta/e-mail/senha (D-019), escolhendo **nome** e **cor** antes de ocupar o assento. A **cor é única por sala** (identidade visual única, §12.5); o **nome é livre** (duplicata permitida). A escolha rica de token visual fica para o lobby do 038+.
- **FR-003**: Na primeira entrada, o cliente MUST gerar e guardar no dispositivo um **token de sessão** (UUID em `localStorage`, D-019). A associação assento↔token vive no estado da sala (lado servidor); o `GameState` NÃO ganha PII — segue só com ids de jogador.
- **FR-004**: Reabrir o link com um token de sessão já associado MUST re-anexar o jogador ao **mesmo assento**, antes ou depois do início da partida (reconexão, §11.4).
- **FR-005**: Após o início da partida, o sistema MUST recusar entrada de tokens desconhecidos, com mensagem clara (§11.2; espectadores fora do v1, §16). Sala cheia (8) também recusa com mensagem (§11.1).
- **FR-006**: O host MUST poder **iniciar a partida** com 2+ jogadores presentes (§11.1). Ao iniciar, o estado inicial da partida é criado e persistido como primeiro snapshot, e todos os clientes o carregam. A **ordem de turno é a ordem de entrada na sala** (host = 1º) — a rolagem de ordem inicial pertence ao 038+ e substituirá este default.
- **FR-006a**: Se o mesmo token de sessão abrir uma **nova conexão** (segunda aba/dispositivo), a **última conexão assume o assento** e a anterior é derrubada. A troca de conexão do mesmo token MUST NOT ser tratada como desconexão do jogador (não dispara pausa, FR-016).

**Autoridade e transporte de comandos (D-020)**

- **FR-007**: Todo comando de jogo MUST carregar o **`playerId` do remetente**, e o host MUST rejeitar comandos cujo `playerId` não corresponda ao assento da sessão remetente (anti-spoof — fecha `store.ts:262` / item 17 da auditoria).
- **FR-008**: O cliente **host** é a **única autoridade**: MUST validar cada comando exclusivamente pelos **gates já existentes do motor** (ex.: `validateTrade`, `canAcquire`, guards de resolução) e aplicar o **reducer puro inalterado**. Esta spec NÃO cria caminho de validação novo nem altera regra (princípio I) — o motor M1 não muda.
- **FR-009**: Comando inválido MUST ser um **no-op**: não aplica, não difunde, não altera estado de nenhum cliente (mesmo padrão de comando inválido já usado pelo motor).
- **FR-010**: O host MUST difundir a cada aceitação **o comando aceito** — não o snapshot do estado (Refinamento D-020 de 2026-07-24) — com **número de sequência** monotônico por partida; cada cliente aplica os comandos **na ordem da sequência** com o mesmo reducer determinístico, convergindo para estado idêntico.
- **FR-011**: O comando aceito difundido MUST carregar **todo resultado não-determinístico já resolvido pelo host** (valores de dados rolados, carta sacada, timestamps de `now`), de modo que a aplicação em cada cliente seja 100% determinística. O RNG e o relógio permanecem injetáveis via `ctx` — apenas o host os executa.
- **FR-012**: Um cliente que detectar **lacuna na sequência** de comandos recebidos MUST se recuperar automaticamente lendo o snapshot atual (sem intervenção do usuário).

**Persistência de snapshot (§11.4, princípio VII)**

- **FR-013**: Após cada comando aceito, o host MUST persistir o **snapshot completo do `GameState`** (JSON serializável) junto com o número de sequência do último comando aplicado. A persistência é **upsert da linha da partida** (última versão) — não há log de eventos/histórico de comandos persistido no v1 (D-020).
- **FR-014**: O snapshot completo MUST ser lido do armazenamento **somente** em dois momentos: **ao entrar** na partida e **ao reconectar** (Refinamento D-020) — o fluxo normal se alimenta só da difusão de comandos.
- **FR-015**: Reload acidental (F5) de qualquer cliente — inclusive o host — MUST recuperar a partida no estado atual via snapshot (§11.4). O host que retorna **reassume a autoridade**.

**Pausa e resiliência (§11.3, D-016, princípio VII)**

- **FR-016**: Desconexão de **qualquer jogador** durante a partida MUST pausar a partida **para todos**, com o status de desconectado visível a todos no HUD (§12.3) e mensagem informando quem caiu (§11.3).
- **FR-017**: Durante a pausa, comandos de jogo MUST ser rejeitados e **prazos em voo** (cronômetro soft-close de leilão, janela de reação de 10s) MUST congelar, retomando do ponto ao despausar.
- **FR-018**: A partida MUST retomar **automaticamente** quando o desconectado reconectar (§11.3). **Não há timeout**: a pausa pode durar indefinidamente sem qualquer perda (§11.3, princípio VII).
- **FR-019**: Se o desconectado for o **host**, a partida MUST pausar indefinidamente aguardando o host — **sem transferência de host** (§11.3, D-020, SRS §16).
- **FR-020**: Nenhum jogador desconectado perde nada: propriedades, cartas, saldo e posição permanecem **intactos** durante a pausa (D-016).

### Key Entities

- **Room (Sala)**: a unidade de encontro dos jogadores. Atributos-chave: identificador/link único (a credencial de acesso, D-019), referência ao assento do host, status do ciclo de vida (aguardando jogadores → em partida → pausada → encerrada), conjunto de assentos ocupados. Relaciona-se com 1 Snapshot (a partida) e N Players.
- **Player/Session (Jogador/Sessão)**: um assento na sala. Atributos-chave: `playerId` (o mesmo id serializável que o `GameState` já usa), token de sessão associado (a chave de reconexão — nunca entra no `GameState`), nome exibido, cor, flag de host, status de conexão (conectado/desconectado). A associação assento↔token vive na sala, não no estado de jogo.
- **Command (Comando)**: uma intenção de ação de jogo em trânsito. Atributos-chave: `playerId` do remetente (identidade verificável, FR-007), tipo (uma das ações já existentes do motor), payload da ação, **resultados não-determinísticos resolvidos** (dados/carta/timestamp — só quando aceito, FR-011), número de sequência (só quando aceito, FR-010). Não é persistido — existe no transporte (D-020: sem log de eventos).
- **Snapshot**: a fotografia persistida da partida. Atributos-chave: o `GameState` completo serializado (JSON — já 100% serializável, princípio VII), número de sequência do último comando aplicado, referência à Room, momento da última atualização. Uma linha por partida (upsert, FR-013).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dois jogadores em dispositivos diferentes completam uma partida inteira (do início ao fim de jogo) sem nenhuma dessincronização observável — após cada comando difundido, o estado dos dois clientes é **idêntico** (comparação do `GameState` serializado).
- **SC-002**: Uma ação executada em um cliente aparece refletida nos demais em **menos de 1 segundo** (p95) em conexão doméstica típica.
- **SC-003**: Reload (F5) no meio da partida retorna o jogador ao seu assento com estado íntegro em **menos de 5 segundos**, em **100%** das tentativas — zero perda de propriedades/cartas/saldo (princípio VII).
- **SC-004**: Ao derrubar a conexão de qualquer jogador, todos os demais clientes exibem a pausa e o status do desconectado em **menos de 5 segundos**; a reconexão retoma a partida automaticamente **sem nenhuma ação manual** dos demais.
- **SC-005**: **100%** dos comandos com `playerId` forjado (não correspondente à sessão remetente) são rejeitados sem qualquer efeito de estado (fecha o item 17 da auditoria).
- **SC-006**: O tráfego do fluxo normal é **por comando** (ordem de dezenas–centenas de bytes por ação), e o snapshot completo só trafega em entrada/reconexão — mantendo ~25 partidas simultâneas de 8 jogadores dentro do free tier do Supabase (Refinamento D-020).
- **SC-007**: O motor permanece intacto: a suíte existente (359 testes) segue verde e **nenhum arquivo de regra** em `src/game` tem comportamento alterado por esta feature (princípio I; casca, não regra).

## Assumptions

- **Ordem inicial dos jogadores**: a rolagem de ordem inicial ficou para o lobby rico (038+); nesta fatia a ordem de turno é a **ordem de entrada na sala** (Clarifications, FR-006).
- **Sem UI otimista nesta fatia** (Clarifications): o cliente remetente aguarda o comando aceito voltar pela difusão antes de refletir o efeito. D-020 lista UI otimista como mitigação **futura** de latência; SC-002 já cobre a meta de responsividade.
- **Snapshot é upsert, não histórico**: uma linha por partida, sobrescrita a cada comando (D-020: "sem log de eventos"). Replay/histórico de partidas está fora do v1 (§16).
- **Free tier do Supabase é o alvo de custo** (Refinamento D-020); o gotcha operacional da pausa do projeto após ~7 dias de inatividade é aceito no MVP (restore manual) e não é requisito desta spec resolver.
- **Infra Supabase (schema/RLS/Realtime) nasce nesta spec** no mínimo necessário para FR-001–FR-020; o desenho técnico (tabelas, canais, políticas) pertence ao `plan.md`, não a esta spec.
- **Notificações/modais continuam globais** nesta fatia (como no single-client hoje); o roteamento por cliente (cada jogador ver só os próprios prompts) é dependência registrada para 038+ — sem ele, prompts privados (ex.: carta para a mão, §12.4) aparecem para todos, limitação **aceita e temporária** desta fatia.
- Jogadores têm conectividade intermitente mas funcional; não há requisito de jogo offline.
