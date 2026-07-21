# Feature Specification: Endurecimento de identidade de transporte — o servidor decide quem é quem

**Feature Branch**: `worktree-042-identidade-de-transporte`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "Endurecimento de identidade de transporte — `supabaseTransport.ts` ainda confia no token auto-declarado do payload (MVP). Já flagado como dívida explícita no D-033/D-034, saiu de escopo da 041 de propósito. É o maior risco de segurança do projeto hoje."

**Depende de**: spec [037](../037-sala-online-estado-sincronizado/spec.md) (a porta `Transport`, o host autoritativo e o anti-spoof que esta spec passa a apoiar em dado confiável), spec [038](../038-partida-online-jogavel/spec.md) (perspectiva de jogador local, escada de entrada por link, kick no lobby), spec [041](../041-resiliencia-de-sessao/spec.md) (contrato executável da porta, presença/takeover, `durableWrites`, reentrada por código)

**Regra de origem**: SRS §10.3, §11.2, §11.4 e a nova §11.5; princípios VI (privacidade estratégica de cartas) e VII (resiliência de sessão). Três regras **novas** entram por ADR escrita antes desta spec: [D-042](../../docs/adr/D-042-identidade-de-transporte-atestada-pelo-servidor.md) (identidade atestada pelo servidor), [D-036](../../docs/adr/D-036-acesso-a-sala-autorizado-no-servidor.md) (acesso à sala autorizado no servidor) e [D-037](../../docs/adr/D-037-estado-por-perspectiva-a-mao-nao-trafega.md) (estado por perspectiva — revoga a D-030). SRS bumped para v1.8.

---

## Por que esta spec existe

A spec 037 escreveu o anti-spoof e o provou (`tests/net/antispoof.test.ts`): todo comando carrega o `playerId` do remetente, e o host o confere contra o assento da conexão. A lógica está certa. O que ela consulta, não: no transporte de produção, "o assento da conexão" é **o token que veio dentro do payload** (`supabaseTransport.ts:94-97`), enviado pelo próprio remetente (`supabaseTransport.ts:183`). A verificação compara uma afirmação do atacante com outra afirmação do mesmo atacante.

E o dado que fecharia o ciclo é público entre os jogadores: `Seat.token` (`room.ts:50`) viaja na sala inteira, difundida a todos (`host.ts:65`) e persistida numa linha que qualquer um lê. Quem está na mesa conhece o token de todo mundo. Declarar o token do vizinho **e** o `playerId` dele passa nas duas checagens do `host.ts:89-91` e joga por ele — comprar, vender, aceitar troca, declarar falência. O comentário de MVP no cabeçalho do adapter (`supabaseTransport.ts:17-19`) chama isso de "resta o endurecimento"; na prática, é a defesa inteira apoiada no que o atacante escolhe.

Seis furos, todos com linha de código, todos fechados só do lado do servidor — porque é o cliente que está sob suspeita.

**1. Eu jogo por você.** Identidade auto-declarada no payload de `submit`, mais o token alheio publicado na sala. Não exige nada além do devtools aberto.

**2. Eu falo pela mesa.** `accepted`, `room` e `rejected` são escrita livre no canal (`supabaseTransport.ts:106-111`, `:190-215`). Um cliente modificado difunde um "comando aceito" com `seq` arbitrário e **todos os peers o aplicam** (`client.ts:137`), porque a única coisa que o cliente checa é a sequência. O host nem fica sabendo: ele não escuta a própria difusão. A partida diverge da autoridade sem sinal nenhum — e a recuperação por lacuna (FR-012 da 037) não ajuda, porque o `seq` forjado *fecha* a lacuna em vez de abrir. É o furo mais destrutivo dos seis e o menos visível.

**3. Eu derrubo você.** A chave de presença é auto-declarada na criação do canal (`supabaseTransport.ts:79-81`). Anunciar presença com a chave alheia e sair provoca `markDisconnected` no host (`host.ts:138`) e **pausa a mesa** em nome de quem está ali; anunciar e ficar mascara a ausência real de alguém. Como não há timeout de desconexão (§11.3), a pausa forjada não se resolve sozinha.

**4. Seu código de reentrada é meu.** A D-033 criou o código como credencial que reanexa um assento de qualquer aparelho, e registrou o risco de ele viajar como o token já viajava — com a frase de que isso **não deve servir de desculpa para adiar** o endurecimento. Ele está em `Seat.reentryCode`, na sala difundida a todos. Quem anota o código do vizinho toma o assento dele quando quiser, de qualquer dispositivo, sem timeout e sem revogação possível.

