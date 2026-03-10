# Feature Specification: Polimento & Lançamento — o jogo termina, cabe na tela e vai ao ar

**Feature Branch**: `worktree-044-polimento-lancamento`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "spec 4 — Polimento & Lançamento (não iniciado): animações, acessibilidade, tela de fim de jogo, deploy + CI de verdade para produção, smoke E2E completo."

**Depende de**: spec [036](../036-simulacao-partidas/spec.md) (smoke E2E e simulação seedada — a base que este CI estende), spec [037](../037-sala-online-estado-sincronizado/spec.md) (sala, transporte, snapshot, migrations não aplicadas), spec [038](../038-partida-online-jogavel/spec.md) (roteamento home → sala → partida → fim; sem revanche, FR-027), spec [040](../040-log-eventos-tipado/spec.md) (log tipado — a frase que a região viva vai anunciar), spec [041](../041-resiliencia-de-sessao/spec.md) (pausa com causa — o que a telemetria conta), spec [042](../042-fronteira-de-erro-da-interface/spec.md) (identificador de ocorrência — o que o monitoramento de erro carrega)

**Regra de origem**: SRS §9.5, §12.2, §12.3 e o M4 do [MILESTONES](../../docs/MILESTONES.md). As regras **novas** entram por ADRs escritas antes desta spec: [D-038](../../docs/adr/D-038-fim-de-jogo-tem-classificacao-e-resumo.md) (fim de jogo tem classificação e resumo), [D-039](../../docs/adr/D-039-acessibilidade-aa-no-caminho-de-jogo.md) (AA no caminho de jogo; paisagem é a orientação de jogo), [D-040](../../docs/adr/D-040-telemetria-minima-anonima.md) (telemetria mínima anônima), [D-041](../../docs/adr/D-041-publicacao-em-vercel-com-gate-verde.md) (publicação na Vercel com gate verde). SRS bumped para v1.9 (§9.5, §12.2, §12.6, §12.7, §12.8).

**Paralelismo**: esta spec toca o **motor** em quatro campos e três pontos (`GameState` ganha ordem de eliminação, rodada e os instantes de início e fim; `advanceSeat` conta a rodada; a falência registra a ordem; o fecho da partida grava o instante final) — e mais nada. Nenhuma regra de jogo muda: não há aluguel diferente, carta nova, valor recalibrado ou condição de vitória alterada. O resto vive na **apresentação** (`src/game/ui/**`, `src/boards/**`, `src/index.css`), numa **porta nova de telemetria** (`src/telemetry/**`, isolada como a `Transport` é), e **fora do código** (`.github/workflows/**`, `vercel.json`, `supabase/migrations/**`, runbook).

---

## Por que esta spec existe

O motor está fechado, a mesa online funciona, a fronteira de erro segura o que quebra. E ninguém consegue jogar.

**1. Não existe URL.** O produto é multiplayer online por decisão fundadora ([D-001](../../docs/adr/D-001-multiplayer-online-exclusivo.md)): sem hotseat, sem IA, sem modo local de verdade. Isso significa que "não estar publicado" não é um item de checklist pendente — é a diferença entre um jogo e um repositório. Hoje o único caminho para uma partida é clonar, instalar e rodar `bun run dev`, o que exclui exatamente as 7 pessoas que faltam para a mesa.

**2. E a infra viva nunca subiu.** As duas migrations do projeto (`supabase/migrations/0001_rooms_snapshots.sql`, `0002_snapshot_monotonic.sql`) **nunca foram aplicadas** — o PRD registra isso como pendência aberta desde a 037. Publicar sem elas é publicar um jogo que perde a partida no primeiro reload: sem a tabela `rooms` não há snapshot, e sem o gatilho de monotonia uma escrita atrasada regride o estado (o cenário que a 041 caçou por três dias). O deploy é a parte fácil; o lançamento é isto.

**3. A partida termina em nada.** `game/ui/GameHUD.tsx:157` mostra uma coroa, o nome do vencedor e um botão. Para o vencedor é pouco; para os outros sete é nada. Quem faliu na décima rodada não descobre se terminou em segundo ou em oitavo, e o jogo **sabe** a resposta — ele só não guarda. E não pode reconstruí-la depois: o log é bounded em 50 entradas (`game/log.ts:11`), então numa partida de 8 jogadores a primeira falência já saiu da janela antes do fim. A classificação existe enquanto a partida acontece e se perde quando ela acaba.

