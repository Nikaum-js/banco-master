# Implementation Plan: Endurecimento de identidade de transporte

**Spec**: [spec.md](./spec.md) · **Modelo**: [data-model.md](./data-model.md) · **Contratos**: [contracts/transport.md](./contracts/transport.md), [contracts/policies.md](./contracts/policies.md)

**Data**: 2026-07-26 · **ADRs de origem**: [D-042](../../docs/adr/D-042-identidade-de-transporte-atestada-pelo-servidor.md), [D-036](../../docs/adr/D-036-acesso-a-sala-autorizado-no-servidor.md), [D-037](../../docs/adr/D-037-estado-por-perspectiva-a-mao-nao-trafega.md) · **SRS**: v1.8 (§10.3, §11.5)

---

## Summary

Seis furos, uma peça que falta: uma identidade que o participante não escolhe. A sessão anônima do Supabase entrega essa peça, e a partir dela tudo o mais é consequência — quem escreve onde, quem lê o quê, e o que sequer sai da casa da autoridade.

Seis movimentos:

1. **Identidade atestada** — `signInAnonymously` antes de qualquer tráfego; `Seat.token` vira `Seat.uid`; o campo de identidade some do payload.
2. **Topologia de tópicos** — o canal único vira três classes (`lobby`, `play`, `s:<uid>`), cada uma com autorização própria no servidor. O remetente passa a vir do **nome do tópico**.
3. **A escada de entrada sai do canal** — pedir assento e reanexar por código viram funções no servidor, que carimbam a identidade; a regra de sala continua no host, exceto o casamento do código.
4. **A tabela fecha** — nada de `select` direto; leitura por função (prévia e snapshot), escrita só da autoridade, tabela limpa na migration.
5. **Perspectiva** — o snapshot passa a ser gravado em duas partes (público + segredos por assento) e o saque vira não-determinismo gravado, exatamente como `rng`/`now` já são. Slot oculto é `null` com comprimento preservado.
6. **A prova** — roteiro de ataque contra o projeto real, seis vetores, e a conformidade cobrando o mesmo contrato dos dois adapters.

O que **não** acontece: nenhum salto HTTP entra no caminho do comando de jogo (o tópico por assento é WebSocket, como hoje), e nenhuma regra de jogo muda. A única coisa que a SQL passa a saber sobre o domínio é comparar um código de reentrada com o de um assento.

---

## Technical Context

**Linguagem/stack**: TypeScript estrito, React 19, Zustand, Supabase (Realtime + Postgres + Auth anônima). Sem dependência nova — `@supabase/supabase-js` já está no `package.json`.

**Onde o trabalho acontece**: `src/net/**` (o grosso), `supabase/migrations/` (uma migration densa), uma fatia cirúrgica de `src/game/` (`cards/*`, `turn/types.ts`, `commands.ts`, `turnMachine.ts` para o novo port) e `scripts/` (o roteiro de ataque).

**Raio de alcance no motor** (medido, não estimado): 7 arquivos tocam `.hand` (`cards/draw.ts`, `cards/hand.ts`, `cards/reacao.ts`, `ui/cards/handView.ts`, `ui/panels/playersView.ts`, `ui/modals/activeModal.ts`, `ui/DebugLogger.tsx`); 5 ações de comando tocam identidade de carta (`play-hand-card`, `discard-card`, `confirm-card-reveal`, `respond-reaction`, `choose-card-shortcut`). O desenho do D7/D8 foi escolhido para que `hand.length` continue sendo a contagem — é o que impede a redação de vazar para `playersView`, para o HUD e para os ~360 testes de motor.

**Infra viva**: projeto `Banco master` (`edppdqrkqljhjkbyjvsz`, região sa-east-1, ACTIVE_HEALTHY). Sessões anônimas precisam ser habilitadas no painel — é config, não migration. Aplicação de qualquer migration no projeto pede confirmação explícita (FR-030).

**Testes**: `vitest` headless para tudo o que é lógica e contrato; `fakeSupabase.ts` estendido para simular recusa por política (não substitui a prova real); `scripts/attack.ts` contra o projeto vivo para SC-001; `@playwright/test` para o E2E de partida real.

**Restrição de determinismo**: o novo port de saque entra pelo mesmo caminho de `rng`/`now` — gravado no host, reproduzido no cliente. Nada de relógio ou aleatoriedade real dentro dos testes.

---

## Constitution Check