**5. Sua sala é pública.** As policies de `rooms` são `using (true)` para select, insert e update (`supabase/migrations/0001_rooms_snapshots.sql:43-45`), e a chave que as destranca **está no bundle** — por desenho, é pública. Qualquer pessoa que abra o site enumera todas as salas, lê o snapshot de qualquer partida em curso e **sobrescreve ou zera** a linha de uma partida alheia, sem nunca ter tido o link. Não é preciso estar numa partida para explorar este.

**6. Sua mão é minha.** O `GameState` trafega completo: baralho embaralhado no primeiro snapshot, carta sacada dentro do `resolved` de cada comando difundido. O §10.3 promete privacidade de mão; a D-030 aceitou entregar isso só na apresentação porque filtrar por destinatário exigiria um caminho privado por jogador. Esta spec constrói esse caminho por outro motivo (o furo 1) — e a partir daí continuar difundindo a mão de todos vira escolha, não limitação.

Nenhum dos seis é fechável no cliente. Todos exigem a mesma peça que falta: uma identidade que o participante **não escolhe** e que o servidor sabe verificar.

---

## Clarifications

### Session 2026-07-26

- Q: A janela de reação (Diplomacia/Bunker Fiscal) só abre quando o alvo possui a carta, e `state.resolution` é público — com a mão oculta, a janela denuncia a posse. Como resolver? → A: Aceitar o vazamento, documentado. A janela continua abrindo apenas para quem tem a carta; a posse de uma carta de **reação** vaza no instante do ataque, momento em que ela está a um clique de ser revelada. O resto da mão segue oculto. Alternativas descartadas: abrir a janela para todo alvo (põe um clique a mais em evento comum e muda o significado do modal no §12.2) e pré-declaração automática (tira a decisão do momento — seria mudança de regra, com ADR própria).
- Q: "Só a autoridade grava a linha da sala" trava a recuperação do próprio anfitrião que perdeu o aparelho. Onde mora a reanexação por código? → A: No servidor, para **todos** os assentos. Uma função no servidor valida link + código e refaz o vínculo assento↔identidade, seja o assento do anfitrião ou de um convidado — um caminho único, sem caso especial, e a mesa nunca fica sem autoridade recuperável.
- Q: O que fazer com as salas já persistidas no projeto vivo, cujo formato de assento é incompatível com identidade atestada? → A: Apagar na própria migration (`delete from public.rooms`). É pré-lançamento, não há partida real; a aplicação no projeto vivo pede confirmação explícita antes de rodar.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ninguém joga por mim (Priority: P1) 🎯 MVP

Estou numa partida com pessoas que conheço, e uma delas abre o devtools. Ela não consegue rolar os dados no meu lugar, comprar com o meu dinheiro, aceitar uma troca em meu nome nem me declarar falido — nem sabendo tudo o que o cliente dela recebeu sobre mim.

**Why this priority**: é o furo que nomeia a spec e o único que transforma a partida numa disputa sobre quem abriu o console. Todos os outros dependem da mesma peça: uma identidade que o servidor emite e verifica.

**Independent Test**: com a chave pública do bundle, montar um cliente que envia um comando declarando o assento de outro jogador — e observar que ele é recusado antes de chegar à autoridade, sem efeito no estado de ninguém.

**Acceptance Scenarios**:

1. **Given** uma partida em curso, **When** uma sessão envia um comando em nome de assento que não é o dela, **Then** a mensagem é recusada **pelo servidor**, não chega à autoridade e não altera estado nenhum.
2. **Given** que conheço o token, o código e o `playerId` de outro jogador, **When** uso todos eles num comando forjado, **Then** nada disso me ajuda — a identidade que vale não é declarada em campo algum.
3. **Given** um comando legítimo meu, **When** eu o envio, **Then** ele é aceito e difundido normalmente: a checagem é de identidade, não bloqueio extra.
4. **Given** que perdi o aparelho e reentro por código (§11.4), **When** reanexo o assento, **Then** a identidade atada àquele assento passa a ser a nova, e a anterior deixa de agir por ele.
5. **Given** que quem perdeu o aparelho foi o **anfitrião**, **When** ele reentra pelo código do próprio assento, **Then** ele reassume a autoridade — a reanexação é validada pelo servidor e não depende de já se estar de posse dela.
6. **Given** um convidado reentrando por código, **When** ele apresenta link + código, **Then** ele passa pelo **mesmo** caminho de servidor do anfitrião — não há dois fluxos de reanexação para manter.