**4. A interface foi construída a mouse.** `src/` tem hoje **85 atributos `aria-*`**, **4 `role=`**, **zero** ocorrências de `focus-visible` ou `tabIndex`, e `prefers-reduced-motion` consultado em **7 pontos** de uma UI que é feita de animação. Não há um único modal com trap de foco — e o §12.2 lista **26 modais**, quase todos decidindo dinheiro. Um jogador que não usa mouse não perde conforto: ele não consegue comprar uma propriedade.

**5. O tabuleiro só existe em uma tela.** `.board-frame` é um quadrado travado na altura da viewport (`index.css:590`), com dois breakpoints no CSS inteiro. Em tablet paisagem os painéis laterais espremem a mesa; em celular o produto não decidiu o que faz. Não decidir significa servir uma mesa ilegível para quem abrir o link no telefone — que é como um link de jogo circula.

**6. E nada disso é vigiado.** O CI atual é bom no que cobre (lint, tipos, 350+ testes, build, simulação seedada, smoke de 10 rodadas) e não cobre nada do que esta spec entrega: não existe gate de acessibilidade, o smoke nunca chega ao fim de uma partida (ele para em 10 rodadas e confere ausência de erro), o E2E multiplayer está **fora** do CI por depender de credencial, e nenhum gate impede uma versão quebrada de ser publicada — porque não há publicação. Sem gate, tudo o que esta spec conquista regride na spec seguinte.

Um detalhe que muda a ordem do trabalho: **publicar é o único item que entrega valor sozinho**. A tela de fim de jogo melhora um produto que ninguém alcança; o deploy transforma o que já existe em algo jogável hoje à noite.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dá para jogar sem clonar o repositório (Priority: P1) 🎯 MVP

Eu mando um link para sete pessoas. Elas abrem, escolhem nome e peça, e jogam. Ninguém instala nada, ninguém precisa saber o que é `bun`.

**Why this priority**: é o único item da spec que entrega valor sozinho, e é o que destrava todos os outros — polimento de um produto inalcançável não é polimento. Inclui a dívida que trava a persistência em produção: as migrations que nunca foram aplicadas.

**Independent Test**: abrir a URL de produção em duas máquinas diferentes, criar sala, jogar alguns turnos, recarregar uma delas e verificar que a partida volta do servidor.

**Acceptance Scenarios**:

1. **Given** a versão publicada, **When** abro a URL e crio uma sala, **Then** o link funciona para quem não tem o repositório, em máquina e rede diferentes.
2. **Given** uma partida em curso na versão publicada, **When** recarrego a página, **Then** o estado volta do servidor — a persistência está de fato ativa no banco de produção.
3. **Given** uma mudança proposta, **When** ela é aberta para revisão, **Then** existe um ambiente navegável daquela versão, para jogar antes de aceitar.
4. **Given** um gate vermelho (lint, tipo, teste, simulação, acessibilidade ou partida completa), **When** a mudança chega à linha principal, **Then** ela **não** é promovida a produção.
5. **Given** uma versão publicada que se revelou ruim, **When** decido voltar, **Then** a versão anterior volta ao ar em um passo, sem reconstruir nada.
6. **Given** a versão publicada, **When** inspeciono o que foi entregue ao navegador, **Then** só há chave pública — nenhuma credencial de servidor.
7. **Given** um ambiente sem as variáveis obrigatórias, **When** a versão é construída, **Then** a construção **falha** com mensagem clara, em vez de publicar uma tela branca.

---

### User Story 2 - A partida termina em algum lugar (Priority: P1)

A última falência acontece. Todo mundo — inclusive quem caiu primeiro — vê a mesma tela: quem venceu, em que posição cada um terminou, com quanto, e quanto tempo aquilo durou.

**Why this priority**: é o fechamento do ciclo de jogo, a última lacuna funcional do produto ([D-038](../../docs/adr/D-038-fim-de-jogo-tem-classificacao-e-resumo.md)), e a única história desta spec que toca o motor — o que a torna o item de maior risco de regressão e o que deve ser feito com a suíte inteira olhando.

**Independent Test**: levar uma partida até restar um jogador e verificar, em todas as telas (inclusive as de eliminados), a mesma classificação completa, com patrimônio, propriedades, rodada da queda e duração; recarregar e verificar que a classificação é idêntica.