| Princípio | Conformidade |
|---|---|
| **I. SRS é verdade absoluta** | Nada nasce aqui: §10.3 e a nova §11.5 foram bumpadas para v1.8 **antes**, apoiadas em D-042/D-036/D-037. A única regra que muda de comportamento (privacidade de distribuição) passou por ADR que revoga a anterior. |
| **II. Discovery antes de código** | Spec escrita, quatro decisões de produto travadas com o usuário antes dela, três ambiguidades resolvidas no clarify, ADRs registradas antes deste plano. |
| **III. Tesouro precisa impactar** | Não aplicável — nenhum efeito de carta muda. O que muda é quem **vê** a carta. |
| **IV. Catch-up é discreto** | Não aplicável. |
| **V. Sem dependência de cooperação** | Reforçado: a reanexação por código deixa de passar pelo host (Clarifications) — ninguém depende de o anfitrião estar vivo e disposto para recuperar o próprio assento. |
| **VI. Privacidade de cartas** | É metade da spec. Sai da garantia de apresentação e vira garantia de distribuição, com dois resíduos escritos (anfitrião; janela de reação) em vez de um asterisco genérico. |
| **VII. Resiliência de sessão** | Preservado peça por peça: takeover, pausa por causa, monotonia do snapshot e reentrada por código continuam valendo — a reentrada, inclusive, fica **mais** resiliente por não depender da autoridade. |

---

## Project Structure

### Documentation (this feature)

```
specs/043-identidade-de-transporte/
├── spec.md
├── plan.md               ← este arquivo
├── data-model.md         ← Seat.uid, slot oculto, snapshot em duas partes, Resolved.draws
├── contracts/
│   ├── transport.md      ← delta da porta `Transport` + o que a conformidade cobra
│   └── policies.md       ← tópicos, políticas e funções do servidor (o contrato do lado de fora)
└── tasks.md
```

### Source Code (repository root)

```
src/net/
├── session.ts               ~ getSessionToken() morre; entra a sessão atestada (uid + garantia de auth)
├── supabaseClient.ts        ~ ensureSession() antes de tudo; realtime.setAuth(); RPCs de entrada
├── transport.ts             ~ porta: `token` → `uid`; onSubmit entrega o uid do TÓPICO; parte privada do aceito
├── supabaseTransport.ts     ~ três canais; identidade do tópico; sem token no payload; leitura por RPC
├── localTransport.ts        ~ paridade: o hub passa a recusar o que o servidor recusaria
├── host.ts                  ~ assina o tópico de cada assento; divide o aceito em público/privado; reanexação sai
├── client.ts                ~ aplica o público do `play` e o privado do próprio tópico
├── room.ts                  ~ Seat.uid; seatByUid; reattachByCode migra para o servidor (fica o espelho de teste)
├── roomSession.ts           ~ escada de entrada por RPC; fase de reentrada intacta
├── perspective.ts           + NOVO: divide estado em público + segredos; monta a perspectiva de um uid
└── ui/                      ~ SessionBadge/LobbyScreen: código de reentrada só do dono

src/game/
├── turn/turnMachine.ts      ~ TurnCtx ganha o port de saque
├── turn/types.ts            ~ mão e deck aceitam slot oculto (null)
├── cards/draw.ts            ~ saca pelo port; slot oculto no lugar de carta alheia
├── cards/hand.ts            ~ remoção tolerante a slot oculto (um helper, um lugar)
└── cards/reacao.ts          ~ nada muda de regra; findReactionCard ignora slot oculto

src/net/recorder.ts          ~ Resolved ganha `draws`; recording/replay do saque

supabase/migrations/
└── 0003_attested_identity.sql  + uid nos assentos, coluna de segredos, políticas novas,
                                  RPCs de entrada/leitura, limpeza da tabela

scripts/
└── attack.ts                + os seis vetores contra o projeto vivo (SC-001)

tests/net/                   ~ conformidade estendida; suítes de perspectiva e de identidade
tests/game/                  ~ ajustes pontuais onde o saque passa a vir do port
```

**Structure Decision**: nada de camada nova. O endurecimento entra **atrás das portas que já existem** — `Transport` continua sendo a única fronteira que host e cliente conhecem, e é por isso que o adapter local segue provando o mesmo contrato sem falar com o Supabase.

---

## Decisões de design

### D1 — A identidade é a sessão anônima, e ela vem antes de tudo