---

### User Story 2 - Ninguém fala pela mesa (Priority: P1)

O que aparece na minha tela como "aconteceu na partida" só pode ter vindo de quem está conduzindo a partida. Ninguém injeta uma jogada que nunca foi aceita, publica uma sala que não existe, me expulsa fingindo ser o anfitrião nem me derruba fingindo minha queda.

**Why this priority**: a injeção de comando aceito corrompe a mesa inteira de forma silenciosa e irrecuperável — pior resultado possível num modelo host-autoritativo, porque ninguém tem como perceber que aconteceu (é o mesmo argumento da D-034 para a divergência de persistência).

**Independent Test**: com a chave pública, tentar difundir um `accepted` com sequência plausível no canal de uma sala em curso — e observar a recusa no servidor, com as telas dos jogadores inalteradas.

**Acceptance Scenarios**:

1. **Given** partida em curso, **When** uma sessão que não é a autoridade tenta difundir um comando aceito, **Then** o servidor recusa a escrita e nenhum cliente aplica nada.
2. **Given** o lobby aberto, **When** alguém que não é o anfitrião tenta publicar a sala ou recusar a entrada de terceiro, **Then** a escrita é recusada.
3. **Given** que estou conectado, **When** outra sessão tenta anunciar a minha desconexão, **Then** ela não consegue: a partida não pausa em meu nome.
4. **Given** que alguém caiu de verdade, **When** outra sessão tenta anunciar a presença dele para mascarar a ausência, **Then** ela não consegue: a mesa pausa como deve.
5. **Given** que reabri a página com a partida em curso, **When** a sessão anterior ainda não caiu, **Then** o takeover continua valendo — a última conexão assume e a anterior não conta como desconexão (FR-006a da 041).

---

### User Story 3 - Minha partida não é pública (Priority: P1)

A partida que estou jogando não pode ser lida, listada nem apagada por quem nunca recebeu o link. Quem recebeu o link e ainda não sentou vê que a sala existe, seu status e quem já está nela — e nada além disso.

**Why this priority**: é o único furo que não exige estar numa partida para ser explorado, e o que carrega o pior resultado absoluto — apagar a linha de uma partida alheia em curso. Fechá-lo também é pré-requisito da US5: não adianta parar de difundir a mão se o snapshot inteiro é legível por qualquer um.

**Independent Test**: com a chave pública do bundle, tentar listar salas, ler a linha de uma sala em curso sem ter assento e sobrescrevê-la — três tentativas, três recusas.

**Acceptance Scenarios**:

1. **Given** a chave pública do frontend, **When** alguém pede a lista de salas, **Then** não recebe nenhuma: não existe leitura sem id.
2. **Given** que conheço o id de uma sala em que não tenho assento, **When** peço o estado da partida, **Then** recebo apenas a prévia — existência, status e quem sentou — sem estado de jogo e sem segredo de assento.
3. **Given** que tenho o id de uma sala alheia, **When** tento gravar qualquer coisa na linha dela, **Then** a escrita é recusada: só a autoridade da sala grava.
4. **Given** que recebi o link e ainda não sentei, **When** abro a tela de entrada, **Then** ela funciona como hoje — vejo a sala, peço assento, e recebo a recusa correta se estiver cheia, com cor tomada ou já iniciada.
5. **Given** que fui removido do lobby pelo anfitrião (FR-024 da 038), **When** tento ler o estado depois disso, **Then** deixo de conseguir: perdi o assento, perdi o acesso.
6. **Given** uma escrita atrasada de um host que recarregou, **When** ela chega depois de uma mais nova, **Then** continua sendo descartada pela guarda de monotonia (D-034) — o endurecimento não pode desligar o que a 041 construiu.

---

### User Story 4 - Meu código de reentrada é meu (Priority: P2)

O código que reanexa o meu assento é meu segredo. Eu consigo lê-lo quando quiser, no lobby e durante a partida. Ninguém mais o recebe — nem quem está na mesa comigo, nem quem tem o link.

