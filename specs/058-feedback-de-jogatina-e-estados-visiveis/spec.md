# Feature Specification: Feedback de jogatina e estados visíveis

**Feature Branch**: `main`

**Created**: 2026-08-01

**Status**: Aprovada (autorização explícita do usuário: "Esta tarefa está integralmente
autorizada … Não pare para pedir autorização entre as etapas")

**Input**: feedbacks colhidos durante uma jogatina real. Dez relatos, um por sintoma: aeroportos e
utilidades não dizem quem é o dono; abrir negociação é mudo; as bandeiras de Abu Dhabi e Dubai
aparecem desalinhadas na casa; usar Diplomacia contra a Aquisição Hostil parece não ter feito
nada; a Estatização dura demais; as bandeiras e a caixa do pregão quebram; o cronômetro do
pregão pareceu passar de 30 segundos; a dívida some do painel até chegar o turno do devedor;
"Imunidade ativa" não diz de quê nem de quem; e os efeitos ativos não dizem alvo nem alcance.
Tudo isso em celular, que é onde a partida aconteceu.

**Depende de**: spec 003 (compra e aluguel — escritura), spec 010 (empréstimos), spec 014
(imunidade de aluguel), spec 015 (efeitos temporários de carta), spec 017 (cartas de reação),
spec 021 (leilão), spec 031 (pregão de escassez), spec 035 (identidade sonora), spec 040 (log
de eventos tipado), spec 044 (acessibilidade AA e gate de responsividade), spec 056 (Fuligem),
spec 057 (metadados de carta).

> **Esta spec não cria regra de jogo.** Ela torna **legível** o que o motor já decide. A única
> mudança de regra do lote — a Estatização passar de duas voltas para uma — nasceu **fora** da
> spec, na [D-080](../../docs/adr/D-080-estatizacao-dura-uma-volta.md), e subiu o SRS para
> v1.40 antes desta linha ser escrita. Todo o resto aqui é apresentação de estado autoritativo
> existente, correção de defeito, ou ambos.

---

## Clarifications

Resolvidas por SRS, ADR e código real — sem pergunta pendente ao usuário:

| Ambiguidade | Resolução | Fonte |
|---|---|---|
| O relato chama a carta de "Estratificação" | O nome canônico é **Estatização**. O termo do relato não existe no projeto e não vira alias | `CONTEXT.md`, SRS §10.6 |
| O cronômetro do pregão "cresce" — é bug ou regra? | **Os dois fatos são distintos.** Exibir **mais de 24s** é bug de sincronia e será corrigido. A **duração total** do pregão crescer porque cada lance válido reinicia *aquele lote* em 24s é o soft-close previsto, e **não** muda nesta spec | SRS §7.3 ("um lance reinicia só o prazo daquele lote") |
| A imunidade a mostrar é a de troca ou a da carta Imunidade Total? | **As duas, e elas não se confundem.** `game.immunities` é a imunidade **por propriedade** negociada (§8.4), com beneficiário, propriedade e prazo próprios; `tempEffects` de tipo `imunidade-total` é a **carta**, que protege o jogador inteiro por 1 volta. A interface precisa distinguir, porque o escopo é diferente | SRS §8.4 vs. §10.6 |
| Mostrar contra quem vale a imunidade vaza informação? | **Não.** "Imunidades ativas são exibidas no HUD e no painel de propriedades **para todos**" — o dono que concedeu (`granterId`) e o beneficiário já são públicos por regra | SRS §8.4 |
| O empréstimo alheio pode ser mostrado a todos? | **Sim, e deve.** "Status de empréstimos ativos" está no HUD público, e "o prazo restante é **informação pública**" | SRS §12.3, §15.6 |
| O som de abertura de negociação é evento de jogo? | **Não.** Cue é identificador semântico de apresentação, fora do `GameState`, e a abertura do compositor é estado de UI local (`useTradeUI`), que nem sequer trafega | spec 035 (FR-018), `src/game/ui/trade/tradeUI.ts` |
| A reação usada pode ser pública no log? | **Sim, depois de usada.** A privacidade da mão é assegurada até a janela de reação; "a existência daquela reação vaza" no instante em que ela está a um clique. Uma vez **gasta**, a carta foi jogada e o fato é público como qualquer jogada | SRS §10.3 (alcance da garantia), §12.2 |
| Retrato de celular pode ganhar bloqueio de orientação? | **Não.** "Nenhuma orientação é recusada"; retrato tem layout próprio, com tabuleiro herói, gaveta com abas e cockpit fixo | SRS §12.6, [D-079](../../docs/adr/D-079-retrato-de-celular-e-orientacao-servida.md) |
| Alvo de toque: 24px (SRS) ou 44px (relato)? | **44 px**, que é o mais estrito. O SRS pede ≥24×24 no caminho de jogo e a D-079 já elevou retrato a 44; adotar 44 em tudo que esta spec toca satisfaz os dois | SRS §12.6, D-079 |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Saber de quem é cada título (Priority: P1)

Durante a partida, ao abrir os detalhes de qualquer casa comprável, o jogador descobre se ela
tem dono e quem é. Hoje isso vale para cidades, mas **aeroporto, utilidade e mina não dizem
nada**: o jogador precisa deduzir a posse pela luz colorida da célula no tabuleiro, e num
celular de 360px essa luz é ambígua entre assentos de cor próxima.

**Why this priority**: é a informação mais consultada do jogo e a mais barata de dar. Sem ela,
decidir lance, troca ou rota é chute.

**Independent Test**: abrir a escritura de um aeroporto livre, de um comprado e de um
hipotecado, e ler o estado de posse nos três, sem tocar em nenhuma outra área.

**Acceptance Scenarios**:

1. **Given** um aeroporto pertencente a outro jogador, **When** qualquer participante abre os
   detalhes da casa, **Then** o nome e a identidade visual do proprietário ficam visíveis.
2. **Given** uma utilidade sem dono, **When** os detalhes são abertos, **Then** a superfície diz
   explicitamente que ela está **livre** — nunca omite a linha de posse.
3. **Given** um aeroporto hipotecado, **When** os detalhes são abertos, **Then** aparecem **as
   duas** informações: quem é o dono e que a propriedade está hipotecada.
4. **Given** uma mina da Cidade da Fuligem com dono, **When** os detalhes são abertos, **Then** a
   posse aparece com o mesmo tratamento das demais, sem alterar as regras da mina.
5. **Given** um nome de jogador longo, **When** a escritura é aberta num viewport de 320px,
   **Then** o nome permanece inspecionável — completo ou acessível por nome acessível — sem
   depender de `title` nem de hover.

---

### User Story 2 — Entender o que aconteceu com a carta de reação (Priority: P1)

Quando alguém usa **Diplomacia** para cancelar uma **Aquisição Hostil**, o log hoje não registra
nada: a ofensiva não aparece (foi cancelada) e a reação também não. Para a mesa, a carta do
atacante simplesmente não fez efeito — indistinguível de bug.

**Why this priority**: é o único momento do jogo em que uma jogada cara de um jogador é anulada
por outro, e é justamente esse o momento que a mesa não consegue ler. Erosão direta de confiança
no motor.

**Independent Test**: com uma partida em que o alvo tem Diplomacia, disparar a ofensiva, usar a
reação e conferir que o log nomeia os dois lados e a anulação.

**Acceptance Scenarios**:

1. **Given** que Ana usa Aquisição Hostil contra Dubai, de Pedro, e Pedro tem Diplomacia,
   **When** Pedro usa a reação, **Then** o log registra um fato que nomeia **quem reagiu**,
   **quem atacou**, **qual efeito foi cancelado** e **qual era o alvo**, e diz que a ação foi
   anulada.
2. **Given** o mesmo cenário, **When** Pedro **recusa** a reação, **Then** o log registra a
   ofensiva aplicada normalmente e **não** registra reação nenhuma — "usou Diplomacia" e "não
   reagiu" são fatos distinguíveis.
3. **Given** uma ofensiva **sem propriedade** como alvo (Imposto Federal, Embargo de Obras),
   **When** a reação é usada, **Then** a narrativa nomeia o **jogador** alvo e omite a
   propriedade, sem inventar uma.
4. **Given** que a reação foi usada, **When** o log é lido, **Then** existe **um** fato de
   anulação — não dois, e não uma linha de ofensiva bem-sucedida junto.
5. **Given** que a janela de reação ainda está aberta, **When** o log é lido por qualquer
   participante, **Then** nenhuma informação sobre a carta de reação foi registrada ainda.

---

### User Story 3 — Ver toda dívida ativa, a qualquer momento (Priority: P1)

O painel de empréstimo hoje procura a dívida **do jogador da vez**. Consequência: um empréstimo
entre dois adversários some da tela até chegar a vez do devedor, e reaparece depois — o que a
mesa lê como "a dívida foi paga" ou como bug.

**Why this priority**: dívida é a informação que mais muda decisão de troca e de lance, e ela
está sumindo. Além disso, o SRS declara o prazo restante como informação pública (§15.6).

**Independent Test**: com dois empréstimos ativos entre jogadores que não são o da vez, conferir
que ambos aparecem no resumo e que o detalhe abre.

**Acceptance Scenarios**:

1. **Given** um empréstimo ativo entre dois jogadores, **When** a vez é de um terceiro, **Then**
   o empréstimo continua identificável por todos os participantes.
2. **Given** que o empréstimo é quitado ou vence, **When** o estado é atualizado, **Then** — e só
   então — ele desaparece.
3. **Given** vários empréstimos ativos, **When** o resumo compacto é lido, **Then** ele informa
   **quantos** existem, **devedor** e **credor**, e destaca o **mais urgente** (menor prazo).
4. **Given** o resumo, **When** o jogador toca, clica ou aciona por teclado, **Then** abre uma
   superfície acessível com credor, devedor, principal fixo, cobrança por GO, taxa, voltas
   restantes, valor de quitação, estado e ações permitidas.
5. **Given** que o dispositivo local **não** é o do devedor, **When** o detalhe é aberto, **Then**
   ele é somente leitura — sem ação de quitação.
6. **Given** que o dispositivo local **é** o do devedor e as regras permitem, **When** o detalhe é
   aberto, **Then** a quitação está disponível, com o valor exato.
7. **Given** o detalhe aberto, **When** o jogador pressiona Escape, **Then** ele fecha e o foco
   volta ao controle que o abriu.

---

### User Story 4 — Entender o escopo de uma imunidade (Priority: P2)

O indicador atual reduz imunidade a um booleano e mostra "Imunidade ativa". Isso não diz se o
jogador está protegido em **uma** propriedade ou em **tudo**, contra **quem**, nem por **quanto
tempo** — três coisas que mudam completamente o valor da informação.

**Why this priority**: imunidade é moeda de troca (§8.4). Um benefício negociável cujo escopo é
ilegível não pode ser precificado.

**Independent Test**: montar um estado com uma imunidade por propriedade e uma Imunidade Total
simultâneas e conferir que a interface as distingue.

**Acceptance Scenarios**:

1. **Given** uma imunidade negociada em Dubai concedida por Ana a Pedro por 3 voltas, **When** o
   detalhe é aberto, **Then** aparecem beneficiário, propriedade, quem concedeu e o prazo
   restante.
2. **Given** uma imunidade permanente, **When** o detalhe é lido, **Then** ela é apresentada como
   **permanente**, nunca como "0 voltas" nem com prazo em branco.
3. **Given** a carta **Imunidade Total** ativa, **When** o detalhe é lido, **Then** ela aparece
   como proteção **total e temporária** do jogador, distinta da imunidade por propriedade.
4. **Given** um jogador com imunidade, **When** a lista de jogadores é lida, **Then** existe um
   resumo compacto que diz **quantas** e de que natureza, sem exigir hover.
5. **Given** um dispositivo de toque, **When** o jogador toca o resumo, **Then** o detalhe abre —
   a informação nunca depende de `title` nem de ponteiro.

---

### User Story 5 — Ler um efeito ativo por inteiro (Priority: P2)

A área de efeitos ativos hoje mostra rótulo e voltas, mas descrições vagas: "Alvo sem construir"
não diz **qual** alvo; "Aluguéis vão à Loteria" não diz que atinge a mesa inteira.

**Why this priority**: efeitos ativos são públicos por regra (§12.3) e são o que explica um
aluguel que não chegou ou uma construção bloqueada.

**Independent Test**: montar um estado com Estatização, Embargo, Boicote e Valorização
simultâneos e conferir alvo, alcance e duração em cada linha.

**Acceptance Scenarios**:

1. **Given** uma Estatização ativa, **When** os efeitos são lidos, **Then** a linha diz que o
   alcance é **a mesa inteira**, que os aluguéis vão à Loteria, e o prazo **derivado do estado**.
2. **Given** um Embargo de Obras contra Ana, **When** os efeitos são lidos, **Then** a linha
   **nomeia Ana** e diz que ela não pode construir.
3. **Given** um Boicote em Paris, **When** os efeitos são lidos, **Then** a linha nomeia a
   propriedade.
4. **Given** um efeito com uma volta restante, **When** a linha é lida, **Then** o texto diz "1
   volta" e não "1 voltas".
5. **Given** que a duração de um efeito muda por decisão futura, **When** a interface é lida,
   **Then** ela continua correta sem edição — o número vem de `lapsRemaining`, nunca de literal.

---

### User Story 6 — Disputar o pregão sem a caixa quebrar (Priority: P2)

No pregão de escassez as bandeiras aparecem desalinhadas e a caixa quebra em alguns estados
(nomes longos, muitos participantes, viewport estreito). O pregão tem cronômetro: layout
instável ali custa lance.

**Why this priority**: é a única tela do jogo com decisão sob prazo em que a leitura errada é
irreversível.

**Independent Test**: abrir um pregão de seis lotes com nomes longos e maior licitante de nome
longo, em 320px, 667×375 e 1440×900, e conferir que nada transborda.

**Acceptance Scenarios**:

1. **Given** um pregão com seis lotes, **When** a tela é aberta em qualquer viewport da matriz,
   **Then** nenhum cartão transborda a caixa e o documento não ganha rolagem horizontal.
2. **Given** um lote cujo maior licitante tem nome longo, **When** o cartão é lido, **Then** o
   nome não empurra nem quebra o valor do lance.
3. **Given** qualquer bandeira do catálogo, **When** ela é exibida no lote, **Then** aparece
   centralizada no disco, sem deformação e sem corte que descaracterize a composição.
4. **Given** a Cidade da Fuligem, **When** o pregão é aberto, **Then** os ícones equivalentes
   recebem o mesmo tratamento — mesma caixa, mesma centralização.
5. **Given** um pregão em curso, **When** o layout é conferido, **Then** lote, líder, valor,
   cronômetro e ação principal continuam legíveis na ordem de leitura da §12.3.

---

### User Story 7 — Confiar no cronômetro do pregão (Priority: P2)

Durante a jogatina o cronômetro pareceu crescer e chegou a exibir cerca de 30 segundos, acima da
janela de 24s que o SRS define.

**Why this priority**: um prazo que mente é pior que prazo nenhum — o jogador calibra o próprio
lance por ele.

**Independent Test**: com o relógio do cliente deslocado do relógio da autoridade, conferir que o
número exibido nunca ultrapassa a janela configurada.

**Acceptance Scenarios**:

1. **Given** um lote recém-reiniciado por um lance válido, **When** o cronômetro é lido em
   qualquer dispositivo, **Then** ele nunca mostra mais que a janela configurada.
2. **Given** dois dispositivos com relógios civis diferentes, **When** ambos olham o mesmo lote,
   **Then** veem tempo consistente entre si.
3. **Given** um lance válido no lote B, **When** o lote A é observado, **Then** o prazo de A não
   muda.
4. **Given** um lance repetido, inválido ou reprocessado, **When** ele chega, **Then** o prazo do
   lote **não** é ampliado.
5. **Given** um lote cujo prazo venceu, **When** o cronômetro é lido, **Then** ele nunca fica
   negativo, nunca trava e nunca volta no tempo.
6. **Given** um lance válido, **When** ele é aceito, **Then** o lote correspondente — e só ele —
   volta à janela cheia. Este é o soft-close previsto e **permanece**.

---

### User Story 8 — Ouvir que a negociação abriu (Priority: P3)

Abrir a interface de negociação é silencioso. Toda outra ação equivalente do jogo tem cue.

**Why this priority**: é polimento, e o único item do lote que não corrige informação errada.

**Independent Test**: abrir o compositor de negociação e conferir que o cue toca uma vez.

**Acceptance Scenarios**:

1. **Given** o jogo com áudio destravado, **When** o jogador abre a interface de negociação,
   **Then** um cue próprio toca **uma única vez**.
2. **Given** que a interface já está aberta, **When** o componente re-renderiza, **Then** o cue
   **não** toca de novo.
3. **Given** uma reconexão ou o carregamento de um snapshot, **When** o estado chega, **Then** o
   cue **não** toca — abertura de negociação não é fato persistido.
4. **Given** o áudio em mudo ou ainda não destravado pela política de autoplay, **When** a
   interface abre, **Then** nada toca e a abertura continua perceptível **visualmente**.
5. **Given** o cue, **When** ele é ouvido, **Then** não se confunde com compra, leilão ou
   pagamento.

---

### User Story 9 — Jogar tudo isso no celular (Priority: P1)

A jogatina que gerou estes relatos aconteceu em celular. Toda superfície tocada por esta spec
precisa funcionar em retrato, sem bloqueio de orientação e sem rolagem horizontal.

**Why this priority**: um resumo de empréstimo que não cabe, ou um detalhe de imunidade que
precisa de hover, não existe no aparelho em que o jogo é jogado.

**Independent Test**: percorrer a matriz de viewports com os estados críticos montados.

**Acceptance Scenarios**:

1. **Given** qualquer viewport da matriz, **When** as áreas alteradas são exibidas, **Then** o
   documento principal não ganha rolagem horizontal.
2. **Given** retrato de celular, **When** o tabuleiro, a gaveta e o cockpit são exibidos, **Then**
   a composição da D-079 é preservada — tabuleiro no topo, abas abaixo, cockpit fixo.
3. **Given** qualquer controle novo, **When** ele é medido, **Then** o alvo de toque é ao menos
   44×44 px.
4. **Given** rotação retrato → paisagem → retrato, **When** a partida é observada, **Then** o
   estado é preservado.
5. **Given** `prefers-reduced-motion`, **When** as superfícies novas são exibidas, **Then**
   nenhuma informação existe apenas na animação.
6. **Given** um modal ou sheet que não cabe, **When** ele é aberto, **Then** rola **por dentro** —
   nunca o documento.
7. **Given** 8 jogadores e vários efeitos, empréstimos e imunidades simultâneos, **When** o painel
   é lido em 320px, **Then** nada é truncado de forma destrutiva.

---

### Edge Cases

- **Aeroporto/utilidade sem dono e hipotecado ao mesmo tempo** — impossível por regra (só o dono
  hipoteca); a interface não precisa de ramo, mas também não pode quebrar se o estado chegar
  assim: prevalece "livre".
- **Empréstimo cujo credor foi eliminado** — o empréstimo é liquidado pelas regras (§9.3/§15.5);
  o resumo some porque o estado sumiu, não porque a UI o escondeu.
- **Imunidade cujo concedente saiu da mesa** — cancelada imediatamente (§9.4); a linha some com o
  estado.
- **Efeito ativo de tipo sem fonte viva** (`imunidade-temp`, sem carta que o produza) — continua
  representável para snapshot em voo, e a interface não pode quebrar ao encontrá-lo.
- **Nome de jogador com 20+ caracteres** em cartão de lote de 150px — o valor do lance nunca cede
  espaço ao nome.
- **Pregão com um único lote** — a faixa de seleção não aparece; o painel ocupa o espaço.
- **Cliente com relógio adiantado** em relação à autoridade — o prazo exibido pode chegar a zero
  antes; ele **não** pode ficar negativo nem voltar.
- **Reação usada quando a mão do reator está oculta na perspectiva local** — o fato de anulação é
  registrado do mesmo jeito; ele não depende de saber qual carta era.

---

## Requirements *(mandatory)*

### Functional Requirements

**Posse de títulos**

- **FR-001**: Toda superfície de detalhe de casa comprável — cidade, aeroporto, utilidade e mina,
  nos dois mapas — MUST apresentar o estado de posse: **livre**, ou **dono nomeado**.
- **FR-002**: O estado de posse MUST ser produzido por uma **primitiva compartilhada única**;
  nenhuma superfície reimplementa a leitura de dono.
- **FR-003**: Quando houver hipoteca, a superfície MUST apresentar posse **e** hipoteca ao mesmo
  tempo.
- **FR-004**: A identidade do dono MUST vir da sala (nome, cor, avatar, skin), nunca do
  `GameState`, preservando a ausência de PII no estado.
- **FR-005**: O nome do proprietário MUST ser inspecionável por mouse, toque e teclado; `title`
  isolado NÃO satisfaz este requisito.
- **FR-006**: As regras de mina, aeroporto e utilidade NÃO mudam — esta spec só exibe posse.

**Reação registrada**

- **FR-007**: O sistema MUST registrar um fato **tipado** quando uma carta de reação **cancela**
  uma ofensiva; texto solto NÃO satisfaz este requisito.
- **FR-008**: O fato MUST carregar quem reagiu, quem atacou, qual efeito foi cancelado e o alvo
  (propriedade ou jogador), quando os dados existirem.
- **FR-009**: A união de tipos do log, a lista canônica de espécies, o descritor de frase, a
  chave de valor e o classificador sonoro MUST tratar a espécie nova — exaustivamente, de modo
  que omitir um deles seja erro de compilação.
- **FR-010**: Recusar a reação MUST produzir narrativa distinta de usá-la.
- **FR-011**: O fato novo MUST NOT duplicar o registro da ofensiva nem produzir dois cues para o
  mesmo evento.
- **FR-012**: Nenhuma informação sobre a carta de reação MUST ser registrada **antes** de ela ser
  usada.

**Empréstimos**

- **FR-013**: A existência de um empréstimo MUST NOT ser derivada do jogador da vez.
- **FR-014**: Todos os empréstimos ativos MUST ser identificáveis por todos os participantes
  durante toda a partida.
- **FR-015**: Um empréstimo MUST desaparecer da interface **apenas** quando encerrado pelas
  regras.
- **FR-016**: O resumo compacto MUST informar a quantidade de empréstimos ativos, devedor,
  credor e o de prazo mais próximo.
- **FR-017**: O detalhe MUST apresentar credor, devedor, principal fixo, cobrança por GO, taxa,
  voltas restantes, valor de quitação, estado e ações permitidas.
- **FR-018**: Ações de pagamento MUST ser oferecidas somente ao devedor local, e somente quando
  regra e autoridade permitirem; os demais veem somente leitura.
- **FR-019**: O sistema MUST suportar vários empréstimos simultâneos entre pares distintos,
  preservando o limite de um ativo por devedor.
- **FR-020**: O detalhe MUST reusar as primitivas de modal do projeto e implementar foco inicial,
  devolução de foco, Escape, semântica e rolagem interna.

**Imunidades**

- **FR-021**: As informações de imunidade MUST derivar de `game.immunities` e dos efeitos
  temporários, não de um booleano por jogador.
- **FR-022**: A apresentação MUST informar beneficiário, se é total ou por propriedade, qual
  propriedade quando aplicável, o vínculo com quem concedeu quando a regra o tiver, e a duração
  restante — inclusive **permanente**.
- **FR-023**: A lista de jogadores MUST manter um resumo compacto, e o detalhe MUST abrir por
  toque, clique e teclado.
- **FR-024**: A interface MUST NOT confundir imunidade total temporária com imunidade negociada
  de propriedade.
- **FR-025**: Nenhum dado além do que o SRS declara público MUST ser revelado.

**Efeitos ativos**

- **FR-026**: Cada efeito ativo MUST ser apresentado por um **display model estruturado**
  derivado do estado autoritativo — nome, afetado ou beneficiado, propriedade ou grupo, alcance
  (mesa inteira ou individual), duração restante, origem relevante e consequência resumida.
- **FR-027**: A camada visual MUST NOT inferir regra; o que ela não puder derivar do estado, ela
  omite.
- **FR-028**: A duração exibida MUST vir de `lapsRemaining`; literais de duração NÃO são
  admitidos na apresentação.

**Estatização (aplicação da D-080)**

- **FR-029**: A Estatização MUST durar **1 volta completa**.
- **FR-030**: A criação do efeito, os metadados, a descrição da carta, a narrativa do log, os
  textos de catálogo de mapa e os testes MUST refletir uma volta.
- **FR-031**: As invariantes de conservação de dinheiro e o destino dos aluguéis para a Loteria
  MUST permanecer inalterados.

**Pregão**

- **FR-032**: Bandeiras e ícones do pregão MUST ficar centralizados e sem deformação em todos os
  estados e viewports, nos dois mapas.
- **FR-033**: A caixa dos lotes MUST NOT quebrar com nomes longos, muitos participantes ou maior
  lance extenso.
- **FR-034**: A ordem de leitura do lote MUST ser preservada.
- **FR-035**: O tempo exibido MUST derivar do prazo autoritativo **corrigido pelo deslocamento de
  relógio** conhecido do dispositivo.
- **FR-036**: O tempo exibido MUST NOT ultrapassar a janela configurada, mesmo com relógios
  desalinhados.
- **FR-037**: Um lance válido MUST reiniciar somente o prazo do lote correspondente.
- **FR-038**: Lance repetido, inválido ou reprocessado MUST NOT ampliar prazo.
- **FR-039**: O cronômetro MUST NOT ficar negativo, travar ou retroceder.

**Bandeiras no tabuleiro**

- **FR-040**: A bandeira exibida na casa MUST ficar visualmente centralizada na área disponível.
- **FR-041**: A correção MUST ser feita na primitiva compartilhada quando a causa for geral;
  ajuste por casa só com evidência de que o defeito é exclusivo daquela posição.
- **FR-042**: A bandeira MUST NOT colidir com nome, faixa de proprietário, tokens, cantos ou GO,
  em nenhum dos quatro lados do tabuleiro.

**Som de negociação**

- **FR-043**: O sistema MUST ter um cue semântico próprio para a abertura da negociação, seguindo
  a arquitetura de cues existente.
- **FR-044**: O cue MUST tocar exatamente uma vez por abertura, para quem abriu.
- **FR-045**: O cue MUST NOT ser reproduzido por replay, reconexão ou re-render, e MUST NOT
  integrar o `GameState`.
- **FR-046**: O cue MUST respeitar mudo, preferências de volume e restrições de autoplay.
- **FR-047**: O asset MUST ser incluído na estrutura de assets vigente, com origem e licença
  verificáveis e documentadas.
- **FR-048**: A abertura MUST ter equivalente visual; o som NUNCA é a única confirmação.

**Responsividade e acessibilidade**

- **FR-049**: Toda superfície alterada MUST funcionar nos viewports da matriz de testes, em
  retrato e paisagem, nos dois mapas, com 2 e com 8 jogadores.
- **FR-050**: Nenhuma orientação MUST ser recusada; a composição de retrato da D-079 é
  preservada.
- **FR-051**: Alvos de toque MUST medir ao menos 44×44 px, com separação coerente.
- **FR-052**: Nenhuma interação essencial MUST depender de hover, e nenhuma informação importante
  MUST existir apenas em `title`.
- **FR-053**: Modais e sheets MUST rolar internamente; o documento principal MUST NOT ganhar
  rolagem horizontal.
- **FR-054**: Foco visível, ordem de leitura, nomes acessíveis, contraste e `prefers-reduced-motion`
  MUST ser respeitados; `aria-live` só onde a mudança acontece sem ação do jogador.
- **FR-055**: As telas alteradas MUST passar a verificação automatizada sem violações **serious**
  ou **critical**.

### Key Entities

- **Exibição de proprietário** — leitura compartilhada que converte um título em "livre" ou "dono
  nomeado + identidade", com o estado de hipoteca ao lado. Uma fonte, muitos consumidores.
- **Fato de reação anulada** — espécie nova do log tipado: reator, atacante, efeito cancelado,
  alvo (propriedade ou jogador). Público apenas depois do uso.
- **Resumo de empréstimos** — projeção de todos os empréstimos ativos: contagem, partes, prazo
  mais próximo, e por empréstimo o conjunto completo de fatos e a autorização de ação do
  dispositivo local.
- **Escopo de imunidade** — projeção que distingue imunidade **por propriedade** (beneficiário,
  propriedade, concedente, prazo ou permanente) de imunidade **total temporária** (jogador,
  prazo).
- **Efeito ativo apresentável** — projeção de `TempEffect` para nome, afetado, lugar, alcance,
  duração e consequência.
- **Leitura de lote** — leitura já existente do pregão, agora com o prazo corrigido pelo
  deslocamento de relógio e limitado à janela.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das casas compráveis dos dois mapas, o estado de posse é legível na
  superfície de detalhe — livre, com dono, ou com dono e hipoteca.
- **SC-002**: Usar uma carta de reação produz exatamente **um** fato no log, e a frase nomeia os
  quatro elementos disponíveis (reator, atacante, efeito, alvo).
- **SC-003**: Zero empréstimos ativos ficam invisíveis: para qualquer jogador da vez, a contagem
  exibida é igual à contagem de empréstimos no estado.
- **SC-004**: A Estatização expira na primeira passagem pelo GO de quem a originou, comprovado
  por teste de regressão; nenhuma fonte do repositório afirma duas voltas.
- **SC-005**: O tempo exibido de qualquer lote é ≤ janela configurada em 100% das leituras após
  sincronização, inclusive com relógios de host e cliente deslocados.
- **SC-006**: Um lance válido reinicia exatamente **um** lote; os demais mantêm o prazo, medido
  por teste.
- **SC-007**: Nos 10 viewports da matriz, o documento principal tem largura de rolagem igual à
  largura do cliente — zero rolagem horizontal.
- **SC-008**: Todo controle novo mede ≥44×44 px.
- **SC-009**: As telas alteradas acusam zero violações **serious** ou **critical** na verificação
  automatizada.
- **SC-010**: O cue de negociação toca uma vez por abertura, e zero vezes em re-render,
  reconexão ou replay.
- **SC-011**: `lint`, `typecheck`, suíte unitária e build fecham verdes.

---

## Assumptions

- O relato "Estratificação" refere-se à **Estatização**; nenhum termo novo entra no glossário.
- A duração do pregão crescer com lances válidos é **regra vigente** e permanece; só a exibição
  acima da janela é defeito.
- A imunidade "contra quem" existe apenas quando a regra registra um concedente; onde não há
  vínculo, a interface omite em vez de inventar.
- O deslocamento de relógio já é conhecido pelo cliente a partir do fluxo de comandos aceitos —
  esta spec o **consome**, não cria mecanismo novo de sincronização.
- Nenhuma migração de dados é necessária: efeitos em voo com duração antiga expiram pelo
  decremento normal.
- Não há mudança de banco, DDL ou Supabase nesta spec.