**Acceptance Scenarios**:

1. **Given** resta um jogador não-eliminado, **When** a partida termina, **Then** toda tela mostra a classificação completa, do 1º ao último.
2. **Given** a classificação, **When** a leio, **Then** a ordem é a inversa da eliminação: o vencedor em 1º, o último a falir em 2º, o primeiro a falir por último.
3. **Given** a classificação, **When** olho uma linha, **Then** vejo o patrimônio final, quantas propriedades aquele jogador tinha e — se foi eliminado — em que rodada caiu.
4. **Given** o resumo, **When** o leio, **Then** ele diz quantas rodadas a partida durou e quanto tempo passou entre o início e o fim.
5. **Given** fui eliminado na terceira rodada e continuei com a sala aberta, **When** a partida termina, **Then** vejo a mesma tela que todos, com minha posição.
6. **Given** a tela de fim de jogo, **When** recarrego a página, **Then** a classificação é exatamente a mesma — ela vem do estado da partida, não da memória da aba.
7. **Given** uma partida em sala, **When** ela termina, **Then** o caminho oferecido é voltar ao início e criar outra sala — não há revanche (spec 038, FR-027); em partida local, começar de novo continua disponível.
8. **Given** uma partida salva **antes** desta mudança, **When** ela é carregada, **Then** ela não quebra: os campos novos assumem valor seguro e a partida segue jogável.

---

### User Story 3 - Dá para jogar sem mouse, e a tela se explica (Priority: P1)

Eu jogo pelo teclado. Chego a cada botão na ordem em que vejo, sempre sei onde estou, o modal me recebe e me devolve, e o que acontece na mesa é anunciado — não só desenhado.

**Why this priority**: são 26 modais que decidem dinheiro (§12.2) e nenhum deles hoje prende o foco. Sem isto, um jogador que não usa mouse não perde conforto — ele não consegue comprar uma propriedade. Empata em P1 com a US2 porque é requisito de qualidade do produto que se vai publicar, não melhoria posterior.

**Independent Test**: percorrer home → lobby → partida → fim de jogo usando **apenas** teclado, com auditoria automatizada rodando em cada tela, e conferir que nenhuma decisão exige mouse e nenhuma violação séria aparece.

**Acceptance Scenarios**:

1. **Given** qualquer tela do caminho de jogo, **When** navego só pelo teclado, **Then** alcanço todo controle na ordem visual, com foco sempre visível, sem ficar preso em lugar nenhum.
2. **Given** um modal abre, **When** ele aparece, **Then** o foco vai para ele, permanece dentro dele enquanto estiver aberto e volta para o elemento que o abriu quando ele fechar.
3. **Given** um modal **informativo**, **When** aperto Esc, **Then** ele fecha.
4. **Given** um modal que **decide a partida** (compra, leilão, reação, dívida, descarte), **When** aperto Esc, **Then** ele **não** fecha — a decisão exige ação explícita ([D-039](../../docs/adr/D-039-acessibilidade-aa-no-caminho-de-jogo.md)).
5. **Given** um evento acontece na mesa, **When** ele entra no log, **Then** ele é anunciado por leitor de tela de forma educada; "sua vez" e prazo vencendo são anunciados com urgência.
6. **Given** qualquer informação da partida, **When** ela é exibida, **Then** ela não depende só de cor: posse, jogador da vez, raridade de carta e status de conexão têm segundo sinal.
7. **Given** as telas do caminho de jogo, **When** a auditoria automatizada roda, **Then** não há violação séria ou crítica, e o resultado bloqueia a publicação.
8. **Given** ícones e imagens, **When** um leitor de tela percorre a página, **Then** o que tem significado tem nome e o que é decoração está oculto.

---

### User Story 4 - A mesa cabe na tela que eu tenho (Priority: P2)

Abro o link no tablet, ou no celular deitado. O tabuleiro é legível, os painéis não engolem a mesa, e se eu estiver com o aparelho em pé o jogo me diz para girar — em vez de me servir 48 casas de 6 pixels.

**Why this priority**: link de jogo circula por telefone, e é lá que a primeira impressão acontece. Fica em P2 porque um jogador com tela pequena hoje ainda consegue jogar no desktop — a US1 e a US3 são o que ele não consegue contornar.