**Why this priority**: a D-033 registrou explicitamente que o código entra na mesma classe de exposição do token e que isso **não deve servir de desculpa** para adiar o endurecimento. É credencial portadora, sem expiração e sem revogação: quem a tem toma o assento quando quiser.

**Independent Test**: numa sala com dois jogadores, inspecionar tudo o que chega ao cliente de um deles e não encontrar o código do outro — nem na sala publicada, nem na prévia, nem no estado lido.

**Acceptance Scenarios**:

1. **Given** uma sala com vários assentos, **When** inspeciono o que chega ao meu cliente, **Then** encontro o meu código e nenhum outro.
2. **Given** que sou o dono do assento, **When** olho a tela no lobby ou na partida, **Then** vejo meu código onde a 041 o colocou — a redação não pode custar a funcionalidade que motivou a D-033.
3. **Given** que anotei meu código e troquei de aparelho, **When** apresento link + código, **Then** reanexo normalmente (§11.4).
4. **Given** um assento alheio, **When** procuro qualquer credencial dele no que recebi, **Then** não há nenhuma — nem código, nem token de sessão: a identidade que vale não é transmissível.

---

### User Story 5 - Minha mão é minha (Priority: P2)

As cartas que guardei na mão não chegam ao cliente de ninguém além do meu. Quem quiser saber o que eu tenho vai ter que perguntar — e a resposta não está no devtools dele. Os outros veem o que a regra manda: quantas cartas eu tenho.

**Why this priority**: é a promessa do §10.3 e do princípio VI, hoje entregue só na apresentação. Depende inteiramente da US1 (o caminho privado por assento) e da US3 (o snapshot deixar de ser público), e por isso vem depois delas — mas é a razão pela qual o §10.3 do SRS deixa de ter asterisco.

**Independent Test**: partida de três jogadores; cada um saca cartas; inspecionar o estado do cliente de um deles e não conseguir nomear nenhuma carta dos outros dois nem a próxima do baralho.

**Acceptance Scenarios**:

1. **Given** que saquei uma carta para a mão, **When** o comando é aceito e difundido, **Then** os outros clientes registram que eu guardei **uma carta** — sem qual — e o meu registra qual.
2. **Given** que entro ou reconecto no meio da partida, **When** leio o estado, **Then** recebo a minha mão inteira, a mão alheia como contagem e o baralho como contagem.
3. **Given** o estado do meu cliente, **When** eu o inspeciono, **Then** não consigo nomear carta de outro jogador nem prever a próxima carta do baralho.
4. **Given** que jogo uma carta da mão, **When** a jogada é aceita, **Then** ela se torna pública e todos a veem — a privacidade é de posse, não de efeito.
5. **Given** o log da partida (§12.4), **When** um saque acontece, **Then** ele narra o fato público para a mesa e o detalhe só para o dono — o log não pode vazar pelo caminho de trás.
6. **Given** a mesma sequência de comandos aceitos, **When** todos os clientes a aplicam, **Then** eles convergem no estado **público** — a divergência existe apenas nos slots declarados ocultos.
7. **Given** que sou o anfitrião, **When** olho o estado do meu cliente, **Then** eu vejo tudo — é a exceção conhecida do §10.3, e ela está escrita, não escondida.
8. **Given** que sou alvo de uma carta ofensiva e tenho Diplomacia, **When** a janela de reação abre, **Then** a mesa fica sabendo que tenho **uma carta de reação** — vazamento aceito e documentado (Clarifications) — e continua sem saber o resto da minha mão.
9. **Given** que a mão alheia me chega como contagem, **When** olho o contador de outro jogador, **Then** ele me diz **quantas** cartas — nunca de que raridade (§10.3: os outros veem apenas a quantidade).

---

### Edge Cases