`supabaseClient.ts` ganha `ensureSession()`: pega a sessão existente, e se não houver, `signInAnonymously()`. Depois, `supabase.realtime.setAuth()` — obrigatório para canal privado. Só então o transporte é montado. `session.ts` perde `getSessionToken()`: o token de `localStorage` deixa de existir, porque o supabase-js já persiste a sessão ali e essa persistência é o que sobrevive ao F5.

O nome muda junto: `Seat.token` → `Seat.uid`, `seatByToken` → `seatByUid`, `Transport.token` → `Transport.uid`. Não é cosmética — no vocabulário deste projeto "token" já significa a **peça visual** do jogador (§12.5), e manter a palavra para duas coisas foi o que deixou "identidade" parecer resolvida quando não estava.

**Consequência aceita:** perder os dados do navegador passa a custar a sessão anônima, exatamente como custava o token. É o caso da D-033, e o remédio já existe.

### D2 — Três classes de tópico, cada uma com uma pergunta diferente para o servidor

Um canal só não consegue responder "quem pode escrever isto" com granularidade, porque a política do Realtime decide por **tópico**. Então o canal vira três:

| Tópico | Carrega | Quem lê | Quem escreve |
|---|---|---|---|
| `room:<id>:lobby` | sala publicada, recusa de entrada, aviso de reanexação | qualquer sessão que apresente o id (o link é a credencial de entrada) | só o anfitrião |
| `room:<id>:play` | comando aceito (parte pública) | só quem tem assento | só o anfitrião |
| `room:<id>:s:<uid>` | comando do jogador, presença do assento, parte **privada** do aceito | o dono e o anfitrião | o dono e o anfitrião |

O anfitrião assina um tópico de assento por jogador (até 8) — canais são multiplexados na mesma conexão WebSocket, então o custo é de canal, não de conexão.

**Por que `lobby` separado de `play`:** o recém-chegado precisa receber a sala publicada e a recusa **antes** de ter assento. Se isso viajasse no mesmo tópico do jogo, "ler o jogo" seria acessível a qualquer portador do link — que é exatamente o que a D-036 fecha.

### D3 — O remetente vem do nome do tópico

`room:<id>:s:<uid>` só é escrevível por `auth.uid() = <uid>`, e a política que garante isso é uma comparação de string no servidor. O host assina o tópico **sabendo de quem ele é**, então `onSubmit` entrega `(cmd, fromUid)` com `fromUid` vindo do binding do canal — não do payload, que deixa de ter campo de identidade.

É o coração da spec e cabe em uma frase: **a identidade não viaja, ela é o endereço**. Nenhum código nosso precisa verificar assinatura, e não há segredo novo para vazar.

### D4 — A escada de entrada sai do canal e vira duas funções no servidor

O host não pode assinar o tópico de um assento que ainda não existe, então o pedido de assento não tem como chegar por tópico atestado. Duas funções (`security definer`) resolvem, cada uma por um motivo:

- **`request_seat(room_id, name, color, piece)`** — carimba `auth.uid()`, registra o pedido e o difunde ao anfitrião pelo tópico de lobby (broadcast a partir do banco). **Não valida regra de sala**: cheia, cor tomada, peça tomada e já iniciada continuam sendo decisão do host, com o código que já existe (`joinRoom`). A função só atesta quem pediu.
- **`reattach_by_code(room_id, code)`** — valida o código contra os assentos, regrava o vínculo assento↔identidade e avisa o lobby. **Esta escreve a linha**, e precisa: o caso que mais importa é o anfitrião que perdeu o aparelho, e nele não existe autoridade para autorizar coisa nenhuma.

**Duplicação assumida, e o seu limite:** a única regra de domínio que passa a existir em SQL é "código igual ao do assento → troca o vínculo". Nenhuma outra. O espelho em `room.ts` continua existindo e continua testado — é o que o adapter local exercita e o que mantém a conformidade honesta nos dois lados.

### D5 — Ninguém faz `select` na tabela; leitura é função

Duas funções de leitura, e a tabela sem política de `select` nenhuma:

- **`room_preview(room_id)`** → id, status, e os assentos **sem segredo** (nome, cor, peça, conectado). É o que sustenta a escada de entrada da 038 sem abrir a linha, e é o que torna a enumeração impossível: não há leitura sem id.
- **`read_snapshot(room_id)`** → o estado na **perspectiva de quem chamou** (D6). Recusa quem não tem assento.