**Independent Test**: percorrer o caminho de jogo em 740 × 360 e em 1024 × 768, em paisagem, verificando legibilidade, ausência de rolagem horizontal e alcance de todos os controles; girar para retrato e verificar o aviso e a preservação da sessão.

**Acceptance Scenarios**:

1. **Given** um aparelho em paisagem a partir de 740 × 360, **When** abro a partida, **Then** o tabuleiro é legível e todo controle de decisão é alcançável.
2. **Given** uma tela estreita, **When** olho a mesa, **Then** os painéis laterais não cobrem o tabuleiro de forma permanente — eles se recolhem e continuam alcançáveis.
3. **Given** qualquer tela do caminho de jogo, **When** ela é exibida na largura mínima, **Then** não há rolagem horizontal.
4. **Given** um modal maior que a tela, **When** ele abre, **Then** ele rola por dentro e seus botões continuam alcançáveis.
5. **Given** o aparelho em retrato, **When** abro o jogo, **Then** vejo um aviso para girar — não a mesa espremida.
6. **Given** o aviso de retrato, **When** giro o aparelho, **Then** volto exatamente para onde eu estava, sem perder a sessão nem a partida.

---

### User Story 5 - O jogo se move com propósito — e freia quando eu peço (Priority: P2)

O dado rola, o peão anda, o dinheiro muda de mão e eu **vejo** isso acontecer. Se eu pedi menos movimento no meu sistema, tudo continua acontecendo — só que sem animação, e sem que eu perca nenhuma informação.

**Why this priority**: metade já existe (dado 3D, peão passo a passo, confete) e ninguém está bloqueado. O que falta é consistência — um vocabulário único de movimento — e o freio universal, que hoje é respeitado em 7 lugares e ignorado no resto.

**Independent Test**: com `prefers-reduced-motion` ativo, jogar uma sequência que envolva rolagem, movimento, pagamento e mudança de posse, e verificar que todo fato continua legível sem nenhuma animação; repetir sem o freio e verificar que o movimento é consistente entre superfícies.

**Acceptance Scenarios**:

1. **Given** uma mudança material na partida (dinheiro, posse, posição, construção), **When** ela acontece, **Then** há feedback visível de que aconteceu.
2. **Given** o sistema pedindo movimento reduzido, **When** qualquer transição aconteceria, **Then** ela vira troca imediata — e o fato continua legível.
3. **Given** duas superfícies diferentes animando a mesma classe de coisa, **When** comparo, **Then** duração e curva são as mesmas — o movimento vem de um vocabulário único.
4. **Given** uma animação em curso, **When** um prazo vence, um comando chega ou a partida pausa, **Then** nada disso espera a animação terminar.
5. **Given** uma decisão minha disponível, **When** a animação ainda está rodando, **Then** ela não me impede além do necessário para eu entender o que aconteceu.

---

### User Story 6 - Sabemos se as partidas terminam (Priority: P2)

Depois de publicar, a pergunta deixa de ser "funciona na minha máquina" e passa a ser "as pessoas chegam ao fim?". O produto responde isso sem saber o nome de ninguém.

**Why this priority**: é o instrumento que transforma o lançamento em aprendizado, e sem ele a US1 publica no escuro. P2 porque nenhum jogador é bloqueado pela ausência dela.

**Independent Test**: rodar uma partida completa no ambiente publicado e verificar os eventos correspondentes registrados, conferindo que nenhum deles contém nome, mão, token, código de reentrada ou id de sala em claro.

**Acceptance Scenarios**:

1. **Given** uma sala criada, uma partida iniciada, uma partida finalizada ou uma pausa, **When** o fato acontece, **Then** existe um evento correspondente registrado.
2. **Given** um evento de partida finalizada, **When** o leio, **Then** ele traz número de jogadores, rodadas e duração — e nada que identifique pessoa.
3. **Given** qualquer evento, **When** o inspeciono, **Then** não há nome de jogador, mão de cartas, token de sessão, código de reentrada nem id de sala em claro ([D-040](../../docs/adr/D-040-telemetria-minima-anonima.md)).
4. **Given** dois eventos da mesma partida, **When** os comparo, **Then** consigo correlacioná-los por um identificador derivado — sem conseguir voltar dele ao id da sala.
5. **Given** o envio de telemetria falha, **When** isso acontece, **Then** a partida não pausa, nenhum comando é bloqueado e nada é repetido.
6. **Given** nenhum destino configurado no ambiente, **When** jogo, **Then** o produto funciona inteiro e não envia nada — inclusive em desenvolvimento.
7. **Given** uma exceção contida pela fronteira de erro (spec 042), **When** ela acontece no ambiente publicado, **Then** ela chega ao monitoramento com o identificador de ocorrência que o jogador vê na tela — e sem dado privado.