- **O anfitrião perde o aparelho.** A escrita da sala é exclusiva de quem ocupa o assento de anfitrião; se essa identidade se perde, ninguém consegue gravar — nem o dono legítimo, ao voltar por código. Resolvido nas Clarifications: a reanexação por código passa a ser **função no servidor**, única para todos os assentos, que valida link + código e refaz o vínculo sem exigir a autoridade que se está tentando recuperar. Sem isso, o remédio da D-033 criaria a doença que ela veio curar.
- **A credencial de sessão expira ou falha ao renovar no meio da partida.** Não pode virar silêncio: é queda de conexão, e a tela já sabe dizer isso desde a 041 (`'reconnecting'`).
- **A sessão anônima é perdida** (dados do navegador limpos, aba anônima encerrada). É o caso da D-033: token novo, assento recuperável por código. O que muda é que a perda agora também custa a autoridade, se for o anfitrião.
- **Sessões anônimas não habilitadas no projeto Supabase.** O app precisa dizer isso de forma acionável, como já faz com a migration ausente (`describeInfraError`) — e não travar numa tela em branco.
- **Usuários anônimos acumulados.** Cada navegador que entra numa sala cria um. Precisa de rotina de limpeza, ou o projeto acumula lixo indefinidamente.
- **Salas persistidas antes desta spec.** O vínculo de identidade e o formato de assento mudam; não há jogadores reais para preservar.
- **Jogador eliminado que reabre o link** (D-029) — continua acompanhando, continua sem travar a mesa.
- **Duas abas do mesmo jogador.** Mesma identidade atestada nas duas: takeover, não desconexão (FR-006a da 041).

---

## Requirements *(mandatory)*

### Functional Requirements

**Identidade atestada (US1)**

- **FR-001**: Toda sessão MUST obter uma identidade **emitida pelo servidor** antes de qualquer tráfego de sala. Sem identidade emitida, nenhuma mensagem é enviada nem aceita.
- **FR-002**: A identidade do remetente de qualquer mensagem MUST ser derivada do **transporte**, nunca de campo do payload. Nenhum caminho em `src/net/**` pode restar lendo identidade de conteúdo enviado pelo remetente.
- **FR-003**: Comando enviado em nome de assento que não é o do remetente atestado MUST ser recusado **no servidor**, antes de alcançar a autoridade.
- **FR-004**: A autoridade MUST continuar recusando comando cujo `senderId` declarado não corresponda ao assento do remetente atestado (a checagem da 037 permanece — o que muda é que ela passa a se apoiar em dado que o remetente não escolhe).
- **FR-005**: O vínculo assento↔identidade MUST ser reatribuível pela reentrada por código (D-033) por um caminho **no servidor**, único para todos os assentos — inclusive o do **anfitrião** —, que valide link + código e refaça o vínculo sem depender de a autoridade estar operante. A reanexação deixa de ser tratada pela autoridade (`host.handleJoinRequest`); pedir assento **novo** continua sendo com ela.
- **FR-006**: O token de sessão auto-declarado MUST deixar de existir como identidade — inclusive como campo da sala publicada e persistida.

**Quem pode falar pela mesa (US2)**

- **FR-007**: Comando aceito, sala publicada e recusa de entrada MUST ser escrevíveis **apenas** pela identidade que ocupa o assento de anfitrião; escrita de qualquer outra origem MUST ser recusada no servidor.
- **FR-008**: (des)conexão de um assento MUST ser anunciável apenas por aquele assento.
- **FR-009**: O pedido de assento MUST permanecer aberto a qualquer sessão que apresente o id da sala — o link continua sendo a credencial de entrada (§11.2, D-019).
- **FR-010**: O takeover (FR-006a da 041) MUST continuar valendo sob identidade atestada: a mesma identidade reabrindo conexão não conta como desconexão.

**Acesso ao dado da sala (US3)**

- **FR-011**: A linha da sala MUST NÃO ser legível por sessão sem assento nela.
- **FR-012**: A **prévia** da sala — existência, status e quem já sentou — MUST ser obtenível por quem apresenta o id, sem estado de partida e sem segredo de assento.
- **FR-013**: Listar salas MUST ser impossível: não há leitura sem id.
- **FR-014**: A escrita da linha da sala MUST ser exclusiva da autoridade; a **criação** é a única exceção — quem cria a sala é o anfitrião dela.
- **FR-015**: O canal da sala MUST ser privado, com quem lê e quem escreve cada classe de mensagem decidido no servidor.
- **FR-016**: A guarda de monotonia do snapshot (D-034) MUST continuar valendo após o endurecimento.
- **FR-017**: Perder o assento (kick, FR-024 da 038) MUST implicar perder o acesso de leitura ao estado.

**Segredo de assento (US4)**

- **FR-018**: O código de reentrada MUST NÃO trafegar para quem não é o dono do assento — nem na sala difundida, nem na prévia, nem no estado lido por terceiro.
- **FR-019**: O dono MUST continuar lendo o próprio código no lobby e durante a partida, como a 041 entregou.

