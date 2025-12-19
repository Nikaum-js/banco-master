# Banco Master — Software Requirements Specification (SRS)

**Versão:** 1.2
**Data:** Maio de 2026
**Documento de fonte de verdade absoluta do projeto.**
**Toda decisão de produto e de regra de negócio deve ser baseada neste documento.**

> Este SRS cobre apenas regras de negócio. Detalhes técnicos (stack, eventos de sincronização, modelo de dados) vivem no `plan.md` de cada spec quando ela sair de discovery.

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Tabuleiro — Tema "Cidades do Mundo"](#2-tabuleiro--tema-cidades-do-mundo)
3. [Regras de Jogo — Fluxo de Turno](#3-regras-de-jogo--fluxo-de-turno)
4. [Regras por Tipo de Casa](#4-regras-por-tipo-de-casa)
5. [Aluguel e Construção](#5-aluguel-e-construção)
6. [Hipoteca](#6-hipoteca)
7. [Leilão](#7-leilão)
8. [Negociação entre Jogadores](#8-negociação-entre-jogadores)
9. [Falência](#9-falência)
10. [Sistema de Cartas (Acaso e Tesouro)](#10-sistema-de-cartas-acaso-e-tesouro)
11. [Sala, Lobby e Sessão](#11-sala-lobby-e-sessão)
12. [Interface e Experiência do Usuário](#12-interface-e-experiência-do-usuário)
13. [Mecânicas de Balanceamento](#13-mecânicas-de-balanceamento)
14. [Segundo Hotel por Propriedade](#14-segundo-hotel-por-propriedade)
15. [Empréstimos entre Jogadores](#15-empréstimos-entre-jogadores)
16. [Fora do Escopo desta Versão (v1.0)](#16-fora-do-escopo-desta-versão-v10)
17. [Glossário](#17-glossário)

---

## 1. Visão Geral do Produto

### 1.1 Descrição

O **Banco Master** é uma aplicação web multiplayer de jogo de tabuleiro estilo Banco Imobiliário (inspirado em Monopoly e diretamente baseado no [Richup.io](https://richup.io/)). O jogo permite que até 8 jogadores humanos se conectem em salas online, joguem em tempo real, comprem e negociem propriedades, construam casas e hotéis, hipotequem imóveis e disputem quem acumula mais riqueza sem ir à falência.

Este documento é a **fonte de verdade absoluta** do projeto. Toda decisão de produto deve respeitar as especificações aqui descritas. Quando uma informação não estiver explicitamente definida neste documento, a referência comportamental é o jogo Richup.io.

### 1.2 Objetivos

- Replicar fielmente as mecânicas e o layout visual do Richup.io como ponto de partida.
- Suportar partidas multiplayer em tempo real com até 8 jogadores humanos simultâneos.
- Garantir resiliência de sessão: nenhuma partida deve ser perdida por desconexão ou reload de qualquer jogador.
- Criar uma base reutilizável e extensível para múltiplos temas de tabuleiro no futuro.
- Não utilizar inteligência artificial (bots) nesta versão.

### 1.3 Referência Principal

[Richup.io](https://richup.io/) é a referência primária de comportamento. Quando este SRS não especificar um detalhe de regra, o comportamento observável no Richup.io deve ser adotado como padrão.

### 1.4 Decisões de Produto Registradas

Decisões tomadas durante a fase de discovery e definitivas para esta versão:

| Decisão | Escolha feita |
|---|---|
| Modo de jogo | Multiplayer online exclusivo — sem IA, sem hotseat |
| Nº máximo de jogadores | Até 8 jogadores humanos por sala |
| Tema inicial | Cidades do mundo (cópia do mapa principal do Richup.io) |
| Extensibilidade de temas | Temas desacoplados da lógica de jogo |
| IA / bots | Fora do escopo desta versão |
| Casas e hotéis | Presentes e obrigatórios no v1 |
| Negociação entre jogadores | Presente e obrigatória no v1 |
| Hipoteca | Presente e obrigatória no v1 |
| Leilão | Presente — ativado quando jogador recusa a compra |
| Timer de turno | Não há — o jogador controla quando finaliza |
| Desconexão mid-game | Partida pausa; propriedades não vão ao banco; aguarda reconexão |
| Speed Die | Presente — ativado após primeira volta completa do jogador |
| Construção com grupo parcial | Permitida com penalidade no aluguel (70% com construção, 150% sem) |
| Free Parking com prêmio acumulado | Presente — impostos/multas vão para o centro, prêmio inicial $500 |
| GO Progressivo | Presente — escala de $100 (1º lugar) a $400 (último) por patrimônio |
| Segundo hotel por propriedade | Presente — sequencial, cobra **mais** aluguel que o 1º; 2 hotéis viram arranha-céu |
| Empréstimos entre jogadores | Presentes — juros 10%–50%, cobrados a cada passagem pelo GO |
| Imunidade de aluguel em negociações | Presente — pode ser negociada por N voltas ou até o fim |
| Sistema de raridade de cartas | 3 tiers (Lendária/Rara/Comum) com cores (laranja/azul/verde) |
| Cartas em mão | Privadas (apenas contador visível), não-negociáveis, limite de 3 totais |
| Bus Tickets | Item de mão separado das cartas, obtido via carta "Passagem de Ônibus" |
| Cartas ofensivas (Aquisição Hostil, Despejo, Auditoria, Boicote) | Presentes no v1 — não podem ser recusadas pelo alvo, exceto via reação (Diplomacia) |
| Tesouro precisa ser impactante | Princípio de design: Tesouro não pode virar "casa de troquinho" como no Richup |

---

## 2. Tabuleiro — Tema "Cidades do Mundo"

### 2.1 Estrutura Geral

O tabuleiro é composto por **48 casas** dispostas em um quadrado, percorridas no sentido horário (11 casas por lado + 4 cantos).

> **Nota de design (v1.1):** o tabuleiro foi expandido de 40 → 48 casas, inspirado no **Monopoly: The Mega Edition** (52 casas), para suportar partidas de 7-8 jogadores com mais profundidade. A escolha é coerente: as mecânicas que o Mega introduziu para fazer um tabuleiro maior funcionar — Speed Die (§13.2), Skyscraper (§13.7), Bus Tickets (§10.7), Hangares ≈ Train Depots (§13.6) e construção com grupo parcial (§13.3) — **já existiam neste SRS**. A expansão completa esse design em vez de divergir do Richup.

| Tipo de casa | Quantidade |
|---|---|
| Propriedades de cidade (grupos de cor) | 28 |
| Aeroportos | 4 |
| Utilidades | 3 |
| Cartas Acaso | 3 |
| Cartas Tesouro | 3 |
| Impostos | 2 |
| Bus Ticket (espaço) | 1 |
| Cantos especiais | 4 |
| **Total** | **48** |

### 2.2 Cantos Especiais

Com 48 casas (11 por lado + 4 cantos), os cantos ficam nos índices múltiplos de 12:

| Casa | Posição |
|---|---|
| GO (Início) | Índice 0 — canto inferior direito |
| Prisão / Apenas Visitando | Índice 12 — canto inferior esquerdo |
| Férias (Free Parking) | Índice 24 — canto superior esquerdo |
| Vá para a Prisão | Índice 36 — canto superior direito |

### 2.3 Grupos de Propriedades de Cidade

As 28 propriedades são divididas em 8 grupos de cores. Os grupos **premium** (laranja, vermelho, amarelo, verde) têm 4 propriedades; os demais têm 3:

| Grupo (Cor) | Nº propriedades | Exemplo de cidades/países |
|---|---|---|
| Marrom | 3 | África (ex: Argélia, Egito) |
| Azul Claro | 3 | Ásia (ex: China) |
| Rosa / Magenta | 3 | Europa Central (ex: Alemanha) |
| Laranja | 4 | Europa Ocidental (ex: França) |
| Vermelho | 4 | Sul da Europa (ex: Itália) |
| Amarelo | 4 | Norte da Europa (ex: Reino Unido) |
| Verde | 4 | EUA — propriedades premium |
| Azul Escuro | 3 | EUA — propriedades máximas |

> **Balanceamento (por que grupos de 3-4):** grupos maiores tornam o monopólio mais difícil de fechar — sobretudo o do líder — o que segura o *runaway leader* e força mais negociação. Esse é o mecanismo central do Mega Edition para muitos jogadores, e combina com a regra de **monopólio parcial** (§13.3): constrói-se com a maioria do grupo (2 de 3, ou 3 de 4) com aluguel reduzido.

> 📌 Nomes exatos, preços, aluguéis e custos de construção devem ser extraídos do Richup.io como base e estendidos para as 28 propriedades (escada de preços mais granular, do mais barato ~$60 ao mais caro ~$400), inseridos no arquivo de tema antes do desenvolvimento de UI.

### 2.4 Aeroportos

Existem **4 aeroportos** distribuídos um em cada lado do tabuleiro. O aluguel escala com o número de aeroportos do proprietário:

| Aeroportos possuídos | Aluguel |
|---|---|
| 1 | $25 |
| 2 | $50 |
| 3 | $100 |
| 4 | $200 |

Aeroportos podem ser hipotecados, mas **não recebem construções de casas/hotéis**. Podem receber **Hangares** (ver Seção 13.6).

### 2.5 Utilidades

Existem **3 utilidades** (ex: Petrobras, Eletrobras e uma 3ª companhia — Gás/Saneamento). A 3ª segue o Mega Edition (Gas Company). O aluguel é baseado no valor dos dados:

| Utilidades possuídas | Aluguel |
|---|---|
| 1 | 4× o valor dos dados |
| 2 | 10× o valor dos dados |
| 3 | 20× o valor dos dados |

Utilidades podem ser hipotecadas mas não recebem construções.

### 2.6 Impostos

| Casa | Valor |
|---|---|
| Income Tax | $200 fixo (ou 10% do patrimônio — seguir Richup.io) |
| Luxury Tax | $100 fixo |

### 2.7 Espaço Bus Ticket

Casa especial nova (1 no tabuleiro), inspirada no Mega Edition. Quem para nela **compra uma carta Bus Ticket** (se ainda houver no baralho), guardada na mão do jogador. O uso do Bus Ticket — pular para um canto do lado atual do tabuleiro em vez de rolar — segue a mecânica já definida em §10.7. Não é propriedade; não pode ser comprada nem hipotecada.

---

## 3. Regras de Jogo — Fluxo de Turno

### 3.1 Início de Partida

- Cada jogador começa com **$2.000**. (Tabuleiro de 48 casas exige mais caixa inicial que o padrão de 40 — mais trânsito e mais propriedades para comprar. Meio-termo entre o $1.500 clássico e o $2.500 do Mega Edition.)
- A ordem dos turnos é definida por rolagem de dados no lobby (maior valor começa).
- Todos os jogadores iniciam na casa **GO** (índice 0).
- Todos os títulos de propriedade começam com o banco.

### 3.2 Fluxo de um Turno

1. O jogador ativo clica em **Rolar Dados**.
2. Dois dados de 6 faces são lançados (+ Speed Die após a 1ª volta — ver Seção 13.2).
3. O token avança o número de casas indicado, sentido horário.
4. O jogador resolve a casa em que parou (ver Seção 4).
5. **Dupla:** após resolver a casa, o jogador rola novamente.
6. **3ª dupla consecutiva:** vai direto para a Prisão sem mover (ver Seção 3.4).
7. Ações facultativas a qualquer momento antes de finalizar: construir, hipotecar, deshipotecar, propor negociação.
8. O jogador clica em **Finalizar Turno**.

> 📌 Não há timer. O jogador é responsável por finalizar seu turno.

### 3.3 Passar pelo GO

Sempre que o token passar pela casa GO (ou parar nela), o jogador recebe o valor calculado pelo **GO Progressivo** (Seção 13.5).

> 📌 Cartas que enviam o jogador diretamente para uma casa **NÃO** pagam GO ao passar, a menos que a carta diga explicitamente.

### 3.4 Dados — Regras de Dupla

- **Dupla** = mesmos valores nos dois dados brancos.
- Tirar dupla: jogador move, resolve a casa, rola novamente.
- 3ª dupla consecutiva no mesmo turno: vai direto à Prisão. O movimento dessa rolagem não é executado.
- Ao sair da Prisão com dupla: o jogador move mas **NÃO** tem direito a nova rolagem.

---

## 4. Regras por Tipo de Casa

### 4.1 Propriedade Livre (sem dono)

1. Modal de compra é exibido com o preço.
2. Se **COMPRA**: paga o preço ao banco e recebe o título.
3. Se **RECUSA**: a propriedade vai imediatamente a **leilão** (Seção 7). O próprio jogador que recusou pode participar.

### 4.2 Propriedade com Dono

- Dono é o próprio jogador: nenhuma ação obrigatória.
- Dono é outro jogador e propriedade **NÃO** hipotecada: jogador ativo paga aluguel (Seção 5).
- Propriedade hipotecada: nenhum aluguel é cobrado.

### 4.3 Aeroporto

Seguir Seção 2.4 e regras de Hangar (Seção 13.6).

### 4.4 Utilidade

Seguir Seção 2.5. O valor dos dados utilizado é o da rolagem que levou o jogador à casa (incluindo Speed Die).

### 4.5 Imposto

O valor é debitado automaticamente. Vai para o **centro do tabuleiro** (Free Parking — Seção 13.4), não para o banco.

### 4.6 Acaso / Tesouro

- O jogador saca a próxima carta do respectivo deck.
- O efeito é aplicado imediatamente.
- A carta retorna ao fundo do deck, exceto "Saia da Prisão" — fica com o jogador até usar ou negociar.

### 4.7 GO (Início)

Recebe o valor progressivo (Seção 13.5) ao passar ou parar. Nenhuma outra ação.

### 4.8 Apenas Visitando / Prisão

- Chegou à casa 12 por movimento normal: apenas visitando. Sem penalidade.
- Chegou por envio direto (carta, "Vá para a Prisão", 3 duplas): está preso (Seção 4.11).

### 4.9 Vá para a Prisão

Enviado imediatamente à Prisão (índice 12). **NÃO** recebe o GO. Não move mais no turno.

### 4.10 Férias (Free Parking)

Coleta o prêmio acumulado no centro do tabuleiro (ver Seção 13.4).

### 4.11 Regras da Prisão

Antes de rolar, o preso pode escolher:

1. Pagar multa de **$50** (vai para o centro — Seção 13.4) e rolar normalmente.
2. Usar carta "Saia da Prisão" e rolar normalmente.
3. Rolar os dados: se tirar dupla, sai e move o valor. Se não, permanece preso.

Na **3ª tentativa** sem dupla: paga obrigatoriamente os $50 e move o valor da última rolagem.

Enquanto preso, o jogador **PODE**: receber aluguéis, construir, hipotecar, propor e aceitar negociações.

> 📌 Ao sair com dupla, **NÃO** há nova rolagem — exceção à regra geral.

---

## 5. Aluguel e Construção

### 5.1 Cálculo de Aluguel — Propriedades de Cidade

| Situação | Aluguel cobrado |
|---|---|
| 1 de 2 propriedades do grupo (sem construção) | Valor base |
| 2 de 3 propriedades do grupo (sem construção) | 150% do valor base |
| Grupo completo (sem construções) | 200% do valor base (dobro) |
| Com casas/hotel e grupo parcial | 70% do valor da tabela de construção |
| Com casas/hotel e grupo completo | 100% do valor da tabela de construção |
| 1, 2, 3, 4 casas, hotel, 2º hotel | Conforme tabela da propriedade |

> 📌 A regra do grupo parcial implementa a mecânica de balanceamento (Seção 13.3).

### 5.2 Regras de Construção

- O jogador pode construir mesmo sem grupo completo (Seção 13.3), com penalidade.
- Nenhuma propriedade do grupo pode estar hipotecada para iniciar construção.
- **Uniformidade:** não pode haver diferença maior que 1 casa entre propriedades do mesmo grupo possuídas pelo jogador.
- Sequência por propriedade: 0 → 1 → 2 → 3 → 4 casas → 1 hotel → 2 hotéis (Seção 14) → arranha-céu (Seção 13.7).
- O hotel substitui as 4 casas; **2 hotéis** se transformam em 1 **arranha-céu** (máx. 1 por propriedade).
- **Sem limite de estoque:** casas, hotéis e arranha-céus são **ilimitados** — construir nunca é travado por falta de peças no banco. Não há escassez de construção (D-017 rev.); o jogo descarta a "escassez-como-bloqueio" por contrariar o catch-up discreto (Princípio IV).
- Custos de construção definidos na ficha de cada propriedade no tema.

### 5.3 Venda de Construções

- Pode vender casas/hotéis ao banco por **metade** do preço de construção, a qualquer momento.
- Ao vender, desce um nível na escada: arranha-céu → 2º hotel → 1º hotel → 4 casas → casas. Vender o hotel devolve a propriedade a 4 casas.
- A venda deve respeitar a regra de uniformidade.

---

## 6. Hipoteca

### 6.1 Hipotecar uma Propriedade

- Jogador recebe do banco **metade** do preço de compra original.
- Propriedade hipotecada é marcada visualmente.
- **NÃO** cobra aluguel.
- Não é possível hipotecar com construções — vender casas/hotéis do grupo antes.
- Não é possível construir em qualquer propriedade de grupo que contenha propriedade hipotecada.

### 6.2 Deshipotecar uma Propriedade

- Paga ao banco o valor original + **10% de juros**.
- Após pagar, volta a cobrar aluguel normalmente.

### 6.3 Transferência de Propriedade Hipotecada

- Propriedade hipotecada pode ser negociada ou transferida em falência.
- Novo dono pode manter hipotecada ou deshipotecar pagando original + 10%.
- Se mantida hipotecada: paga 10% de juros ao banco imediatamente como taxa de transferência.

---

## 7. Leilão

### 7.1 Quando ocorre

- Jogador para em propriedade livre e recusa a compra.
- Banco leiloa propriedades de jogador falido (quando devia ao banco).

### 7.2 Regras do Leilão

- Todos os jogadores podem dar lances, incluindo quem recusou a compra.
- Lance mínimo inicial: $1 (ou o preço mínimo definido no tema).
- Cada lance deve ser maior que o atual.
- Encerra quando nenhum novo lance é dado em tempo razoável (comportamento Richup.io).
- Vencedor paga seu lance ao banco e recebe o título.
- Se ninguém der lance, a propriedade permanece com o banco.

---

## 8. Negociação entre Jogadores

### 8.1 Quando pode ocorrer

Qualquer jogador pode propor uma negociação a qualquer outro a **qualquer momento** — inclusive fora do seu turno.

### 8.2 Composição de uma Proposta

De cada lado (proponente e destinatário), qualquer combinação de:

- Uma ou mais propriedades (incluindo hipotecadas).
- Dinheiro em qualquer valor.
- **Imunidade de aluguel** (ver Seção 8.4).

> 📌 Construções (casas/hotéis) **NÃO** podem ser negociadas diretamente. Devem ser vendidas ao banco antes.
>
> 📌 **Cartas em mão NÃO podem ser negociadas** (Acaso/Tesouro de qualquer raridade, incluindo "Saia da Prisão" e "Aquisição Hostil"). Bus Tickets também **não** são negociáveis. Ver Seção 10 para detalhes do sistema de cartas.

### 8.3 Fluxo de Negociação

1. Proponente abre o modal, seleciona destinatário e monta proposta.
2. Proposta enviada ao destinatário.
3. Destinatário **ACEITA** ou **RECUSA**.
4. Se aceita: a troca é processada automaticamente.
5. Se recusa: a proposta é descartada. O proponente pode fazer nova oferta.

> 📌 Seguir o fluxo de UX do Richup.io para a interface de negociação.

### 8.4 Imunidade de Aluguel em Negociações

Um jogador pode oferecer/solicitar imunidade de aluguel em uma ou mais propriedades como parte da troca:

- A imunidade especifica: qual propriedade, quantas voltas dura **OU** se é permanente até o fim da partida.
- Durante a imunidade, o beneficiado **não paga aluguel** ao parar naquela propriedade.
- A imunidade é **pessoal** — vale apenas para o jogador que a recebeu, não para todos.
- A imunidade não cancela a propriedade — o dono ainda cobra de outros jogadores.
- Imunidades ativas são exibidas no HUD e no painel de propriedades para todos.
- Imunidades são **transferíveis** em novas negociações.

> 📌 Exemplo válido: "Te dou Paris se você me deixar passar nas suas propriedades de graça por 3 voltas."

---

## 9. Falência

### 9.1 Condição de Falência

Um jogador está em falência quando não consegue pagar o que deve, mesmo após:

- Vender todas as construções ao banco.
- Hipotecar todas as propriedades.
- Usar todo o dinheiro em caixa.

### 9.2 Destino dos Ativos — Sem Empréstimo Ativo

| Devedor | Destino dos ativos |
|---|---|
| Devia ao banco | Propriedades (sem construções) vão a leilão pelo banco |
| Devia a outro jogador | Propriedades (sem construções) transferidas diretamente ao credor. Dinheiro restante também vai ao credor |

### 9.3 Falência com Empréstimo Ativo (ver Seção 15)

Se o jogador falido possui empréstimo ativo com outro jogador:

- **O credor herda todas as propriedades** do devedor (sem construções).
- **O credor assume todas as dívidas** do devedor com o banco (hipotecas, impostos pendentes).
- O credor recebe o dinheiro restante em caixa.
- Construções retornam ao banco pelo valor de venda (metade) antes da transferência.

> 📌 O credor herda **ativos E passivos**. Se as dívidas herdadas forem maiores que os ativos, o credor assume o prejuízo. Emprestar é um risco calculado.

### 9.4 Eliminação do Jogador Falido

- Jogador eliminado da partida.
- Token removido do tabuleiro.
- Imunidades que **ele havia concedido** a outros: **canceladas imediatamente**.
- Imunidades que **ele havia recebido**: **canceladas imediatamente**.

### 9.5 Fim de Jogo

A partida termina quando restar apenas **1 jogador** com saldo positivo. Ele é declarado vencedor.

---

## 10. Sistema de Cartas (Acaso e Tesouro)

### 10.1 Visão Geral

O Banco Master tem **2 decks separados** de cartas, cada um com 16 cartas distribuídas em 3 níveis de **raridade**:

- 🃏 **Acaso** (Chance) — efeitos ofensivos, caóticos, agressivos. "Cair em Acaso pode mudar o jogo."
- 🎁 **Tesouro** (Community Chest) — efeitos defensivos, benignos, com pequenas surpresas. "Cair em Tesouro quase sempre tem peso."

> 📌 **Princípio de design:** Tesouro não pode ser percebido como "casa de troquinho" (problema do Richup.io). A diferença entre Acaso e Tesouro é **temática**, não de magnitude.

### 10.2 Sistema de Raridade

Cada carta pertence a uma das 3 raridades, identificadas por cor:

| Raridade | Cor | Impacto | Comportamento padrão |
|---|---|---|---|
| 🟧 **Lendária** | Laranja | Alto — muda rumo da partida | Vai pra mão |
| 🟦 **Rara** | Azul | Médio — vantagem tática significativa | Vai pra mão ou efeito imediato grande |
| 🟩 **Comum** | Verde | Baixo — eventos previsíveis e curtos | Efeito imediato |

### 10.3 Regras Gerais de Cartas

**Privacidade:**
- Cartas em mão são **privadas** — outros jogadores NÃO veem quais cartas você tem.
- Outros jogadores VEEM apenas a **quantidade** total de cartas na sua mão ("Pedro tem 2 cartas").

**Negociação:**
- Cartas em mão **NÃO podem ser negociadas**, em nenhuma raridade, incluindo "Saia da Prisão" e "Aquisição Hostil".

**Limite de mão:**
- **Máximo de 3 cartas na mão** por jogador, somando todas as raridades.
- Se sacar uma 4ª carta, modal força o jogador a escolher uma das 4 para descartar (vai para o fundo do deck correspondente).
- Bus Tickets (Seção 10.7) têm **contador separado** e não consomem o limite de 3.

**Embaralhamento:**
- Cada deck é embaralhado no início da partida.
- Ao usar uma carta de mão, ela volta ao fundo do deck correspondente.
- Cartas de efeito imediato voltam ao fundo do deck logo após aplicação do efeito.
- Decks nunca esgotam — sempre há próxima carta.

**Timing de uso (cartas que vão pra mão):**

| Janela | Quando pode jogar |
|---|---|
| 🎯 **Próprio turno** | Apenas durante seu turno, antes de finalizar |
| ⚡ **Reação** | A qualquer momento, como resposta a uma ação contra você |
| 🔒 **Preso** | Apenas quando você está preso |

### 10.4 Distribuição do Deck ACASO (16 cartas)

#### 🟧 Lendárias (4 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Aquisição Hostil** | 2 | Mão | 🎯 Próprio turno |
| **Despejo** | 1 | Mão | 🎯 Próprio turno |
| **Auditoria Fiscal** | 1 | Mão | 🎯 Próprio turno |

#### 🟦 Raras (3 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Boicote** | 2 | Mão | 🎯 Próprio turno |
| **Crise Imobiliária** | 1 | Imediato | — |

#### 🟩 Comuns novas (4 cartas)

| Carta | Cópias | Modo |
|---|---|---|
| **Atalho** | 2 | Imediato |
| **Apagão** | 1 | Imediato |
| **Greve nas Utilidades** | 1 | Imediato |

#### 🟩 Comuns clássicas (5 cartas)

| Carta | Cópias | Modo |
|---|---|---|
| **Vá direto para a Prisão** | 1 | Imediato |
| **Volta para o GO** | 1 | Imediato |
| **Conserto de Imóveis** | 1 | Imediato |
| **Avance 3 casas** | 1 | Imediato |
| **Volte 3 casas** | 1 | Imediato |

### 10.5 Distribuição do Deck TESOURO (16 cartas)

#### 🟧 Lendárias (2 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Diplomacia** | 1 | Mão | ⚡ Reação |
| **Imunidade Temporária** | 1 | Mão | 🎯 Próprio turno |

#### 🟦 Raras (5 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Saia da Prisão** | 1 | Mão | 🔒 Preso |
| **Bunker Fiscal** | 2 | Mão | ⚡ Reação |
| **Boom Econômico** | 2 | Imediato | — |

#### 🟩 Comuns novas (6 cartas)

| Carta | Cópias | Modo |
|---|---|---|
| **Investidor Anjo** | 2 | Imediato |
| **Refinanciamento** | 2 | Imediato |
| **Passagem de Ônibus** | 2 | Imediato (adiciona Bus Ticket) |

#### 🟩 Comuns clássicas (3 cartas)

| Carta | Cópias | Modo |
|---|---|---|
| **Erro do banco a seu favor** | 1 | Imediato |
| **Aniversário** | 1 | Imediato |
| **Honorários médicos** | 1 | Imediato |

### 10.6 Catálogo de Efeitos por Carta

#### 🟧 Cartas Lendárias

**Aquisição Hostil** (Acaso)
> Escolha uma propriedade de outro jogador. Ele é obrigado a vendê-la para você pelo **preço original** que ele pagou. Restrições:
> - A propriedade **não pode ter construções** (incluindo Hangar em aeroportos).
> - O alvo deve possuir **pelo menos 2 propriedades não-hipotecadas** no momento.
> - Propriedade hipotecada é transferível conforme Seção 6.3 (com regras de transferência de hipoteca).
> - **Aeroportos e Utilidades:** o preço é multiplicado por **1,5×** (sobretaxa de 50% como compensação ao dono pela perda do escalonamento).
> - Não pode ser usada em propriedade do próprio jogador.
> - O alvo **NÃO pode recusar**.

**Despejo** (Acaso)
> Escolha 1 casa (não hotel) construída de outro jogador. Ela é demolida — retorna ao banco. O dono NÃO recebe nada. Não afeta a uniformidade obrigatória do grupo do alvo (ele pode reconstruir depois).

**Auditoria Fiscal** (Acaso)
> Escolha um jogador. Ele paga **10% do patrimônio líquido** (dinheiro + propriedades + construções) ao banco. O valor vai para o **centro do tabuleiro** (Free Parking — Seção 13.4).

**Diplomacia** (Tesouro)
> **Reação.** Cancela uma carta ofensiva sendo usada contra você (Aquisição Hostil, Despejo, Auditoria Fiscal, Boicote). A carta cancelada é descartada como se tivesse sido usada (volta ao fundo do deck).

**Imunidade Temporária** (Tesouro)
> Escolha uma propriedade sua. Por **2 voltas completas** do tabuleiro, ela não pode ser alvo de Aquisição Hostil, Despejo ou Boicote.

#### 🟦 Cartas Raras

**Boicote** (Acaso)
> Escolha 1 propriedade de outro jogador. Por **2 voltas completas**, ela **não cobra aluguel** de nenhum jogador que parar nela.

**Crise Imobiliária** (Acaso, imediato)
> Todos os jogadores pagam **5% do patrimônio líquido** ao banco. O valor total arrecadado vai para o **centro do tabuleiro** (Free Parking).

**Saia da Prisão** (Tesouro)
> Use a qualquer momento em que estiver preso para sair sem pagar a multa. Após uso, volta ao fundo do deck.

**Bunker Fiscal** (Tesouro)
> **Reação.** Cancela o próximo pagamento de imposto que você teria que fazer (Income Tax, Luxury Tax, Auditoria Fiscal recebida).

**Boom Econômico** (Tesouro, imediato)
> Todos os jogadores recebem **$200** do banco.

#### 🟩 Cartas Comuns novas

**Atalho** (Acaso, imediato)
> Mova-se até 3 casas para frente ou para trás (jogador escolhe). Resolve a casa onde parar normalmente. Se passar pelo GO indo para trás, NÃO recebe bônus.

**Apagão** (Acaso, imediato)
> Por **1 volta completa**, todos os Hangares ficam inativos — aeroportos voltam ao aluguel base sem dobra do Hangar (ver Seção 13.6).

**Greve nas Utilidades** (Acaso, imediato)
> Por **1 volta completa**, as 2 utilidades não cobram aluguel.

**Investidor Anjo** (Tesouro, imediato)
> Sua próxima compra de propriedade tem **20% de desconto**. Efeito ativo até a próxima compra ou até o fim da partida (o que vier primeiro).

**Refinanciamento** (Tesouro, imediato)
> Se você tem alguma propriedade hipotecada, escolha uma e desipoteca pagando apenas **5% de juros** (em vez dos 10% normais). Se não tem propriedade hipotecada no momento do saque, a carta não tem efeito.

**Passagem de Ônibus** (Tesouro, imediato)
> Você ganha **1 Bus Ticket** (ver Seção 10.7).

#### 🟩 Cartas Comuns clássicas

**Vá direto para a Prisão** (Acaso)
> Vá imediatamente para a casa Prisão (índice 12). **NÃO** recebe bônus do GO se passar por ele. Não move mais no turno.

**Volta para o GO** (Acaso)
> Mova-se diretamente para a casa GO. Recebe o bônus progressivo (Seção 13.5).

**Conserto de Imóveis** (Acaso)
> Pague **$25 por casa** e **$100 por hotel** que possui. Valor vai para o **centro do tabuleiro** (Free Parking).

**Avance 3 casas** (Acaso)
> Mova-se 3 casas para frente. Resolve a casa onde parar normalmente.

**Volte 3 casas** (Acaso)
> Mova-se 3 casas para trás. Resolve a casa onde parar. Se passar pelo GO indo para trás, NÃO recebe bônus.

**Erro do banco a seu favor** (Tesouro)
> Receba **$200** do banco.

**Aniversário** (Tesouro)
> Cada outro jogador da partida te paga **$50**. Em partidas de 8 jogadores = $350 total. Em 4 jogadores = $150 total.

**Honorários médicos** (Tesouro)
> Pague **$50** ao banco. Valor vai para o **centro do tabuleiro** (Free Parking).

> 📌 Cartas clássicas que dependem de estado do jogador (ex: Conserto de Imóveis, Refinanciamento) não têm efeito se o estado não se aplica (ex: jogador sem construções não paga nada). A carta ainda volta ao fundo do deck após saque.

### 10.7 Bus Tickets

Bus Tickets são **itens de mão separados** das cartas. Permitem flexibilidade de movimento.

**Como obter:**
- Sacar a carta **Passagem de Ônibus** (Tesouro, Comum). Cada saque dessa carta concede **1 Bus Ticket**.

**Regras:**
- Bus Tickets têm **contador próprio** — não consomem o limite de 3 cartas na mão.
- **Sem limite** de Bus Tickets acumuláveis.
- São **privados** (outros jogadores veem apenas a quantidade).
- **NÃO** podem ser negociados.

**Como usar:**
- Apenas durante o próprio turno, **antes de rolar os dados**.
- Ao usar 1 Bus Ticket, o jogador escolhe uma casa no **mesmo lado do tabuleiro** em que está atualmente e **pula direto** para lá, em vez de rolar os dados.
- Resolve a casa de destino normalmente.
- Após usar o Bus Ticket, o turno do jogador continua normalmente (ações facultativas e finalizar turno).
- O Bus Ticket é um **pulo direto** dentro do mesmo lado: **não percorre o tabuleiro e NÃO cruza o GO** — portanto não recebe o bônus de GO (revisão pós-playtest 2026-05-24; antes dava a volta no sentido horário e podia cruzar o GO).

> 📌 Os "lados do tabuleiro" são as 4 sequências de 11 casas entre os cantos. Lado 1: casas 1–11 (entre GO=0 e Prisão=12). Lado 2: casas 13–23 (entre Prisão=12 e Férias=24). Lado 3: casas 25–35 (entre Férias=24 e Vá-pra-Prisão=36). Lado 4: casas 37–47 (entre Vá-pra-Prisão=36 e GO).

---

## 11. Sala, Lobby e Sessão

### 11.1 Criação de Sala

- Host cria a sala e recebe um link único.
- Host tem poderes especiais: **kickar jogadores** e **iniciar a partida**.
- Sala suporta de 2 a 8 jogadores humanos.
- Host pode iniciar com pelo menos 2 jogadores.

### 11.2 Entrada na Sala

- Qualquer pessoa com o link entra antes da partida iniciar.
- Cada jogador escolhe **nome** e **token/peça** antes de entrar.
- Após início, não é possível adicionar novos jogadores.

### 11.3 Desconexão e Reconexão

- Se qualquer jogador desconectar, a partida **pausa automaticamente**.
- Mensagem é exibida a todos sobre o jogador desconectado.
- A partida retoma automaticamente quando ele reconectar.
- Propriedades do jogador desconectado **NÃO** vão ao banco durante a pausa.
- Reconexão é pelo mesmo link da sala; estado é carregado do servidor.
- Se o desconectado for o **host**: a partida pausa e aguarda o host reconectar. Não há transferência de host.

> 📌 **Não há timeout de desconexão** — a partida pode ficar pausada indefinidamente.

### 11.4 Persistência de Sessão

- Em caso de reload acidental, o cliente recupera o estado atual da partida e sincroniza.

---

## 12. Interface e Experiência do Usuário

### 12.1 Layout do Tabuleiro

Replicar o layout do Richup.io: visão 2D de cima, quadrado, 48 casas ao redor da borda (11 por lado + 4 cantos). Interior exibe HUD, log de eventos, etc.

### 12.2 Modais Obrigatórios

| Modal | Quando aparece |
|---|---|
| Compra de propriedade | Jogador para em propriedade livre |
| Leilão | Recusa de compra / banco leiloa falido |
| Negociação (proposta) | Jogador abre modal de trade |
| Negociação (recebida) | Jogador recebe proposta |
| Hipoteca / Deshipoteca | Jogador acessa painel de propriedades |
| Construção | Jogador acessa painel de construção |
| Prisão — escolha de ação | Início do turno do jogador preso |
| Carta sacada (revelação) | Jogador para em casa de carta — carta revelada apenas para o sacador se for ir pra mão |
| Carta sacada (anúncio público) | Carta de efeito imediato — todos veem o resultado no log |
| Descartar carta (excesso de mão) | Jogador saca a 4ª carta — escolhe qual descartar |
| Usar Aquisição Hostil | Jogador ativa a carta — escolhe alvo e propriedade |
| Usar Despejo | Jogador ativa a carta — escolhe casa do adversário |
| Usar Auditoria Fiscal | Jogador ativa a carta — escolhe alvo |
| Usar Boicote | Jogador ativa a carta — escolhe propriedade alvo |
| Usar Imunidade Temporária | Jogador ativa a carta — escolhe própria propriedade |
| Diplomacia disponível (reação) | Jogador é alvo de carta ofensiva — pergunta se quer usar Diplomacia |
| Bunker Fiscal disponível (reação) | Jogador deve pagar imposto — pergunta se quer usar Bunker |
| Aquisição Hostil sofrida (notificação) | Jogador perdeu propriedade — visualizar transferência |
| Usar Bus Ticket | Jogador ativa antes de rolar — escolhe casa do mesmo lado |
| Falência | Jogador não consegue pagar |
| Fim de jogo | Último jogador restante |
| Empréstimo (solicitação) | Devedor solicita empréstimo durante seu turno |
| Empréstimo (recebido) | Credor recebe solicitação |
| Free Parking coletado | Jogador para em Férias com prêmio acumulado |
| Speed Die — escolha de dado (Ônibus) | Resultado da face Ônibus |
| Speed Die — escolha de casa (Triples) | Triples nos dados |
| Hangar | Jogador deseja construir hangar em aeroporto próprio |

### 12.3 HUD

- Saldo de cada jogador visível a todos.
- Indicador de turno ativo.
- Lista de propriedades do jogador acessível a qualquer momento.
- Log de eventos (últimas ações).
- Status de jogadores desconectados.
- Prêmio atual do Free Parking visível.
- Status de empréstimos ativos.
- Status de imunidades ativas.
- **Contador de cartas em mão** de cada jogador (apenas quantidade, sem identificação) — ver Seção 10.3.
- **Contador de Bus Tickets** de cada jogador.
- **Efeitos ativos no tabuleiro** (Apagão, Greve nas Utilidades, Boicotes ativos, Imunidades Temporárias) — visíveis a todos.

### 12.4 Painel de Cartas (do próprio jogador)

- Aba dedicada "Minhas Cartas" no HUD próprio.
- Cada carta na mão é exibida com:
  - Cor da raridade no fundo (laranja/azul/verde).
  - Nome e texto do efeito.
  - Botão "Usar" habilitado apenas quando o timing permitir (tooltip explicativo quando desabilitado).
- Contador "X / 3 cartas na mão".
- Bus Tickets exibidos em contador separado.
- Cartas de **reação** (Diplomacia, Bunker Fiscal) aparecem como prompt automático quando aplicáveis — jogador escolhe usar ou não em até 10 segundos antes do efeito original ser aplicado.

### 12.5 Tokens de Jogadores

- Cada jogador escolhe token visual único no lobby.
- Tokens exibidos nas casas do tabuleiro.
- Múltiplos jogadores na mesma casa: exibidos agrupados.

---

## 13. Mecânicas de Balanceamento

Esta seção descreve as mecânicas adicionadas ao Banco Master para corrigir os desequilíbrios estruturais do Monopoly/Richup.io.

### 13.1 Problemas Identificados

| Problema | Descrição |
|---|---|
| First-mover advantage | Quem joga primeiro chega antes às propriedades. Com 8 jogadores, o último encontra o tabuleiro quase todo comprado na 1ª volta |
| Gate de grupo completo | Construção exige grupo completo → dependência total de negociação. Um jogador não-cooperativo pode bloquear outro indefinidamente |
| Jogador travado | Jogador sem territórios = $0 de poder de negociação. Mesmo com dinheiro, está funcionalmente eliminado |
| Partida arrastada | Resultado decidido nos primeiros 15 minutos, mas partida continua por horas |

### 13.2 Speed Die (Dado de Velocidade)

Terceiro dado especial baseado na mecânica oficial do Monopoly (edição 2006+). Ativado após o jogador completar a **primeira volta** do tabuleiro.

**Faces do Speed Die (6 faces):**

- Faces **1, 2 e 3** (3 faces): somam ao movimento normal.
- Face **Mr. Banco Master** (2 faces): o jogador move normalmente e depois avança até a **próxima propriedade não comprada** — podendo comprá-la imediatamente. Se todas estiverem compradas, avança até a próxima propriedade não hipotecada de adversário e paga aluguel.
- Face **Ônibus** (1 face): jogador escolhe mover o valor de um dos dois dados individualmente, ou a soma dos dois.
- **Triples** (os três dados iguais): pode mover seu token para **qualquer casa do tabuleiro** à sua escolha.

**Regras adicionais:**

- Não é usado na rolagem inicial de ordem de turno.
- Não é usado ao tentar sair da prisão com dupla.
- Para Utilidades, o valor do Speed Die é somado aos outros dados.
- Speed Die **não conta** para duplas — 3-3 nos brancos + 3 no Speed Die não é tripla dupla.

> 📌 O Mr. Banco Master resolve o first-mover advantage — cria oportunidades de compra independentes de onde o dado "natural" leva.

### 13.3 Construção com Grupo Parcial

Jogadores podem construir mesmo sem grupo completo, com penalidade no aluguel:

- Com construção em grupo parcial: aluguel = **70%** do valor da tabela.
- Com grupo completo: aluguel = **100%** da tabela (regra padrão).
- A regra de uniformidade ainda se aplica dentro das propriedades possuídas.
- Aluguéis sem construção também escalam (ver Seção 5.1: 150% para 2 de 3, 200% para grupo completo).

> 📌 O incentivo de completar o grupo via trade se mantém. O caminho de progresso existe sem cooperação obrigatória.

### 13.4 Free Parking com Prêmio Acumulado

A casa Férias (índice 24) acumula prêmio em dinheiro ao longo da partida:

- Todo valor pago em **impostos** (Income Tax, Luxury Tax) vai para o centro.
- Todo valor pago em **multas** de cartas Acaso/Tesouro vai para o centro.
- A multa da **Prisão** ($50) vai para o centro.
- **Prêmio inicial** colocado no centro ao início: **$500**.
- O jogador que parar em Férias recebe **todo** o dinheiro acumulado.
- Após coletado, o centro é **reabastecido** com $500 do banco.

> 📌 Catch-up discreto e natural. Quem está perdendo torce para cair no Free Parking.

### 13.5 GO Progressivo

O valor recebido ao passar pelo GO escala **inversamente** com a posição do jogador no ranking de patrimônio líquido (dinheiro + valor das propriedades + valor das construções):

| Posição no ranking | Valor recebido |
|---|---|
| 1º lugar (mais rico) | $100 |
| 2º lugar | $150 |
| Posições intermediárias | Escala linear entre $150 e $350 |
| Penúltimo lugar | $350 |
| Último lugar (mais pobre) | $400 |

> 📌 Cálculo automático no momento da passagem. UI mostra apenas o valor recebido, **sem destacar** que é catch-up. Valores podem ser ajustados após playtesting.

### 13.6 Hangar (Melhoria de Aeroporto)

Cada aeroporto pode receber **um Hangar**, melhoria individual que **dobra o aluguel** daquele aeroporto específico:

- Custo: **$100** (configurável no tema).
- Não exige possuir múltiplos aeroportos.
- Pode ser hipotecado junto com o aeroporto.
- Em falência, segue o destino do aeroporto.
- Pode ser vendido ao banco por metade do custo.

> 📌 Torna aeroportos mais estratégicos e dá um vetor de progresso independente do gate de grupos.

### 13.7 Skyscraper (Arranha-céu)

Quarto nível de construção, **acima do segundo hotel**. Pré-requisitos:

- Possuir **grupo completo**.
- Ter **4 casas + 1 hotel + 2º hotel** em **todas as propriedades** do grupo (os 2 hotéis da propriedade se transformam no arranha-céu).

Características:

- Custo: definido no tema (igual ou superior ao 2º hotel).
- Aluguel: **valor fixo** definido no tema (maior aluguel do jogo para a propriedade).
- Aluguel das propriedades sem Skyscraper do mesmo grupo é **triplicado** enquanto pelo menos uma propriedade do grupo tiver Skyscraper.
- Substitui visualmente o 2º hotel (não é construção adicional sobreposta).
- Venda: metade do custo, respeitando uniformidade.

### 13.8 Tax Man (Fiscal)

Token especial controlado pelo banco. A cada turno:

- Um jogador rola os dados pelo Fiscal (ordem de rotação a definir — sugestão: jogador imediatamente após o ativo).
- O Fiscal move o número de casas indicado.
- Se cair em **propriedade com dono**: o dono paga ao banco o valor que normalmente cobraria de aluguel daquela propriedade.
- Se cair em outras casas: nenhum efeito.
- Se o Fiscal cair em propriedade do próprio jogador que rolou por ele: **o jogador paga ao banco mesmo assim**.

> 📌 Pune quem domina o tabuleiro, beneficia indiretamente quem está atrás. Catch-up discreto que cria tensão sobre os ricos.

---

## 14. Segundo Hotel por Propriedade

### 14.1 Descrição

Após o primeiro hotel, o jogador pode construir um **segundo hotel** na mesma propriedade.

### 14.2 Pré-requisitos

- Já possuir 1 hotel construído na propriedade.
- Todas as outras propriedades do grupo possuídas pelo jogador devem ter pelo menos 1 hotel (uniformidade estendida ao 2º hotel).

### 14.3 Custo

- Igual ao custo do primeiro hotel da propriedade.

### 14.4 Aluguel

- Cobra **mais** aluguel que o primeiro hotel — é um degrau real da escada (valor de tema entre o 1º hotel e o arranha-céu).
- É também o pré-requisito do arranha-céu: 2 hotéis na propriedade se transformam em 1 arranha-céu (Seção 13.7).

### 14.5 Venda do Segundo Hotel

- Pode ser vendido ao banco por metade do custo, a qualquer momento.
- Deve respeitar a regra de uniformidade.

---

## 15. Empréstimos entre Jogadores

### 15.1 Descrição

Jogadores podem conceder empréstimos entre si durante a partida, criando dinâmicas de aliança, risco e negociação financeira além das propriedades.

### 15.2 Quando pode ser proposto

- **Somente durante o turno do devedor** — especificamente quando ele precisar pagar algo e não tiver fundos suficientes (aluguel, imposto, leilão, construção).
- O devedor solicita o empréstimo a um jogador específico de sua escolha.
- Fora dessa janela, empréstimos não podem ser propostos.

### 15.3 Regras do Empréstimo

- **Apenas 1 empréstimo ativo por jogador por vez** — não pode pegar novo enquanto tiver um em aberto.
- A taxa de juros é definida pelo credor, dentro do range de **10% a 50%** do valor emprestado.
- Os juros são cobrados a cada vez que o devedor **passa pelo GO** — debitado automaticamente do devedor e creditado ao credor.
- O devedor pode **quitar a qualquer momento** pagando principal + juros acumulados.
- O credor **não pode cancelar** ou exigir pagamento antecipado unilateralmente — o prazo é do devedor.

### 15.4 Cálculo de Juros

**Exemplo:** João pediu $500 emprestado de Pedro a 20% de juros.

- A cada passagem pelo GO: João paga **$100** de juros a Pedro (20% de $500).
- Se João quitar após 2 voltas: paga $500 (principal) + $200 (2× juros) = **$700 total**.
- Juros são sempre **simples** (sobre o principal original), não compostos.

### 15.5 Falência do Devedor com Empréstimo Ativo

- O credor herda todas as propriedades do devedor (sem construções — retornam ao banco pelo valor de venda).
- O credor assume todas as dívidas do devedor com o banco (hipotecas, impostos pendentes).
- O credor recebe o dinheiro restante em caixa.
- O empréstimo é considerado **liquidado** — credor assumiu ativos e passivos como compensação.

> 📌 O credor herda **tudo**, ativos E passivos. Se as dívidas herdadas forem maiores que os ativos, o credor assume o prejuízo.

---

## 16. Fora do Escopo desta Versão (v1.0)

| Feature | Observação |
|---|---|
| Inteligência Artificial (bots) | Decidido: fora do escopo. Apenas jogadores humanos |
| Timer de turno | Decidido: sem timer. Jogador finaliza quando quiser |
| Modo local (hotseat) | Apenas multiplayer online via sala |
| Múltiplos temas simultâneos | Apenas "Cidades do Mundo" no v1. Arquitetura preparada |
| Transferência de host | Host desconectado pausa a partida indefinidamente |
| Chat em tempo real | Não previsto no v1 |
| Espectadores | Não previsto no v1 |
| Histórico de partidas | Não previsto no v1 |
| Sistema de contas/perfis | A definir se auth anônima ou por email será necessária |
| Versão mobile nativa | Web responsivo apenas |
| Mercado de ações / investimento em propriedades alheias | Candidata a v2 |
| Modo jogo rápido | Candidato a v2 como modo alternativo de sala |
| Co-propriedade de imóveis | Rejeitada na fase de discovery |

---

## 17. Glossário

| Termo | Definição |
|---|---|
| GO / Início | Casa índice 0. Receber valor progressivo ao passar/parar (Seção 13.5) |
| Grupo completo | Um jogador possui todas as propriedades de um grupo de cor |
| Dupla | Mesmos valores nos dois dados brancos |
| Hipoteca | Propriedade dada como garantia ao banco em troca de metade do valor |
| Hotel | Construção máxima de casas: substitui 4 casas. Até 2 hotéis por propriedade |
| Skyscraper | Construção acima do 2º hotel, requer grupo completo (Seção 13.7) |
| Leilão | Disputa de lances por uma propriedade ou casa |
| Acaso | Deck de cartas de acaso (Chance no Monopoly clássico) — efeitos ofensivos/caóticos. Termo canônico — [D-018](DECISIONS.md#d-018--termo-canônico-acaso-antes-surpresa) |
| Tesouro | Deck de cartas de baú comunitário (Community Chest) — efeitos defensivos/benignos |
| Carta Lendária | Carta de alto impacto (cor laranja), geralmente vai para a mão |
| Carta Rara | Carta de impacto médio (cor azul), pode ir para a mão ou ter efeito imediato grande |
| Carta Comum | Carta de baixo impacto (cor verde), geralmente efeito imediato |
| Carta em mão | Carta retida pelo jogador após saque. Privada, não-negociável, com limite de 3 |
| Carta de reação | Carta jogável fora do próprio turno em resposta a um evento (Diplomacia, Bunker Fiscal) |
| Aquisição Hostil | Carta Lendária: força transferência de propriedade pelo preço original |
| Diplomacia | Carta Lendária de reação: cancela carta ofensiva contra você |
| Bus Ticket | Item de mão que permite mover para qualquer casa do lado atual do tabuleiro |
| Turno ativo | O turno do jogador que deve agir no momento |
| Speed Die | Terceiro dado especial ativado após a 1ª volta. Faces: 1/2/3, Mr. Banco Master, Ônibus |
| Mr. Banco Master | Face do Speed Die que envia o jogador à próxima propriedade disponível |
| Free Parking / Férias | Casa índice 24 que acumula prêmio em dinheiro |
| GO Progressivo | Valor recebido ao passar pelo GO escala por posição no ranking |
| Imunidade de Aluguel | Benefício negociável: passar por propriedade sem pagar aluguel por N voltas |
| Empréstimo | Transferência de dinheiro entre jogadores, juros 10–50% por GO |
| Credor | Jogador que concedeu o empréstimo |
| Devedor | Jogador que recebeu o empréstimo |
| Hangar | Melhoria de aeroporto que dobra o aluguel daquele aeroporto |
| Tax Man / Fiscal | Token controlado pelo banco que cobra aluguel ao banco quando cai em propriedade com dono |
| Catch-up mechanic | Mecanismo de design que dá vantagens a jogadores em desvantagem |

---

**Banco Master — SRS v1.2 | Maio 2026 | Documento de fonte de verdade absoluta**