---

### User Story 7 - Uma partida inteira é provada a cada mudança (Priority: P2)

Antes de qualquer versão ir ao ar, uma partida completa é jogada do começo ao fim, sozinha, na interface de verdade — e termina com a tela de classificação.

**Why this priority**: é o gate que impede tudo o que as outras histórias entregam de regredir. P2 porque o valor dele é preventivo: no dia em que entra, ele não conserta nada.

**Independent Test**: rodar o roteiro completo localmente contra a versão construída e verificar que ele chega ao fim de jogo, confere a classificação e falha se qualquer parte do caminho quebrar.

**Acceptance Scenarios**:

1. **Given** o roteiro completo, **When** ele roda, **Then** ele leva uma partida até o fim de jogo pela interface real e confere a tela de classificação.
2. **Given** o roteiro completo, **When** ele roda no gate, **Then** ele exercita a **versão construída**, não apenas o servidor de desenvolvimento.
3. **Given** uma partida online, **When** o roteiro de duas telas roda, **Then** ele cobre lobby → partida → fim, e o resultado dele conta para a promoção da produção.
4. **Given** qualquer passo do roteiro falha, **When** o gate avalia, **Then** a promoção é bloqueada e o material de diagnóstico da falha fica disponível.
5. **Given** o roteiro terminou, **When** olho o ambiente, **Then** as salas que ele criou não ficam para trás.

---

### Edge Cases

- **Todos os jogadores restantes falem no mesmo evento** (o leilão do espólio cobra de quem não tinha). A ordem de eliminação é sequencial no motor: quem é processado primeiro cai primeiro, e a classificação usa exatamente essa ordem — sem empate a inventar.
- **A partida termina numa mesa de 2 jogadores.** Classificação de duas linhas, mesma tela, sem caso especial.
- **A partida termina com todo mundo desconectado menos um.** A classificação é do estado, não da presença: quem reabrir o link depois encontra a sala encerrada (spec 037, FR-028) — o resumo é visto por quem está lá quando acontece.
- **A partida termina enquanto a mesa está pausada** (persistência indisponível, D-034). O fim de jogo é consequência de um comando aceito, e comando só é aceito com gravação durável — o fim nunca acontece "por cima" de uma pausa por persistência.
- **Snapshot antigo, sem os campos novos.** Carrega com valor seguro: sem ordem de eliminação registrada, o resumo mostra a classificação que consegue afirmar e não inventa posições.
- **Retrato durante uma partida em curso.** Girar não recarrega a página nem derruba a sessão; o aviso cobre a tela e sai quando o aparelho volta à paisagem.
- **Movimento reduzido no meio de uma animação.** A preferência passa a valer da próxima transição em diante; nenhuma animação em curso trava.
- **Telemetria com o destino fora do ar.** Envio falha em silêncio, sem repetição infinita e sem tocar a partida.
- **Duas abas do mesmo jogador.** A telemetria conta partidas, não sessões: duas abas do mesmo assento não viram duas partidas.
- **Deploy no meio de uma partida em curso.** Quem já está jogando continua com a versão que carregou; quem recarrega pega a nova. Mudança de formato de snapshot é o que quebraria isso — e por isso os campos novos desta spec são aditivos e com valor seguro.
- **Auditoria de acessibilidade sobre uma tela que depende de estado de partida.** O gate precisa alcançar as telas de decisão, não só a home — o roteiro precisa levar a interface até elas antes de auditar.

---

## Requirements *(mandatory)*

### Functional Requirements

**Fim de jogo (US2)**