**Estado por perspectiva (US5)**

- **FR-020**: O comando difundido MUST carregar apenas o **fato público**; o detalhe que identifica carta de um jogador MUST ser entregue somente ao dono, pelo caminho privado dele.
- **FR-021**: O estado lido ao entrar ou reconectar MUST ser filtrado por perspectiva **no servidor**: mão própria completa, mão alheia como contagem, baralho como contagem. Filtrar no cliente não satisfaz este requisito.
- **FR-022**: Slot oculto MUST ser explícito no estado, e os reducers MUST tratá-lo como opaco em vez de assumir conteúdo.
- **FR-023**: A convergência MUST ser preservada sobre a parte pública: a mesma sequência de comandos aceitos leva todos os clientes ao mesmo estado público.
- **FR-024**: O log (§12.4, D-032) MUST NÃO expor a terceiros detalhe de carta ausente da perspectiva deles.
- **FR-025**: A UI MUST continuar exibindo contadores públicos (§12.3) e a própria mão sem ramo condicional novo por modo de jogo.
- **FR-026**: A autoridade MUST continuar validando jogada de carta pelos gates já existentes do motor — esta spec não cria caminho de validação novo nem altera regra (princípio I).
- **FR-027**: O slot oculto MUST carregar **apenas a existência** da carta: nem identidade, nem efeito, nem **raridade** — o §10.3 dá aos outros a quantidade, e só ela.
- **FR-028**: A janela de reação (Diplomacia/Bunker Fiscal) MUST continuar abrindo só para quem possui a carta. O vazamento resultante — a mesa fica sabendo que aquele jogador tem **uma carta de reação** — é aceito e documentado (Clarifications, D-037, §10.3), e MUST NÃO se estender ao resto da mão: nada além da existência daquela reação é revelado.

**Contrato e operação**

- **FR-029**: O contrato executável da porta (`tests/net/conformance.test.ts`) MUST ganhar os casos de identidade forjada, escrita de autoridade forjada e presença forjada, rodando nos **dois** adapters — semântica de porta que vive só em comentário é semântica que diverge.
- **FR-030**: Salas persistidas antes desta spec MUST ser descartadas pela própria migration (`delete from public.rooms`), sem migração de dados. A aplicação no projeto vivo MUST pedir confirmação explícita antes de rodar.
- **FR-031**: Sem Supabase configurado, o app MUST continuar rodando single-player (nenhum boot multiplayer forçado).
- **FR-032**: Falha ao obter ou renovar a identidade MUST virar mensagem acionável ou estado de reconexão visível — nunca tela parada em silêncio.

### Key Entities