Escrita continua na tabela, com política: `update` só para quem ocupa o assento de anfitrião; `insert` para qualquer sessão autenticada (quem cria vira o anfitrião); `delete` para ninguém, como já é hoje. A guarda de monotonia do `seq` (0002) continua intacta — é `before update` e não sabe quem chamou.

### D6 — O snapshot é gravado em duas partes, e por isso a SQL não precisa conhecer o jogo

Filtrar perspectiva com cirurgia de `jsonb` significaria a política do banco conhecer o esquema do `GameState` e o do log (040) — acoplamento que quebra na primeira carta nova. Em vez disso, a **autoridade** grava o que já sabe separar:

```
rooms.game     → estado PÚBLICO, já redigido (mãos e decks como slots ocultos)
rooms.secrets  → { "<uid>": { hand: [...] }, "deck": { acaso: [...], tesouro: [...] } }
```

`read_snapshot` monta a resposta por **seleção de chave**: público + `secrets->auth.uid()` para um jogador; público + `secrets` inteiro para o anfitrião. Zero conhecimento de domínio no servidor, e o split fica em `src/net/perspective.ts`, onde é TypeScript testável.

### D7 — Slot oculto é `null`, e o comprimento é preservado

`hand: CardId[]` vira `hand: (CardId | null)[]`; os decks, idem. `null` significa "há uma carta aqui e ela não é minha".

A escolha é sobre o que **não** quebra: `hand.length` continua sendo a contagem que o §12.3 exibe, `playersView` e o HUD continuam lendo o que liam, e os ~360 testes de motor continuam válidos porque na perspectiva da autoridade nunca existe `null`. O preço é um helper — remover uma carta de uma mão que pode conter ocultos remove o id se ele estiver lá, e um oculto caso contrário. Um lugar, `cards/hand.ts`, e nenhuma chamada nova nos pontos de uso.

### D8 — O saque vira não-determinismo gravado, no mecanismo que já existe

Descoberta que simplifica a spec inteira: `Resolved` hoje só carrega `rng` e `now` porque **as cartas saem de decks já embaralhados no estado** (`recorder.ts:4-6`). Ou seja, o vazamento da mão não está na difusão — está na **ordem do deck** que todo mundo lê no primeiro snapshot.

Com o deck oculto, o cliente que aplica um saque tira um `null` e não sabe o que fazer. A resposta não é um caminho novo: é o caminho que a 037 já provou. `TurnCtx` ganha um port de saque; o host o consome pelo `recordingCtx` e grava o valor em `Resolved.draws`; o cliente o consome pelo `replayCtx` e recebe o valor gravado. Carta de efeito imediato é pública e vai como id; carta que vai para a mão é privada e vai como `null` no tópico público e como id no tópico do dono.

A regra que o reducer aplica é uma só, igual nos dois lados: **valor não-nulo, carta conhecida; valor nulo, slot oculto.**

### D9 — O comando aceito tem parte pública e parte privada

O host difunde em `play` o aceito com `draws` redigido, e envia ao tópico do dono o **mesmo** aceito com `draws` completo. O dono recebe as duas cópias e aplica a privada; qualquer um dos dois caminhos alimenta o detector de lacuna que já existe (`client.ts:85`), então uma parte privada que não chega vira ressincronização por snapshot — que, para o dono, já contém os segredos dele. Não há estado novo de espera: o mecanismo de recuperação da 037 é o mesmo.

### D10 — O descarte da 4ª carta viaja pelo canal privado; jogar não

`play-hand-card` carrega `cardId` e é público por natureza — jogar uma carta é revelá-la. `discard-card` também carrega `cardId`, e esse é privado: descartar não revela nada no SRS, e publicar o id entregaria uma carta que o jogador nunca jogou. O tratamento é o do D9 — a ação difundida em `play` leva o id redigido, e o tópico do dono leva a íntegra.

`confirm-card-reveal`, `choose-card-shortcut` e `respond-reaction` não carregam identidade de carta e seguem públicos.

### D11 — A janela de reação continua exatamente como está

`draw.ts:130` e `reacao.ts:62` só abrem a janela quando o alvo **possui** a carta, e `state.resolution` é público. Com a mão oculta, a janela vira o único ponto onde a posse de uma carta específica vaza.

Fica como está, por decisão travada no clarify. Consertar exigiria abrir a janela para todo alvo de ofensiva e todo pagador de imposto — um clique a mais num evento comum, e o modal do §12.2 deixando de significar o que significa. O vazamento é a existência daquela reação, no instante em que ela está a um clique de ser revelada. Está escrito na spec (FR-028), na D-037 e no §10.3.