- **FR-001**: Ao restar um jogador não-eliminado, toda tela DEVE apresentar a classificação completa da partida, do 1º ao último.
- **FR-002**: A classificação DEVE ser a ordem inversa de eliminação; o vencedor é o único não-eliminado (§9.5, D-038).
- **FR-003**: O estado da partida DEVE registrar a ordem de eliminação, o número da rodada e os instantes de início e de fim — determinísticos, iguais em toda tela e serializáveis (princípio VII).
- **FR-004**: Cada linha da classificação DEVE mostrar o patrimônio final (o mesmo cálculo de patrimônio líquido já usado pelo motor), a quantidade de propriedades e, para eliminados, a rodada da eliminação.
- **FR-005**: O resumo DEVE informar a duração da partida em rodadas e em tempo decorrido.
- **FR-006**: A classificação DEVE ser derivada do estado, idêntica em todas as telas e estável através de recarregamento.
- **FR-007**: Jogador eliminado que permanecer na sala DEVE ver a mesma tela de fim de jogo, com sua posição.
- **FR-008**: Em sala, a tela de fim de jogo DEVE oferecer voltar ao início e NÃO DEVE oferecer revanche (spec 038, FR-027); em partida local, DEVE oferecer começar de novo.
- **FR-009**: Snapshot gravado antes desta mudança DEVE carregar sem erro, com valor seguro para os campos novos.
- **FR-010**: A tela de fim de jogo DEVE cumprir os mesmos requisitos de acessibilidade do caminho de jogo (FR-011 a FR-022).

**Acessibilidade (US3)**

- **FR-011**: Todo controle do caminho de jogo DEVE ser alcançável e operável por teclado, na ordem visual, sem armadilha de foco.
- **FR-012**: O foco DEVE ser sempre visível, com indicador de contraste próprio, e NÃO DEVE depender apenas de cor.
- **FR-013**: Ao abrir, um modal DEVE receber o foco; enquanto aberto, DEVE mantê-lo dentro de si; ao fechar, DEVE devolvê-lo ao elemento que o abriu.
- **FR-014**: Esc DEVE fechar modal informativo e NÃO DEVE fechar modal que decide a partida (compra, leilão, reação, dívida, descarte de carta) — D-039.
- **FR-015**: Ícone ou imagem com significado DEVE ter nome acessível; elemento decorativo DEVE ser ocultado da tecnologia assistiva.
- **FR-016**: O log de eventos DEVE ser anunciado como região viva educada; "sua vez" e prazo vencendo DEVEM ser anunciados com urgência.
- **FR-017**: Texto DEVE ter contraste ≥ 4,5:1 e elemento de interface e indicador de foco ≥ 3:1.
- **FR-018**: Nenhuma informação DEVE ser transmitida apenas por cor — posse, jogador da vez, raridade de carta e status de conexão precisam de segundo sinal.
- **FR-019**: Alvos interativos do caminho de jogo DEVEM ter ao menos 24 × 24 px.
- **FR-020**: A interface DEVE permanecer funcional com zoom de até 200%.
- **FR-021**: `prefers-reduced-motion` DEVE ser respeitado em toda animação, sem que nenhuma informação exista apenas no movimento.
- **FR-022**: DEVE existir auditoria automatizada de acessibilidade cobrindo as telas do caminho de jogo — inclusive telas que só existem com partida em curso — e violação séria ou crítica DEVE bloquear a publicação.

**Responsividade (US4)**

- **FR-023**: O caminho de jogo DEVE ser utilizável em paisagem a partir de 740 × 360 px e 1024 × 768 px.
- **FR-024**: Em tela estreita, os painéis laterais DEVEM se recolher sem cobrir o tabuleiro de forma permanente, permanecendo alcançáveis.
- **FR-025**: Nenhuma tela do caminho de jogo DEVE exigir rolagem horizontal.
- **FR-026**: Modal maior que a viewport DEVE rolar internamente, mantendo seus controles alcançáveis.
- **FR-027**: Em retrato, o produto DEVE exibir aviso para girar o aparelho em vez de servir a mesa; a rotação NÃO DEVE recarregar a página nem encerrar a sessão.

**Movimento (US5)**

- **FR-028**: Durações e curvas de animação DEVEM vir de um vocabulário único, compartilhado entre superfícies.
- **FR-029**: Toda mudança material da partida (caixa, posse, posição, construção) DEVE ter feedback visível.
- **FR-030**: Com movimento reduzido, transições DEVEM virar trocas imediatas preservando a legibilidade do fato.
- **FR-031**: Nenhum prazo, comando, pausa ou difusão DEVE depender do término de uma animação.
- **FR-032**: A animação NÃO DEVE bloquear decisão do jogador além do necessário para tornar o evento compreensível.

**Telemetria (US6)**