- **Sessão atestada**: a identidade de um participante, emitida e verificada pelo servidor. Estável enquanto o navegador a guardar; não transmissível — conhecê-la não permite usá-la. Substitui o token de sessão como identidade de assento; o token do `localStorage` some ou vira detalhe local sem valor de identidade.
- **Assento**: ganha vínculo com a sessão atestada e **perde** o token público. Mantém o código de reentrada, que passa a ser **segredo do dono** — presente no dado da sala do lado servidor, ausente de tudo o que chega a terceiros.
- **Prévia da sala**: o recorte público de uma sala, obtenível por quem tem o id: existência, status, quem já sentou. Não contém estado de partida nem segredo. É o que sustenta a escada de entrada da 038 sem abrir a linha.
- **Caminho privado do assento**: por onde a autoridade entrega a um jogador o que é só dele (o detalhe da carta sacada) e por onde aquele jogador — e só ele — envia comandos e anuncia presença. É a mesma peça que atesta identidade e que viabiliza a perspectiva.
- **Perspectiva**: o recorte do estado que um participante tem direito de ver. Público para todos; mão própria para o dono; tudo para a autoridade (exceção conhecida do §10.3).
- **Slot oculto**: marca explícita, dentro do estado, de "existe algo aqui que não é meu". Carrega só a existência — sem identidade, efeito ou raridade (FR-027). Não é ausência de dado: é dado declarado opaco, e é o que permite a convergência pública conviver com a divergência privada.
- **Reanexação validada no servidor**: o caminho que troca a identidade atada a um assento mediante link + código (D-033). Vive no servidor porque o caso que mais importa — o anfitrião que perdeu o aparelho — é justamente aquele em que a autoridade não existe para autorizar nada. Vale para todos os assentos; pedir assento **novo** continua sendo com a autoridade.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um roteiro de ataque executado com a **chave pública do bundle** contra o projeto Supabase real tenta os seis vetores e é recusado nos seis: (1) comando em nome de assento alheio; (2) difusão de comando aceito por quem não é a autoridade; (3) publicação de sala ou recusa de entrada forjada; (4) presença forjada em nome de outro assento; (5) leitura ou gravação da linha de uma sala sem assento nela; (6) listagem de salas. **6/6 recusados** — e o roteiro fica no repo, executável de novo a cada mudança.
- **SC-002**: Numa partida de três jogadores com cartas na mão, a inspeção do estado do cliente de um deles não permite nomear nenhuma carta dos outros dois — nem a raridade — nem a próxima carta do baralho. Única exceção medida: a carta de reação exposta por uma janela aberta (FR-028).
- **SC-003**: Uma partida completa entre navegadores reais (lobby → partida → fim) roda sem regressão funcional, incluindo reentrada por código a partir de um terceiro dispositivo e pausa/retomada por desconexão.
- **SC-004**: O caminho quente do comando de jogo não ganha salto de servidor adicional: a mediana do intervalo entre enviar um comando e ver o aceito não piora mais que 20% frente à medição feita antes da mudança.
- **SC-005**: O linter do Supabase deixa de sinalizar policies permissivas demais (`0024`) em `rooms` — o aviso que a migration 0001 documenta como deliberado passa a ser regressão.
- **SC-006**: A suíte de conformidade roda os casos novos de identidade, autoridade e presença forjadas nos **dois** adapters, verde.
- **SC-007**: Busca em `src/net/**` não encontra nenhum ponto que derive identidade de remetente a partir de conteúdo enviado pelo remetente.
- **SC-008**: O comentário de limitação de MVP no cabeçalho de `supabaseTransport.ts` some — junto com o código que o justificava.

---

## Assumptions

- **Sessões anônimas habilitadas** no projeto Supabase, e o free tier comporta o volume do MVP. Sessão anônima não é conta: não há cadastro, e-mail, senha nem perfil entre partidas — a D-019 continua valendo na promessa que importa (entra quem tem o link).
- **Pré-lançamento**: não há jogadores reais nem partidas em curso a preservar. Salas persistidas são descartáveis, e a compatibilidade com o formato antigo não é requisito.
- **O anfitrião é confiável por construção** enquanto a autoridade rodar no navegador dele (D-020). Esta spec fecha jogador contra jogador e estranho contra sala; não fecha o anfitrião. Está escrito no §10.3, na D-042 e na D-037 — a leitura ingênua ("agora está tudo privado") seria pior que a limitação.
- **O id da sala não é enumerável na prática** (vem de UUID). O pedido de assento continua aberto a quem apresenta o id, porque é assim que um convidado entra; o que ele deixa de conseguir é ler qualquer coisa antes de ser aceito.
- **A verificação de política roda contra infra real.** Policy de banco e de canal não é demonstrável com fake — o fake prova o adapter, não a regra que roda em produção. Aplicar as migrations no projeto vivo é passo desta spec, com confirmação explícita antes de cada aplicação.

---

## Fora de escopo

| Item | Por quê / destino |
|---|---|
| Contas, e-mail, perfis persistentes | v2 por decisão explícita (D-019). Sessão anônima não abre essa porta. |
| Autoridade de servidor (motor em Edge Function) | A D-020 já a prevê como troca de transporte, não reescrita, e para quando houver tração. Esta spec não a exige nem a impede. |
| Privacidade da mão contra o **anfitrião** | Exige baralho selado com compromisso criptográfico ou autoridade de servidor. Caminho registrado na D-037 e no §10.3; dimensionado, não feito. |
| Rate limiting, anti-abuso, expulsão por spam | Superfície distinta (disponibilidade, não identidade). Nada aqui a bloqueia. |
| Conluio entre jogadores, chat, espectadores | Fora do v1 (SRS §16). Privacidade de dado não resolve combinação fora do jogo. |
| Rotação ou revogação do código de reentrada | A D-033 decidiu que ele não expira e não é revogável; esta spec o torna secreto, não temporário. |
| Limpeza automatizada de salas velhas e de sessões anônimas acumuladas | Rotina de operação, não de identidade. Registrado nos Edge Cases para não sumir. |