### D12 — Paridade: o hub local passa a recusar o que o servidor recusaria

A lição da 041 (`transport.ts:11-14`: `takeover` acabou implementado só no adapter local) vale invertida aqui — o risco agora é o oposto, uma garantia que só existe no Supabase e some nos testes. Então o `localTransport` ganha as mesmas recusas: escrever no tópico de outro assento, difundir aceito sem ser a autoridade, anunciar presença alheia. E o `fakeSupabase` ganha a simulação das políticas.

Nada disso substitui a prova real (D13). O que o hub prova é que **o host e o cliente se comportam bem quando o servidor recusa** — o que a política de fato recusa, só o Postgres pode dizer.

### D13 — O roteiro de ataque é entrega, não anexo

`scripts/attack.ts` monta um cliente com a chave pública do bundle e tenta os seis vetores contra o projeto vivo, imprimindo recusa ou sucesso para cada um. Fica no repo e roda de novo a cada mudança de política — porque política de banco não tem tipo, não tem teste unitário e quebra em silêncio.

Critério: **6/6 recusados** (SC-001). O roteiro precisa de uma sala de teste ativa; ele cria a sua e a limpa no fim.

### D14 — Ordem de implementação: seis movimentos, cada um verde

1. **Identidade** — sessão anônima, `uid` no lugar de `token`, sem mudar topologia. Verde: suíte atual inteira, com o adapter local seguindo idêntico.
2. **Topologia + políticas** — três tópicos, migration com políticas e RPCs, tabela limpa. Verde: conformidade estendida nos dois adapters; ataque 4/6 (perspectiva ainda aberta).
3. **Escada de entrada por RPC** — `request_seat`, `reattach_by_code`, `roomSession` reapontado. Verde: `reentry.test.ts`, `lobby.test.ts`, `kick.test.ts`.
4. **Segredo de assento** — código de reentrada fora do que trafega; UI do dono intacta. Verde: teste novo de redação + `SessionBadge`.
5. **Perspectiva** — `perspective.ts`, snapshot em duas partes, port de saque, slot oculto. Verde: motor inteiro + suíte de perspectiva; ataque 6/6.
6. **Prova** — roteiro de ataque, E2E de partida real, medição de latência (SC-004).

Cada movimento é commitável sozinho. O 5 é o mais caro e o único que toca o motor; ele vem depois de tudo o que pode ser provado sem ele, de propósito.

### D15 — O que esta spec não faz, apesar de encostar

- **Não move o motor para o servidor.** A autoridade continua no navegador do anfitrião (D-020), e é por isso que ele continua vendo tudo.
- **Não sela o baralho.** Fechar o anfitrião exige compromisso criptográfico; está dimensionado na D-037 e fora daqui.
- **Não introduz contas.** Sessão anônima não tem cadastro, e-mail nem perfil entre partidas (D-019 intacta).
- **Não trata abuso nem rate limiting.** Superfície de disponibilidade, não de identidade.
- **Não limpa usuários anônimos acumulados.** Rotina de operação; registrado nos Edge Cases da spec para não sumir.

---

## Complexity Tracking

| Violação aparente | Por que é necessária | Alternativa mais simples, e por que foi recusada |
|---|---|---|
| Regra de domínio em SQL (casamento do código de reentrada) | O anfitrião que perdeu o aparelho não tem autoridade para se autorizar; sem caminho no servidor, a mesa fica irrecuperável — a doença que a D-033 veio curar | Manter a reanexação no host: funciona para convidados e falha exatamente no caso que motivou a decisão |
| Três tópicos onde havia um | A política do Realtime autoriza por tópico; "quem escreve o quê" não é expressável dentro de um canal só | Um canal com validação no cliente: é o estado atual, e é o cliente que está sob suspeita |
| Snapshot em duas colunas | Filtrar perspectiva sem duplicar esquema de domínio dentro do banco | Cirurgia de `jsonb` na política: acopla o servidor ao esquema do `GameState` e do log, e quebra na primeira carta nova |
| `null` dentro de `hand`/deck | Preservar `hand.length` como contagem pública mantém intactos `playersView`, HUD e os ~360 testes de motor | Campo `handCount` separado: duplica a verdade e obriga toda leitura a escolher qual acreditar |