- **FR-033**: DEVEM ser registrados os eventos: sala criada, partida iniciada, partida finalizada e partida pausada (com a causa, §11.3/§11.4).
- **FR-034**: O evento de partida finalizada DEVE conter número de jogadores, rodadas e duração.
- **FR-035**: Nenhum evento DEVE conter nome de jogador, mão de cartas, token de sessão, código de reentrada ou id de sala em claro (princípio VI, D-019, D-033, D-037, D-040).
- **FR-036**: Eventos da mesma partida DEVEM ser correlacionáveis por identificador derivado e irreversível.
- **FR-037**: Falha de envio de telemetria NÃO DEVE pausar a partida, bloquear comando, gerar repetição nem virar causa de pausa.
- **FR-038**: Sem destino configurado no ambiente, o produto DEVE funcionar integralmente e NÃO DEVE enviar nada; desenvolvimento NÃO DEVE emitir.
- **FR-039**: Exceção contida pela fronteira de erro (spec 042) DEVE ser enviada ao monitoramento com o identificador de ocorrência exibido ao jogador, sem dado privado.
- **FR-040**: A telemetria DEVE viver atrás de porta própria com adaptador nulo por padrão; motor e sessão NÃO DEVEM depender dela.

**Publicação (US1)**

- **FR-041**: A produção DEVE ser promovida apenas a partir da linha principal e apenas com todos os gates verdes, incluindo acessibilidade (FR-022) e partida completa (FR-051).
- **FR-042**: Toda mudança proposta DEVE ganhar ambiente navegável próprio.
- **FR-043**: Voltar à versão anterior DEVE ser um passo, sem reconstrução.
- **FR-044**: Apenas credenciais públicas DEVEM chegar ao navegador; segredo de servidor e token de publicação vivem em segredo de CI.
- **FR-045**: As migrations do banco DEVEM ser aplicadas ao ambiente de produção como passo verificável do lançamento.
- **FR-046**: A versão publicada DEVE servir rota desconhecida como a aplicação (fallback de página única) e usar política de cache que não sirva versão velha do documento principal.
- **FR-047**: Construção sem variável obrigatória DEVE falhar com mensagem clara, em vez de publicar aplicação quebrada.
- **FR-048**: A versão publicada DEVE ser identificável (referência do commit) para efeito de relato de erro.
- **FR-049**: DEVE existir runbook de lançamento e de retorno, executado ao menos uma vez.

**Prova executável (US7)**

- **FR-050**: DEVE existir prova automatizada que leve uma partida do início ao fim de jogo pela interface real e verifique a classificação.
- **FR-051**: A prova de partida completa DEVE rodar sobre a versão construída e DEVE bloquear a promoção quando falhar.
- **FR-052**: O roteiro de duas telas (lobby → partida → fim) DEVE participar do gate quando houver credenciais disponíveis.
- **FR-053**: Material de diagnóstico DEVE ser preservado em caso de falha do roteiro.
- **FR-054**: O roteiro NÃO DEVE deixar salas de teste para trás no ambiente.

### Key Entities

- **Ordem de eliminação** — sequência de jogadores eliminados, na ordem em que a falência foi processada pelo motor. Fato do estado, serializável; é o único insumo da classificação.
- **Rodada** — número de voltas completas da ordem de assentos desde o início. Fato do estado; aparece no resumo e na linha de cada eliminado.
- **Classificação final** — derivada (nunca guardada): posição, jogador, patrimônio, propriedades e rodada da queda. Igual em toda tela, por construção.
- **Resumo de partida** — a superfície que apresenta a classificação, a duração e o caminho de saída.
- **Vocabulário de movimento** — conjunto único de durações e curvas usado por toda animação, com o freio de movimento reduzido embutido.
- **Caminho de jogo** — o conjunto de telas sem as quais não se joga (home, lobby, tabuleiro/HUD, modais de decisão, pausa/reconexão, fim de jogo). Define o escopo do gate de acessibilidade.
- **Evento de telemetria** — registro anônimo de contagem, com identificador derivado de partida. Nunca contém credencial nem dado privado.
- **Porta de telemetria** — a interface por trás da qual o destino vive; adaptador nulo por padrão.
- **Ambiente publicado** — produção e ambientes de revisão, com as mesmas migrations aplicadas e a mesma configuração pública.
- **Roteiro de partida completa** — a prova que exercita do início ao fim de jogo pela interface, sobre a versão construída.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa sem o repositório entra por um link e joga uma partida completa até o fim, em rede e máquina próprias.
- **SC-002**: Uma partida publicada sobrevive a recarregamento — o estado volta do banco de produção, com as migrations aplicadas.
- **SC-003**: Nenhuma versão com gate vermelho chega a produção, e voltar à versão anterior leva um passo.
- **SC-004**: Ao fim de qualquer partida, todas as telas exibem a mesma classificação completa, e ela permanece idêntica após recarregar.
- **SC-005**: Um jogador eliminado no início consegue dizer, ao fim, em que posição terminou.
- **SC-006**: Uma partida gravada antes desta mudança carrega e segue jogável.
- **SC-007**: O caminho de jogo inteiro — home, lobby, partida, decisões, fim — é percorrível somente por teclado, sem armadilha de foco.
- **SC-008**: A auditoria automatizada de acessibilidade não acusa violação séria ou crítica em nenhuma tela do caminho de jogo, e o resultado bloqueia a publicação.
- **SC-009**: Esc nunca decide nada pela partida.
- **SC-010**: O caminho de jogo é utilizável em 740 × 360 e 1024 × 768 em paisagem, sem rolagem horizontal; em retrato, o produto pede para girar e preserva a sessão.
- **SC-011**: Com movimento reduzido, toda informação da partida continua legível e nenhuma animação bloqueia decisão ou prazo.
- **SC-012**: Após uma partida publicada, é possível responder "quantas partidas começaram e quantas terminaram" sem que nenhum registro contenha nome, mão, token, código de reentrada ou id de sala em claro.
- **SC-013**: Uma exceção ocorrida em produção é localizável pelo identificador que o jogador leu na tela.
- **SC-014**: Uma partida completa é exercitada de ponta a ponta, sobre a versão construída, a cada promoção — e a falha dela impede a publicação.

---

## Assumptions

- **A ordem de eliminação é a classificação.** Falência esgota o patrimônio (§9.1), então ordenar eliminados por dinheiro empataria todos em zero. Sobreviver mais é a única medida que o jogo produz naturalmente (D-038).
- **Sem estatísticas narrativas.** "Maior aluguel", "quem mais construiu" e afins exigiriam instrumentar os 40 pontos onde o caixa muda hoje. Fora desta spec, por decisão explícita na D-038.
- **Ambientes de revisão compartilham o projeto Supabase de produção.** Não há contas nem dado pessoal (D-019) e sala é efêmera (D-041). Se o dado de produção passar a ter valor, a separação vira decisão própria.
- **O roteiro de duas telas depende de credencial.** Ele exige transporte real (o transporte local é in-memory, num processo só) — em ambiente sem segredo disponível, ele não roda, e isso precisa ser visível em vez de silencioso.
- **Partida completa pela interface precisa de estado semeado.** Levar 8 jogadores à falência por rolagem real levaria muito além do teto de tempo de um gate. O roteiro usa hook de teste para semear a partida perto do fim — o mesmo tipo de andaime que `?players=N` já é (spec 036), sem alterar nenhuma regra.
- **O motor não ganha regra nova.** Os três campos novos são registro de fatos já observados; nenhum reducer muda de resultado por causa deles.
- **A fronteira de erro da 042 é o alicerce do envio de exceção.** Esta spec dá destino remoto ao que ela já registra — não altera contenção, loop-breaker nem tela de falha.

## Fora de escopo

- **Celular em retrato como layout de jogo** — é redesenho do tabuleiro, não polimento (D-039).
- **Estatísticas narrativas de fim de jogo** — spec própria, se houver tração (D-038).
- **Revanche / reiniciar a mesa** — recusado pela spec 038 (FR-027).
- **Histórico de partidas, contas, espectadores** — fora do v1 (§16).
- **Telemetria de comportamento, funil por jogador, rastreio entre salas** — recusado pela D-040.
- **Monitoramento de disponibilidade, alerta de plantão, painel de métricas** — operação, não lançamento.
- **Internacionalização** — o produto é pt-BR no v1.
- **Instalação como aplicativo / funcionamento offline** — o jogo é online por definição (D-001).
- **Persistência de partida local** (item 8 da auditoria) — segue aberta, herdada da 042.
- **Correção das exceções existentes de exaustividade do log** — dívida da 040.
