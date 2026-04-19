# Magnata Imobiliário — Software Requirements Specification (SRS)

**Versão:** 1.34
**Data:** Julho de 2026
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

O **Magnata Imobiliário** é uma aplicação web multiplayer de jogo de tabuleiro estilo Banco Imobiliário (inspirado em Monopoly e diretamente baseado no [Richup.io](https://richup.io/)). O jogo permite que até 8 jogadores humanos se conectem em salas online, joguem em tempo real, comprem e negociem propriedades, construam casas e hotéis, hipotequem imóveis e disputem quem acumula mais riqueza sem ir à falência.

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
| Hipoteca | Presente e obrigatória no v1 — a hipotecada pode ser devolvida ao banco por zero, virando terreno livre (D-062, §6.4) |
| Leilão | Presente — ativado quando jogador recusa a compra, e por **escassez de terrenos** quando restam ≤3 sem dono (D-060, §7.3/§7.5) |
| Timer de turno | Não há — o jogador controla quando finaliza |
| Desconexão mid-game | Partida pausa; propriedades não vão ao banco; aguarda reconexão |
| Speed Die | Presente — ativado após primeira volta completa do jogador |
| Construção com país parcial | Permitida com 1+ cidade; enquanto o país estiver incompleto, o nível máximo por cidade é igual ao número de cidades possuídas; aluguel construído escala pela posse (50%→100%, §13.3) |
| Free Parking com prêmio acumulado | Presente — impostos/multas vão para o centro, prêmio inicial $500 |
| Fiscal (Tax Man) | **Removido** — token invisível que cobrava fora da vez; causa raiz de quatro relatos de bug financeiro (D-065, §13.8) |
| Bônus de GO | Fixo — $200 ao passar; $400 ao parar exatamente no GO (revisão D-007, 2026-05-24) |
| Segundo hotel por propriedade | Presente — sequencial, cobra **mais** aluguel que o 1º; 2 hotéis viram arranha-céu |
| Empréstimos entre jogadores | Presentes — juros 10%–50%, cobrados a cada passagem pelo GO; vencem em 3 voltas com cobrança automática do principal (D-054, §15.6) |
| Imunidade de aluguel em negociações | Presente — pode ser negociada por N voltas ou até o fim |
| Negociação com trava de esvaziamento | Presente — troca livre em qualquer proporção; recusadas só a doação pura e a troca que reduz o patrimônio a menos de um terço (D-058, §8.5) |
| Sistema de raridade de cartas | 3 tiers (Lendária/Rara/Comum) com cores (laranja/azul/verde) |
| Cartas em mão | Privadas (apenas contador visível), não-negociáveis, limite de 3 totais |
| Bus Tickets | Item de mão separado das cartas, obtido via carta "Passagem de Ônibus" |
| Cartas ofensivas (Aquisição Hostil, Confisco Geral, Imposto Federal, Boicote, Permuta Forçada, Embargo de Obras) | Presentes no v1 — não podem ser recusadas pelo alvo, exceto via reação (Diplomacia) |
| Tesouro precisa ser impactante | Princípio de design: Tesouro não pode virar "casa de troquinho" como no Richup |
| Obrigação entre jogadores | Nunca truncada — pagamento parcial deixa o restante devido e abre dívida pendente, inclusive fora da vez (D-061, §9.1) |
| Rastreabilidade de caixa | Toda mudança de caixa tem motivo registrado; nenhuma regra move dinheiro em silêncio (D-063, §12.3) |
| Fim de jogo | Classificação completa por ordem inversa de eliminação, com patrimônio e duração; depois, retorno à mesma sala para revanche (D-038/D-052) |
| Retenção da sala | Até 10 resumos de partidas finalizadas na mesma sala, com estatísticas derivadas e sem perfil global (D-067) |
| Acessibilidade | WCAG 2.2 AA no caminho de jogo, verificada automaticamente; paisagem é a orientação de jogo (D-039) |
| Telemetria | Mínima e anônima — contagem de partidas no próprio Supabase, exceção em monitoramento de erro (D-040) |
| Ordem inicial | Host escolhe no lobby entre Leilão secreto e Maior dado; neste, cada jogador rola à vista da mesa (D-046/D-051) |

---

## 2. Tabuleiro — Tema "Cidades do Mundo"

### 2.1 Estrutura Geral

O mapa **Cidades do Mundo** é composto por **48 casas** dispostas em um quadrado,
percorridas no sentido horário (11 casas por lado + 4 cantos).

> 📌 **Mapas** (v1.32, [D-069](adr/D-069-segundo-mapa-jogavel-cidade-da-fuligem.md),
> [D-070](adr/D-070-fuligem-tem-topologia-e-regras-proprias.md),
> [D-072](adr/D-072-taxa-de-fumaca-sai-da-fuligem.md)): cada mapa fornece, por
> catálogo de fonte única, suas casas, grupos, topologia, apresentação e regras próprias
> explicitamente declaradas. O motor, a autoridade da sala e os contratos de estado
> continuam compartilhados. Os nomes, quantidades e valores das §§2.2–2.7 são do mapa
> **Cidades do Mundo** (`atlas`). A **Cidade da Fuligem** (`fuligem`) usa a composição
> própria da §2.8. O mapa é gravado na sala na criação e é imutável (§11.1).

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

As 28 propriedades são divididas em **10 grupos de cores** (tema "Cidades do Mundo") — **um país cada**. Oito grupos têm **3** cidades; **França (navy)** e **Emirados (super-luxo)** têm **2** cada — os dois duos de prestígio do topo (28 = 8×3 + 2 + 2):

| Grupo (Cor) | Nº | País | Cidades |
|---|---|---|---|
| Marrom (brown) | 3 | Itália | Roma, Veneza, Pisa |
| Azul-claro (skyblue) | 3 | Egito | Cairo, Gizé, Luxor |
| Rosa (pink) | 3 | Japão | Tóquio, Kyoto, Osaka |
| Roxo (purple) | 3 | Espanha | Madri, Ibiza, Sevilha |
| Laranja (orange) | 3 | Alemanha | Berlim, Munique, Hamburgo |
| Vermelho (red) | 3 | China | Pequim, Xangai, Hong Kong |
| Amarelo (yellow) | 3 | Brasil | Rio, São Paulo, Brasília |
| Verde (green) | 3 | EUA | Nova York, Los Angeles, Miami |
| Azul-marinho (navy) | **2** | França | Cannes, Paris |
| **Emirados (platinum)** | **2** | Emirados Árabes (super-luxo) | **Abu Dhabi, Dubai** |

> **Balanceamento:** grupos de 3 seguram o *runaway leader* e forçam negociação — dá pra construir 1 casa com 1 cidade (50% do aluguel) e até 2 casas por cidade com 2 cidades (75%), mas **completar o país libera toda a escada e leva o aluguel a 100%** (§5.1/§13.3). **Laranja/Vermelho** (meio do tabuleiro) são o *sweet spot* (casa barata, bom aluguel). Os duos do topo — **França** e **Emirados** — permitem 1 casa com 1 cidade e liberam toda a escada com as 2, e são caros: os **Emirados** (Abu Dhabi/Dubai) são o **super-luxo** (preços/aluguéis muito acima, armadilha de prestígio — ver §5 e D-025).

> 📌 Preços ($60→$650), aluguéis-base e **custos de construção (tier por grupo)** vivem no tema (`theme.ts`) — fonte única tunável. Composição e calibração: [D-017](adr/README.md) (rev.) + [D-024](adr/README.md) + [D-025](adr/README.md).

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

Casa especial nova (1 no tabuleiro), inspirada no Mega Edition. Quem para nela **ganha 1 Bus Ticket guardado** (contador próprio, §10.7) — **não é forçado a usá-lo na hora**: fica disponível para uso facultativo antes de rolar, no momento que o jogador escolher (mesma mecânica do ticket vindo da carta "Passagem de Ônibus"). Não é propriedade; não pode ser comprada nem hipotecada. *(D-021 chegou a tornar o espaço uma "corrida imediata"; revertida em 2026-05-27 — ver DECISIONS.)*

### 2.8 Cidade da Fuligem

O mapa Cidade da Fuligem usa **40 casas** (9 por lado + 4 cantos), com cantos nos
índices `0/10/20/30`:

| Tipo de casa | Quantidade |
|---|---|
| Propriedades em 8 bairros | 22 |
| Ferrovias | 4 |
| Minas | 4 |
| Acaso | 3 |
| Tesouro | 2 |
| Bilhete de Trem | 1 |
| Cantos especiais | 4 |
| **Total** | **40** |

Não há Utilidades nem casas fixas de Imposto neste mapa.

As **Ferrovias** seguem a regra econômica dos Aeroportos (§2.4) e aceitam **Estação de
Carga**, apresentação do Hangar (§13.6). Ao terminar o turno sobre uma Ferrovia própria
e não hipotecada, o jogador pode usar o **Desvio pela Ferrovia** para mover diretamente
até outra Ferrovia própria e não hipotecada, **no máximo uma vez no mesmo turno**. O
movimento não passa pelo GO e não resolve aluguel na chegada.

Cada **Mina** custa `R$ 220`, hipoteca por `R$ 110`, não recebe construções e **não cobra
aluguel**. Cair em Mina de outro jogador não transfere dinheiro. Enquanto a Mina pertencer
ao jogador e não estiver hipotecada, concede o bônus correspondente:

| Mina | Bônus |
|---|---|
| Ferro | construções custam 25% menos |
| Carvão | aluguel das Ferrovias do dono sobe 50% |
| Estanho | impostos e aluguéis pagos pelo dono caem 15% |
| Cobre | aluguel das propriedades do dono com qualquer construção sobe 25% |

Construir na Cidade da Fuligem paga somente o custo normal da construção. Não existe
cobrança adicional por subir para **Fábrica**, **Complexo de Fábricas** ou **Torre de
Ferro**, e construções não alimentam a **Sorte Grande** ([D-072](adr/D-072-taxa-de-fumaca-sai-da-fuligem.md)).

O anel da Fuligem usa a redução de casas para dar mais área a cada célula e mostrar nomes
completos. O miolo não exibe nomes de regiões ou linhas divisórias: fica reservado às
superfícies funcionais do jogo.

---

## 3. Regras de Jogo — Fluxo de Turno

### 3.1 Início de Partida

- Cada jogador recebe **$2.000 antes do Ritual de Largada**, em qualquer mapa.
- Antes de iniciar, o host escolhe no lobby como a ordem será definida (D-046):
  - **Leilão secreto**: o host abre uma única rodada simultânea para todos os assentos, inclusive o próprio;
  - cada jogador lacra um lance de **$0 a $500**, em passos de **$50**, dentro de **15 segundos**;
  - o lance não pode ser alterado depois de enviado; ausência de lance no prazo vale **$0**;
  - a ordem é decrescente por valor; empates são resolvidos por sorteio da autoridade da mesa;
  - cada jogador paga o próprio lance ao banco, e começa a partida com **$2.000 menos o lance**;
  - o banco deposita a soma integral dos lances na **Loteria** (§13.4), além dos $500 iniciais;
  - durante a coleta, valores permanecem secretos; a revelação publica os lances e a ordem para todos;
  - **Maior dado**: cada jogador, na ordem dos assentos do lobby, aciona a própria rolagem em uma fase compartilhada e visível para toda a mesa (D-051);
  - somente o dono do assento da vez pode pedir a rolagem; a autoridade gera e atesta os dois dados brancos, publica o arremesso e o resultado antes de liberar o próximo jogador;
  - depois da última rolagem, a ordem é decrescente pela soma e empates são resolvidos pelo RNG da autoridade;
  - se o jogador da vez desconectar antes de rolar, a mesa aguarda sua reconexão, sem timer ou rolagem automática;
  - em Maior dado, ninguém paga pela posição: todos começam com $2.000 e a Loteria com $500;
  - o modo escolhido e o resultado ficam visíveis para todos; somente o host pode mudar o modo, e apenas antes de iniciar;
  - terminada a revelação visual de qualquer modo, todas as telas entram automaticamente no tabuleiro, sem confirmação individual.
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

Sempre que o token passar pela casa GO, o jogador recebe o **bônus fixo de $200**; se parar **exatamente** no GO, recebe **em dobro ($400)** — ver Seção 13.5.

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

Recebe o bônus de GO (Seção 13.5): $200 ao passar, $400 ao parar exatamente na casa. Nenhuma outra ação.

### 4.8 Apenas Visitando / Prisão

- Chegou à casa 12 por movimento normal: apenas visitando. Sem penalidade.
- Chegou por envio direto (carta, "Vá para a Prisão", 3 duplas): está preso (Seção 4.11).

### 4.9 Vá para a Prisão

Enviado imediatamente à Prisão (índice 12). **NÃO** recebe o GO. Não move mais no turno.

### 4.10 Férias (Free Parking)

Coleta toda a **Loteria** acumulada no centro do tabuleiro (ver Seção 13.4).

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
| Com construção (escala por posse do país) | tabela de construção × **fator de posse**: 0,5 (1 cidade) → 1,0 (país completo). Trio: 1/3 = 50%, 2/3 = 75%, 3/3 = 100%; duo: 1/2 = 50%, 2/2 = 100% (034) |
| 1, 2, 3, 4 casas, hotel, 2º hotel, arranha-céu | Tabela de construção = **aluguel-base × multiplicador do GRUPO** (D-024) |

> **Modelo de aluguel (D-024/D-025):** a tabela de construção é **`aluguel-base × multiplicador do grupo`** — não um multiplicador único. Grupos baratos têm multiplicadores maiores e os caros, menores (curva clássica: hotel-topo ~$360 no marrom, ~$1.870 no navy/França, até ~**$2.300 nos Emirados / super-luxo**). O **2º hotel** cobra mais que o 1º (§14.4) e o **arranha-céu** é o topo (§13.7). **Custo de casa** = tier fixo por grupo ($40 marrom → $300 Emirados), não proporcional ao preço — cria o sweet spot laranja/vermelho; os **Emirados** são prestígio (ROI baixo, armadilha — D-025). Valores no tema (`theme.ts`), fonte única `rentLadder`.

> 📌 A regra do grupo parcial implementa a mecânica de balanceamento (Seção 13.3).

### 5.2 Regras de Construção

- O jogador pode iniciar construção possuindo **qualquer** quantidade de cidades do país (≥1) — não exige maioria. Enquanto o país estiver incompleto, o **nível máximo de construção em cada cidade é igual ao número de cidades daquele país que o jogador possui**: 1 de 3 permite até 1 casa; 2 de 3 permitem até 2 casas por cidade; 1 de 2 permite até 1 casa. O país completo libera toda a escada (§13.3).
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
- Não é possível hipotecar com qualquer construção — vender casas, hotéis e arranha-céus do grupo ou o Hangar do aeroporto antes.
- Não é possível construir em qualquer propriedade de grupo que contenha propriedade hipotecada.
- Quem não quiser (ou não puder) resgatar tem a **devolução ao banco** da §6.4 como saída — é o único jeito de destravar a construção do grupo sem pagar o resgate.

### 6.2 Deshipotecar uma Propriedade

- Paga ao banco o valor original + **10% de juros**.
- Após pagar, volta a cobrar aluguel normalmente.

### 6.3 Transferência de Propriedade Hipotecada

- Propriedade hipotecada pode ser negociada ou transferida em falência.
- Novo dono pode manter hipotecada ou deshipotecar pagando original + 10%.
- Se mantida hipotecada: paga 10% de juros ao banco imediatamente como taxa de transferência.

### 6.4 Devolução de Propriedade Hipotecada ao Banco

**(v1.25, [D-062](adr/D-062-hipotecada-pode-voltar-ao-banco.md))** O dono pode devolver ao banco uma propriedade **hipotecada** e **não recebe nada** por ela.

- **Só a hipotecada.** Propriedade sem hipoteca não tem venda ao banco — hipotecar (§6.1) **é** a venda ao banco, por metade do preço e com recompra. O que a §6.4 abre é a saída do estado seguinte.
- **Valor: zero.** A metade do preço já foi paga ao dono no ato da hipoteca; devolver o título liquida esse financiamento. Qualquer valor a mais criaria dinheiro para quem já recebeu adiantado pelo mesmo ativo.
- **A propriedade volta a ser terreno livre** (§7.2): perde hipoteca, Hangar e construção, e volta ao fluxo de cair-e-comprar. Passa a contar de novo para a escassez de terrenos (§7.5).
- **Só na própria vez**, com a partida em andamento e sem pausa.
- **Proibida com dívida pendente** (§9.1). Sem esta trava o devedor derrubaria o próprio valor de liquidação devolvendo títulos e declararia falência com o credor recebendo menos do que os ativos valiam — a mesma proteção de credor que a §8.5 aplica à troca.
- A **trava de esvaziamento** (§8.5) **não** se aplica: ela existe contra doação a um jogador escolhido, e aqui não há donatário — o terreno fica livre para qualquer um, inclusive para quem devolveu.

> 📌 O ganho não é caixa, é posição: uma cidade hipotecada que o dono não consegue resgatar **congela a construção do país inteiro** (§6.1), inclusive nas cidades quitadas ao lado dela.

---

## 7. Leilão

### 7.1 Quando ocorre

- Jogador para em propriedade livre e recusa a compra.
- Banco leiloa propriedades de jogador falido (quando devia ao banco) — **espólio**, no formato de pregão simultâneo da Seção 7.3 ([D-031](adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md), v1.6).
- **Escassez de terrenos:** quando restam poucos terrenos sem dono no tabuleiro (Seção 7.5). Restaurado em v1.25 pela [D-060](adr/D-060-leilao-de-escassez-restaurado-com-janela-legivel.md).

### 7.2 Regras do Leilão

- Todos os jogadores podem dar lances, incluindo quem recusou a compra.
- Lance mínimo inicial: $1 (ou o preço mínimo definido no tema).
- Cada lance deve ser maior que o atual.
- Encerra quando nenhum novo lance é dado em tempo razoável (comportamento Richup.io).
- Vencedor paga seu lance ao banco e recebe o título.
- Se ninguém der lance, a propriedade permanece com o banco.

### 7.3 Pregão Simultâneo (formato)

Formato usado quando **vários** terrenos vão a leilão de uma vez. Tem **duas procedências**: a **escassez de terrenos** (§7.5) e o **espólio do falido** (§9.2). **Não confundir** com o leilão de *casas*, removido ([D-022](adr/README.md)).

- **Pregão simultâneo:** todos os lotes vão a leilão **ao mesmo tempo**; cada um é um leilão inglês próprio (lance atual + maior licitante). É um **evento próprio**, fora do turno em andamento (abrir/encerrar não altera a vez).
- **Cronômetro por lote:** cada lote tem seu **próprio prazo** (padrão **24s**, v1.25). Um lance **reinicia só o prazo daquele lote** — dar lance no lote B **não** mexe no relógio do lote A. Quando o prazo de um lote zera sem novo lance, **aquele lote fecha sozinho** (independente dos demais); o pregão acaba quando o último fecha.
- **O prazo é visível** (v1.25): cada lote mostra contagem regressiva derivada do prazo **autoritativo** do servidor, nunca de um relógio local. Prazo que o servidor conhece e a tela esconde vira susto, não decisão.
- **Lances:** valem as regras gerais (Seção 7.2 — lance mínimo do tema, maior que o atual daquele lote). Um jogador pode liderar/arrematar **vários** lotes, limitado pelo caixa: a soma dos seus lances líderes nunca pode exceder seu caixa (trava de solvência).
- **Resultado de cada lote:** ao fechar, o lote com licitante vai ao maior lance (paga ao banco, recebe a escritura); lote **sem lance permanece livre** (com o banco).
- **Um lance por vez, sem duplicata:** o comando de lance é idempotente por valor — reenviar o mesmo lance no mesmo lote não o cobra duas vezes nem reinicia o prazo de novo.

> 📌 Duração do cronômetro por lote (24s) é tunável no tema. Era 8s até a v1.24; a [D-060](adr/D-060-leilao-de-escassez-restaurado-com-janela-legivel.md) subiu para 24s porque 8s é menos que o tempo de ler o nome da cidade, achá-la no tabuleiro e conferir o próprio caixa.

### 7.4 Espólio do Falido

Ver §9.2 — o espólio usa o formato da §7.3.

### 7.5 Pregão de Terrenos (escassez)

**(v1.25, [D-060](adr/D-060-leilao-de-escassez-restaurado-com-janela-legivel.md), restaurando a [D-023](adr/D-023-leilao-de-escassez-de-terrenos-pregao-simultaneo.md))** Mecanismo de fim de jogo que evita a partida se arrastar esperando alguém *cair* nos últimos terrenos livres. Aqui leiloam-se **terrenos** (cidades/aeroportos/utilidades sem dono), no formato da §7.3.

- **Gatilho:** quando o número de terrenos compráveis **sem dono** cai a **≤ 3** (mas ≥ 1) **e** há **≥ 2 jogadores não-eliminados**, abre-se automaticamente um pregão por esses terrenos.
- **Uma vez por episódio:** dispara uma única vez por "descida a ≤3"; sobras sem lance voltam ao fluxo normal (cair-e-comprar) e não reabrem o pregão. Só re-arma se a contagem subir acima do limiar — falência que devolve terreno, desistência (§9.6), devolução ao banco (§6.4) — e voltar a cair.
- **A contagem é visível** (v1.25): enquanto não há pregão aberto, a interface mostra **quantos terrenos livres ainda faltam** para o gatilho, derivado do estado do motor. Quando o pregão abre, o contador dá lugar ao estado do leilão.
- **Cruzamento com o espólio:** se um espólio (§9.2) abrir durante um pregão de escassez, os lotes dele **entram no mesmo pregão** e a procedência passa a ser mista.

> 📌 Fecha o tabuleiro com donos → mais aluguel circulando → fim de jogo mais rápido, com um clímax de pregão. Limiar (3) é tunável no tema.

---

## 8. Negociação entre Jogadores

### 8.1 Quando pode ocorrer

Qualquer jogador pode propor uma negociação a qualquer outro a **qualquer momento** — inclusive fora do seu turno.

### 8.2 Composição de uma Proposta

De cada lado (proponente e destinatário), qualquer combinação de:

- Uma ou mais propriedades (incluindo hipotecadas).
- Dinheiro em qualquer valor.
- **Bus Tickets** em qualquer quantidade que o lado possua (ver Seção 10.7; D-028, v1.4).
- **Imunidade de aluguel** (ver Seção 8.4).

> 📌 Construções (casas/hotéis) **NÃO** podem ser negociadas diretamente. Devem ser vendidas ao banco antes.
>
> 📌 **Cartas em mão NÃO podem ser negociadas** (Acaso/Tesouro de qualquer raridade, incluindo "Saia da Prisão" e "Aquisição Hostil"). **Bus Tickets SÃO negociáveis** — trocam de mão como contadores, sem taxa (D-028, v1.4). Ver Seção 10 para detalhes do sistema de cartas.

### 8.3 Fluxo de Negociação

1. Proponente abre o modal, seleciona destinatário e monta proposta.
2. Proposta enviada ao destinatário.
3. Destinatário **ACEITA** ou **RECUSA**.
4. Se aceita: a troca é processada automaticamente.
5. Se recusa: a proposta é descartada. O proponente pode fazer nova oferta.

Várias propostas podem permanecer ativas ao mesmo tempo, inclusive do mesmo proponente ou entre o mesmo par de jogadores. Uma proposta ativa **não reserva ativos** e não impede nenhum jogador de criar outra. Cada proposta é respondida separadamente pelo destinatário; aceitar ou recusar uma delas não altera as demais.

No momento da aceitação, todos os ativos e valores são revalidados contra o estado atual. Se a composição deixou de ser válida, a troca não é processada e a proposta permanece disponível para recusa.

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

### 8.5 Trava de Esvaziamento

> Seção introduzida em v1.21 ([D-055](adr/D-055-troca-exige-contrapartida-minima.md)) como piso proporcional; reescrita em v1.23 pela [D-058](adr/D-058-troca-e-livre-ate-o-esvaziamento.md), que a substitui.

Negociação desequilibrada é **livre em qualquer proporção** — três propriedades por uma, um país por $200, pagar caro, vender barato. Valor é subjetivo entre jogadores e o jogo não legisla sobre ele. Uma proposta só é recusada em **dois casos**:

1. **Doação pura** — entregar propriedade, Bus Ticket ou dinheiro e não receber **absolutamente nada** em troca (nem imunidade) não é negociação.
2. **Esvaziamento** — a troca não pode deixar um jogador com **menos de um terço do patrimônio** que ele tinha antes dela. Patrimônio é a soma de propriedades avaliadas, Bus Tickets e caixa; o que o jogador **recebe** na própria troca conta a favor. Quem entrega quase tudo precisa receber valor real de volta.

- Conceder ou transferir **só imunidades**, mesmo sem nada em troca, é **sempre válido** — imunidade não é patrimônio (vale zero na avaliação, ver abaixo) e evapora se o concedente sair da partida (§9.4).
- A proposta recusada **não pode ser enviada nem aceita**, e o proponente vê na hora o motivo: doação pura pede qualquer contrapartida; esvaziamento diz quanto falta em valor real.
- A verificação acontece na criação da proposta **e de novo na aceitação**, junto da revalidação da §8.3.

**Avaliação** — vale só para esta verificação; nenhum destes valores é cobrado de ninguém:

| Item | Valor avaliado |
|---|---|
| Propriedade livre | Preço de tabela |
| Propriedade hipotecada | Metade do preço de tabela |
| Bus Ticket | $100 cada |
| Imunidade (qualquer duração) | **Zero, dos dois lados** — evapora com a saída de quem a concedeu ou recebeu (§9.4) |
| Dinheiro | Valor nominal |

> 📌 O que essa regra barra é o **abandono com dano dirigido** — entregar o patrimônio inteiro a um jogador escolhido a dedo para decidir a partida dos outros fora do tabuleiro. Abandono tem assinatura objetiva: o jogador sai da troca sem patrimônio. Toda troca que não chega perto disso nem é medida.
>
> 📌 Esta regra **soma-se** à proteção de credor da §9.1 (o devedor com dívida pendente não pode ficar insolvente por causa de uma troca), sem substituí-la.

---

## 9. Falência

### 9.1 Condição de Falência

Esta seção trata da falência **forçada** — a que nasce de uma dívida que o jogador não consegue pagar. A saída **voluntária** tem regra própria em §9.6.

Um jogador está em falência quando não consegue pagar o que deve, mesmo após:

- Vender todas as construções ao banco.
- Hipotecar todas as propriedades.
- Usar todo o dinheiro em caixa.

**A dívida pendente nomeia o devedor** (v1.25, [D-061](adr/D-061-obrigacao-a-outro-jogador-nao-e-truncada.md)), e ele **não precisa ser o jogador da vez**. Toda a mesa aguarda a resolução dela, como já aguarda uma reação a carta ofensiva (§10.6) ou a resposta de um credor a um pedido de empréstimo (§15.2).

**Obrigação a outro jogador nunca é truncada.** Quando uma regra obriga um jogador a pagar **a outro jogador** e o caixa não cobre, o que houver é transferido e **o restante permanece devido**, abrindo dívida pendente:

| Credor | Caixa insuficiente |
|---|---|
| Outro **jogador** (Aniversário §10.6, Aquisição Hostil §10.6, aluguel §4.2) | Paga o que tem; **o restante fica devido** e entra nesta seção |
| **Banco** ou **pote**, valor pequeno e incondicional (multa de prisão §4.11, Honorários, Crise Imobiliária, Conserto de Imóveis, Imposto Federal, Desvalorização Cambial, Multa Ambiental) | Paga o que houver; **o restante não é cobrado** |

> 📌 A linha é **quem é o credor**, não o tamanho do valor. Truncar um pagamento ao banco só faz sair menos dinheiro da economia; truncar um pagamento a um jogador tira dele uma receita à qual a regra lhe deu direito — só o segundo tem parte lesada. Cobrança incondicional que pode falir transforma azar em eliminação, e é por isso que ela trunca em vez de abrir dívida.

**Proteção de credor** — com dívida pendente, o devedor não pode ficar insolvente de propósito: nem por troca (§8.5), nem devolvendo propriedade hipotecada ao banco (§6.4), que fica proibida enquanto a dívida existir.

### 9.2 Destino dos Ativos — Sem Empréstimo Ativo

| Devedor | Destino dos ativos |
|---|---|
| Devia ao banco | Propriedades (sem construções) vão a leilão pelo banco — o **espólio** (ver nota abaixo) |
| Devia a outro jogador | Propriedades (sem construções) transferidas diretamente ao credor. Dinheiro restante também vai ao credor |

> 📌 **Formato do leilão do espólio** (v1.6, [D-031](adr/D-031-espolio-do-falido-vai-a-pregao-simultaneo.md)): o espólio inteiro vai a **pregão simultâneo** — o mesmo formato da Seção 7.3, com cronômetro próprio por propriedade. Licitantes são os jogadores **não-eliminados**; o falido não participa. Vencedor de cada lote paga **ao banco**; lote **sem lance fica livre** (§7.2), voltando ao fluxo de cair-e-comprar. O pregão é **evento autônomo**: abrir não altera a vez, e a eliminação do falido passa o turno normalmente. Se já houver um pregão aberto (outra falência ainda em curso), os lotes do novo espólio **entram nele**. O espólio é só de **propriedades**: o dinheiro em caixa do falido que devia ao banco continua sendo destruído (não há credor para recebê-lo, e a tabela acima só destina caixa quando o credor é um jogador) — D-031 não altera isso.

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

> 📌 **O fim tem classificação e resumo** (v1.9, [D-038](adr/D-038-fim-de-jogo-tem-classificacao-e-resumo.md)): ao terminar, **todas** as telas — inclusive as de quem já foi eliminado — mostram a classificação completa, do 1º ao último. A ordem é a **inversa da ordem de eliminação**: vence quem sobrou, é 2º o último a falir, e é último o primeiro a falir. Cada linha traz o **patrimônio final** (o mesmo cálculo de patrimônio líquido usado por Imposto Federal e Crise Imobiliária: caixa + preço das propriedades, hipotecada pela metade, + custo das construções), **quantas propriedades** o jogador tinha e — para quem caiu — **em que rodada** caiu. O resumo fecha com a **duração da partida** em rodadas e em tempo decorrido. A classificação é derivada do estado da partida, não da tela: por isso o estado registra a ordem de eliminação, o número da rodada e os instantes de início e de fim, e todos veem exatamente a mesma classificação, inclusive depois de recarregar.
>
> 📌 **Depois do resumo, o grupo continua na mesma sala** (v1.19, [D-052](adr/D-052-revanche-reabre-a-mesma-sala.md); refinada em v1.29 pela [D-067](adr/D-067-retencao-leve-fica-na-sala-privada.md)): cada jogador pode deixar a classificação no próprio ritmo e voltar ao lobby da sala. O host reabre a sala e inicia outra partida pelo fluxo normal; assentos e identidades permanecem. Todo estado econômico e mecânico específico da partida encerrada é descartado; somente o resumo limitado da sala atravessa revanches. Em partida local, começar de novo continua disponível.

### 9.6 Desistência (saída voluntária)

**(v1.22, [D-057](adr/D-057-desistencia-voluntaria-encerra-a-participacao.md))** Um jogador pode encerrar a própria participação por vontade própria, sem dever nada a ninguém.

| Aspecto | Desistência (§9.6) | Falência forçada (§9.1) |
|---|---|---|
| Exige insolvência | **Não** — vale com qualquer caixa e qualquer patrimônio | Sim — só quando nem liquidando tudo cobre a dívida |
| Quando | **Só na própria vez**, com a partida em andamento e sem pausa | Quando há dívida pendente que não se consegue pagar |
| Destino dos bens **sem** empréstimo ativo | Propriedades voltam **livres** ao banco (§7.2); **sem pregão de espólio** | Espólio vai a pregão (§9.2) ou ao credor da dívida |
| Destino dos bens **com** empréstimo ativo | **O credor herda tudo**, ativos e passivos — igual ao §9.3 | O credor herda tudo (§9.3) |

- Ao voltarem ao banco, as propriedades perdem **construções**, **Hangar** e **hipoteca**: voltam ao estado de terreno livre e ao fluxo normal de cair-e-comprar. O **caixa restante é destruído**.
- Como a devolução aumenta a contagem de terrenos livres, a desistência é gatilho de reavaliação do **Pregão de Terrenos** (§7.5), assim como a falência e a devolução ao banco (§6.4).
- A **eliminação** segue o §9.4 (token fora, imunidades canceladas), a partida termina pelo §9.5, e quem desistiu entra na **ordem de eliminação** e aparece na classificação final como qualquer outro eliminado.
- A ação **exige confirmação explícita** e é a única do jogo sem desfazer (§12.2).

---

## 10. Sistema de Cartas (Acaso e Tesouro)

### 10.1 Visão Geral

O Magnata Imobiliário tem **2 decks separados** de cartas — **Acaso com 21** e **Tesouro com 18** (v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md)) — distribuídas em 3 níveis de **raridade**:

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

As cópias respeitam a hierarquia de raridade (v1.34,
[D-074](adr/D-074-raridade-de-carta-nao-inverte-probabilidade.md)): o embaralhamento
ponderado usa pesos **Lendária 9 / Rara 10 / Comum 11**, sem exceção por modo. Assim,
toda carta é estritamente menos provável que uma de tier inferior. Lendárias e raras têm
1 cópia por efeito; o excedente necessário para manter os baralhos em 21/18 cartas fica
nas comuns.

### 10.3 Regras Gerais de Cartas

**Privacidade:**
- Cartas em mão são **privadas** — outros jogadores NÃO veem quais cartas você tem.
- Outros jogadores VEEM apenas a **quantidade** total de cartas na sua mão ("Pedro tem 2 cartas").
- **Alcance da garantia** (v1.8, [D-037](adr/D-037-estado-por-perspectiva-a-mao-nao-trafega.md), que revoga a D-030): a privacidade é assegurada **na distribuição**, não só na apresentação — o conteúdo da mão de um jogador **não trafega** para os demais clientes, nem no comando difundido nem no estado lido ao entrar ou reconectar. Cada jogador recebe a mão alheia como **contagem** (§12.3) e o baralho como contagem; inspecionar o próprio cliente não revela carta de ninguém. **Exceção conhecida:** o navegador do **anfitrião** roda a autoridade da partida ([D-020](adr/D-020-modelo-de-autoridade-sincronizacao-host-autoritativo-realtim.md)) e por isso conhece o baralho e todas as mãos — é o que lhe permite validar uma jogada de carta. Fechar também esse caso exige baralho selado sob autoridade de servidor, registrado como caminho e fora do v1. **Segunda exceção:** a janela de reação (§12.2 — Diplomacia, Bunker Fiscal) só abre para quem possui a carta, então a mesa fica sabendo que aquele jogador tem **uma carta de reação** — no instante em que ela está a um clique de ser revelada. A existência daquela reação vaza; o resto da mão, não.

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

### 10.4 Distribuição do Deck ACASO (21 cartas)

**(v1.34, [D-074](adr/D-074-raridade-de-carta-nao-inverte-probabilidade.md), refina as cópias da [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))**

#### 🟧 Lendárias (4 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Aquisição Hostil** | 1 | Mão | 🎯 Próprio turno |
| **Confisco Geral** | 1 | Mão | 🎯 Próprio turno |
| **Imposto Federal** | 1 | Mão | 🎯 Próprio turno |
| **Permuta Forçada** | 1 | Mão | 🎯 Próprio turno |

#### 🟦 Raras (4 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Boicote** | 1 | Mão | 🎯 Próprio turno |
| **Embargo de Obras** | 1 | Mão | 🎯 Próprio turno |
| **Crise Imobiliária** | 1 | Imediato | — |
| **Estatização** | 1 | Imediato | — |

#### 🟩 Comuns (13 cartas)

| Carta | Cópias | Modo |
|---|---|---|
| **Atalho** | 2 | Imediato |
| **Greve** | 1 | Imediato |
| **Desvalorização Cambial** | 1 | Imediato |
| **Obras na Pista** | 1 | Imediato |
| **Multa Ambiental** | 1 | Imediato |
| **Vá direto para a Prisão** | 1 | Imediato |
| **Volta para o GO** | 1 | Imediato |
| **Conserto de Imóveis** | 1 | Imediato |
| **Avance 3 casas** | 2 | Imediato |
| **Volte 3 casas** | 2 | Imediato |

### 10.5 Distribuição do Deck TESOURO (18 cartas)

**(v1.34, [D-074](adr/D-074-raridade-de-carta-nao-inverte-probabilidade.md), refina as cópias da [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))**

#### 🟧 Lendárias (2 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Diplomacia** | 1 | Mão | ⚡ Reação |
| **Imunidade Total** | 1 | Mão | 🎯 Próprio turno |

#### 🟦 Raras (4 cartas)

| Carta | Cópias | Modo | Timing |
|---|---|---|---|
| **Saia da Prisão** | 1 | Mão | 🔒 Preso |
| **Bunker Fiscal** | 1 | Mão | ⚡ Reação |
| **Boom Econômico** | 1 | Imediato | — |
| **Valorização** | 1 | Mão | 🎯 Próprio turno |

#### 🟩 Comuns (12 cartas)

| Carta | Cópias | Modo |
|---|---|---|
| **Investidor Anjo** | 2 | Imediato |
| **Passagem de Ônibus** | 2 | Imediato (adiciona Bus Ticket) |
| **Resgate do Pote** | 1 | Imediato |
| **Obra Relâmpago** | 1 | Imediato |
| **Incentivo Fiscal** | 1 | Imediato |
| **Erro do banco a seu favor** | 2 | Imediato |
| **Aniversário** | 2 | Imediato |
| **Honorários médicos** | 1 | Imediato |

### 10.6 Catálogo de Efeitos por Carta

#### 🟧 Cartas Lendárias

**Aquisição Hostil** (Acaso)
> Escolha uma propriedade de outro jogador. Ele é obrigado a vendê-la para você pela **metade do preço de tabela** (v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md)). Restrições:
> - A propriedade **não pode ter construções** (incluindo Hangar em aeroportos).
> - O alvo deve possuir **pelo menos 2 propriedades não-hipotecadas** no momento.
> - Propriedade hipotecada é transferível conforme Seção 6.3 (com regras de transferência de hipoteca).
> - **Aeroportos e Utilidades:** a sobretaxa de **1,5×** incide sobre a metade (compensação ao dono pela perda do escalonamento).
> - Não pode ser usada em propriedade do próprio jogador.
> - O alvo **NÃO pode recusar**.

**Confisco Geral** (Acaso) — ex-Despejo (v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Escolha 1 propriedade de outro jogador que tenha construção. **Todas as construções dela** (casas, hotéis e arranha-céu) são demolidas — retornam ao banco. O dono **mantém o terreno** e NÃO recebe nada. Não afeta a uniformidade obrigatória do grupo do alvo (ele pode reconstruir depois).

**Imposto Federal** (Acaso) — ex-Auditoria Fiscal (v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Escolha um jogador. Ele paga **25% do patrimônio líquido** (dinheiro + propriedades + construções) ao banco. O valor vai para o **centro do tabuleiro** (Free Parking — Seção 13.4).

**Permuta Forçada** (Acaso — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Escolha **uma propriedade sua** e **uma propriedade de um adversário**: elas trocam de dono, sem dinheiro envolvido e **sem restrição de preço**. Nenhuma das duas pode ter construção (casa, hotel, arranha-céu ou Hangar). Propriedade hipotecada transfere conforme Seção 6.3. O alvo **NÃO pode recusar** (Diplomacia reage).

**Diplomacia** (Tesouro)
> **Reação.** Cancela uma carta ofensiva sendo usada contra você (Aquisição Hostil, Confisco Geral, Imposto Federal, Boicote, Permuta Forçada, Embargo de Obras). A carta cancelada é descartada como se tivesse sido usada (volta ao fundo do deck).

**Imunidade Total** (Tesouro) — ex-Imunidade Temporária (v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Por **1 volta completa** do tabuleiro, **você** não paga **aluguel** nem **imposto algum** (imposto de casa, Crise Imobiliária, Conserto, multas de carta) e não pode ser alvo de **efeito negativo** (Aquisição Hostil, Confisco Geral, Imposto Federal, Boicote, Permuta Forçada, Embargo de Obras, cobranças de carta alheia como Aniversário).

#### 🟦 Cartas Raras

**Boicote** (Acaso)
> Escolha 1 propriedade de outro jogador. Por **2 voltas completas**, ela **não cobra aluguel** de nenhum jogador que parar nela.

**Embargo de Obras** (Acaso — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Escolha um adversário. Por **2 voltas completas**, ele **não pode construir** (casas, hotéis, arranha-céus ou Hangares).

**Crise Imobiliária** (Acaso, imediato)
> Todos os **adversários** de quem sacou pagam **10% do patrimônio líquido** ao banco (v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md) — quem sacou não paga). O valor total arrecadado vai para o **centro do tabuleiro** (Free Parking).

**Estatização** (Acaso, imediato — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Por **2 voltas completas**, **todo aluguel** pago na mesa vai **direto para a Loteria** (centro do tabuleiro, Seção 13.4) em vez do dono da propriedade.

**Valorização** (Tesouro — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Escolha uma propriedade sua. Por **1 volta completa**, ela cobra **aluguel em dobro**.

**Saia da Prisão** (Tesouro)
> Use a qualquer momento em que estiver preso para sair sem pagar a multa. Após uso, volta ao fundo do deck.

**Bunker Fiscal** (Tesouro)
> **Reação.** Cancela o próximo pagamento de imposto que você teria que fazer (Income Tax, Luxury Tax, Imposto Federal recebido).

**Boom Econômico** (Tesouro, imediato)
> Todos os jogadores recebem **$200** do banco.

#### 🟩 Cartas Comuns novas

**Atalho** (Acaso, imediato)
> Mova-se até 3 casas para frente ou para trás (jogador escolhe). Resolve a casa onde parar normalmente. Se passar pelo GO indo para trás, NÃO recebe bônus.

**Greve** (Acaso, imediato) — funde Apagão + Greve nas Utilidades (v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Por **1 volta completa**, todos os Hangares ficam inativos (aeroportos voltam ao aluguel base, Seção 13.6) **e** as 2 utilidades não cobram aluguel.

**Desvalorização Cambial** (Acaso, imediato — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Pague **10% do seu dinheiro em caixa** (arredondado) ao **centro do tabuleiro** (Free Parking). Patrimônio em propriedades não conta — a carta pune caixa parado.

**Obras na Pista** (Acaso, imediato — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Vá ao **aeroporto mais próximo** no sentido do movimento (recebe bônus se cruzar o GO). Se ele tiver dono, pague **aluguel em dobro**; se estiver livre, pode comprá-lo normalmente.

**Multa Ambiental** (Acaso, imediato — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Pague **$50 + $50 por hotel, 2º hotel ou arranha-céu** que possui, ao **centro do tabuleiro** (Free Parking). Sem construção pesada, paga só a base.

**Investidor Anjo** (Tesouro, imediato)
> Sua próxima compra de propriedade tem **20% de desconto**. Efeito ativo até a próxima compra ou até o fim da partida (o que vier primeiro).

**Passagem de Ônibus** (Tesouro, imediato)
> Você ganha **1 Bus Ticket** (ver Seção 10.7).

**Resgate do Pote** (Tesouro, imediato — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Receba **metade da Loteria** acumulada no centro do tabuleiro (arredondada para baixo). A outra metade permanece no pote.

**Obra Relâmpago** (Tesouro, imediato — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Sua **próxima construção sai de graça** (casa, hotel, arranha-céu ou Hangar). Efeito ativo até a próxima construção ou até o fim da partida.

**Incentivo Fiscal** (Tesouro, imediato — v1.26, [D-064](adr/D-064-rebalanceamento-do-catalogo-de-cartas.md))
> Receba **$50 por propriedade hipotecada** que possui. Sem hipoteca, a carta não tem efeito.

#### 🟩 Cartas Comuns clássicas

**Vá direto para a Prisão** (Acaso)
> Vá imediatamente para a casa Prisão (índice 12). **NÃO** recebe bônus do GO se passar por ele. Não move mais no turno.

**Volta para o GO** (Acaso)
> Mova-se diretamente para a casa GO. Recebe o bônus em dobro ($400 — parou exatamente no GO, Seção 13.5).

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
>
> Adversário sem caixa para os $50 paga o que tem e **continua devendo o restante** (v1.25, [D-061](adr/D-061-obrigacao-a-outro-jogador-nao-e-truncada.md)): a diferença abre dívida pendente **dele**, resolvida pelo §9.1 fora da vez. O aniversariante recebe o valor cheio da carta — em duas parcelas, se preciso.

**Honorários médicos** (Tesouro)
> Pague **$50** ao banco. Valor vai para o **centro do tabuleiro** (Free Parking).

> 📌 Cartas clássicas que dependem de estado do jogador (ex: Conserto de Imóveis, Incentivo Fiscal) não têm efeito se o estado não se aplica (ex: jogador sem construções não paga nada). A carta ainda volta ao fundo do deck após saque.

### 10.7 Bus Tickets

Bus Tickets são **itens de mão separados** das cartas. Permitem flexibilidade de movimento.

**Como obter:**
- Sacar a carta **Passagem de Ônibus** (Tesouro, Comum). Cada saque dessa carta concede **1 Bus Ticket**.

**Regras:**
- Bus Tickets têm **contador próprio** — não consomem o limite de 3 cartas na mão.
- **Sem limite** de Bus Tickets acumuláveis.
- São **privados** (outros jogadores veem apenas a quantidade).
- **PODEM ser negociados** — entram na proposta como contador de cada lado (Seção 8.2; D-028, v1.4).

**Como usar:**
- Durante o próprio turno, em duas janelas (034): **antes de rolar os dados** OU **no fim do turno**, depois de já ter rolado e resolvido a casa onde caiu. Pode encadear: rolar → comprar → usar o ticket → cair noutra casa do mesmo lado → comprar também → finalizar.
- Ao usar 1 Bus Ticket, o jogador escolhe uma casa no **mesmo lado do tabuleiro** em que está atualmente e **pula direto** para lá (sem rolar/sem nova rolagem).
- Resolve a casa de destino normalmente.
- Após usar o Bus Ticket, o turno do jogador continua normalmente (ações facultativas e finalizar turno).
- O Bus Ticket é um **pulo direto** dentro do mesmo lado: **não percorre o tabuleiro e NÃO cruza o GO** — portanto não recebe o bônus de GO (revisão pós-playtest 2026-05-24; antes dava a volta no sentido horário e podia cruzar o GO).

> 📌 Os "lados do tabuleiro" são as 4 sequências de 11 casas entre os cantos. Lado 1: casas 1–11 (entre GO=0 e Prisão=12). Lado 2: casas 13–23 (entre Prisão=12 e Férias=24). Lado 3: casas 25–35 (entre Férias=24 e Vá-pra-Prisão=36). Lado 4: casas 37–47 (entre Vá-pra-Prisão=36 e GO).

---

## 11. Sala, Lobby e Sessão

### 11.1 Criação de Sala

- Host cria a sala e recebe um link único.
- **Mapa da sala** (v1.30, [D-069](adr/D-069-segundo-mapa-jogavel-cidade-da-fuligem.md)): o host escolhe o mapa (`atlas` ou `fuligem`) **antes** de criar a sala; o identificador fica gravado na sala e **não pode ser alterado** depois. Todos os participantes — convidado pelo link, reload, reconexão — recebem o mesmo mapa da autoridade; sala antiga ou sem identificação usa `atlas`. A escolha nunca depende apenas de estado local do navegador.
- Host tem poderes especiais: **kickar jogadores**, **escolher o Ritual de Largada** e **iniciar a partida**. Em Maior dado, iniciar abre a sequência compartilhada de rolagens; nos dois modos, a mesa entra no tabuleiro automaticamente depois da revelação.
- Sala suporta de 2 a 8 jogadores humanos.
- Host pode iniciar com pelo menos 2 jogadores.

### 11.2 Entrada na Sala

- Qualquer pessoa com o link entra antes da partida iniciar.
- Cada jogador escolhe **nome**, **cor**, **avatar** e **skin** antes de entrar. A cor é **única na sala**; avatar e skin não são exclusivos e podem se repetir.

> 📌 **Avatar é o próprio token e Skin é sua camada visual** (v1.14, [D-047](adr/D-047-avatares-escolhiveis-e-persistentes.md)): a peça separada (avião, navio, trem…) continua removida. O jogador escolhe independentemente uma das cinco formas finais do `PlayerFace` — **Clássico Vivo, Olhos Orbitais, Linha Única, Prisma ou Totem** — e uma das oito skins — **Careca, Cavanhaque, Topete, Cartola, Safári, Aviador, Robô ou Astronauta**. Toda combinação é válida. A mesma composição aparece no lobby, no token que percorre o tabuleiro e nas superfícies de identidade da partida. As duas escolhas persistem no assento e sobrevivem à reconexão; salas antigas usam Clássico Vivo + Careca. A cor continua única e continua sendo o distintivo obrigatório verificado sob dicromacia ([D-045](adr/D-045-paleta-de-assentos-derivada-em-oklch.md)); avatares e skins podem se repetir.
- Após início, não é possível adicionar novos jogadores.

### 11.3 Desconexão e Reconexão

- Se qualquer jogador **ainda em jogo** desconectar, a partida **pausa automaticamente**.
- Mensagem é exibida a todos sobre o jogador desconectado.
- A partida retoma automaticamente quando ele reconectar.
- Propriedades do jogador desconectado **NÃO** vão ao banco durante a pausa.
- Reconexão é pelo mesmo link da sala; estado é carregado do servidor.
- Se o desconectado for o **host**: a partida pausa e aguarda o host reconectar. Não há transferência de host.
- **Exceção — jogador eliminado** (D-029, v1.5): a desconexão de quem já foi **eliminado por falência** (§9.4) **NÃO** pausa a partida. Ele mantém o assento e pode reabrir o link para acompanhar, mas sua ausência nunca trava a mesa — não há patrimônio nem turno a proteger, e como não existe timeout de desconexão, a regra literal deixaria a partida refém de quem já perdeu.

> 📌 **Não há timeout de desconexão** — a partida pode ficar pausada indefinidamente.

> 📌 **A pausa tem causa** (v1.7, [D-034](adr/D-034-persistencia-indisponivel-pausa-a-partida.md)): desconexão de jogador em jogo (§11.3) e persistência indisponível (§11.4) são causas distintas do **mesmo** estado de pausa, e podem estar ativas ao mesmo tempo. A partida só retoma quando **nenhuma** causa persiste, e a mensagem exibida diz **qual** delas está segurando a mesa. Prazos em voo (leilão, pregão, janela de reação) são deslocados pelo intervalo **inteiro** da pausa — não pelo da última causa a se resolver.

### 11.4 Persistência de Sessão

- Em caso de reload acidental, o cliente recupera o estado atual da partida e sincroniza.
- **Reentrada de outro dispositivo** (v1.7, [D-033](adr/D-033-codigo-de-reentrada-por-assento.md)): cada assento tem um **código de reentrada** curto, visível para o dono ao lado do link da sala. Quem apresentar **link + código** reanexa ao assento de qualquer aparelho ou navegador, mesmo tendo perdido o token de sessão do dispositivo original (celular sem bateria, dados do navegador limpos, aba anônima encerrada). O código não expira e não é revogável; o token anterior deixa de valer para aquele assento. Sem isso, um assento irrecuperável travaria a mesa indefinidamente — não há timeout de desconexão (§11.3) e ninguém, nem o anfitrião, pode remover jogador depois do início.
- **Durabilidade antes do avanço** (v1.7, [D-034](adr/D-034-persistencia-indisponivel-pausa-a-partida.md)): nenhum comando aceito avança a partida sem estar gravado. Se a gravação falhar de forma persistente, a partida **pausa** (§11.3) até a persistência voltar, em vez de seguir sobre um estado que um reload faria regredir.

> 📌 **Falha de interface não é perda de partida** (v1.8, [D-035](adr/D-035-falha-de-interface-nao-derruba-a-partida.md)): um erro inesperado na interface de um jogador **não** encerra a partida dele nem a dos outros. A tela quebrada é substituída por uma tela que diz o que aconteceu, o que está preservado e como voltar — pelo mesmo link, ou pelo código de reentrada do assento (§11.4). Enquanto a sessão daquele jogador continuar de pé, a mesa não sente nada; se ela cair junto, a ausência é comunicada como **desconexão** (§11.3), sem causa de pausa nova. Em partida local (sem sala), não há estado durável a recuperar, e a tela diz isso em vez de prometer recuperação.

### 11.5 Integridade da Sessão

Regras de v1.10, introduzidas por [D-042](adr/D-042-identidade-de-transporte-atestada-pelo-servidor.md) e [D-036](adr/D-036-acesso-a-sala-autorizado-no-servidor.md).

- **Ninguém age em nome de outro.** A identidade de quem envia um comando é **atestada pelo servidor**, não declarada pelo cliente. Comando enviado em nome de assento alheio não é aceito — e a recusa não depende de o programa do jogador se comportar bem.
- **Só a autoridade fala pela mesa.** Estado de partida e estado de sala são publicados exclusivamente pela autoridade (o anfitrião, §11.3). Mensagem que se apresente como vinda dela sem vir dela é recusada **no servidor**.
- **Presença é do próprio.** Conexão e desconexão de um assento só podem ser anunciadas por aquele assento — ninguém provoca a pausa da mesa (§11.3) fingindo a queda de outro.
- **O código de reentrada é segredo do dono** (§11.4). Não é exibido nem transmitido a outros jogadores: é a credencial que reanexa um assento, e quem o tivesse poderia tomar o assento alheio.
- **O link entra, não lê.** O link da sala continua sendo a credencial de **entrada** (§11.2, D-019): quem o apresenta vê a **prévia** da sala — que ela existe, seu status e quem já sentou — e pode pedir assento. O **estado da partida** só é legível por quem tem assento nela.

### 11.6 Revanche na Mesma Sala

Regras de v1.19, introduzidas pela [D-052](adr/D-052-revanche-reabre-a-mesma-sala.md).

- Ao terminar a partida, cada jogador pode sair da classificação e voltar ao lobby da **mesma sala**.
- O host preserva sua autoridade e é quem reabre a sala e inicia a próxima partida.
- A sala preserva assentos, nomes, cores, Avatar, Skin, códigos de reentrada e estado de conexão.
- A próxima partida não começa automaticamente: o host escolhe novamente o Ritual de Largada e confirma o início.
- O estado econômico e mecânico da partida anterior não atravessa a revanche: caixa, posições, propriedades, construções, cartas, efeitos, imunidades, empréstimos, negociações, leilões, ordem, Loteria, decks e log são recriados. A classificação completa permanece apenas no resumo limitado da sala (§11.7).
- A classificação encerrada permanece estável para quem ainda não saiu dela; a volta de outro jogador não apaga o resumo local.
- Reload e mensagens atrasadas não podem restaurar o jogo encerrado depois que a sala foi reaberta. A versão vigente da mesa é sempre a publicada pela autoridade.

### 11.7 Histórico, Estatísticas e Presets da Sala

Regras de v1.29, introduzidas pela [D-067](adr/D-067-retencao-leve-fica-na-sala-privada.md).

- A sala privada guarda as **10 partidas finalizadas mais recentes** e mostra esse histórico somente no lobby de revanche. Antes da primeira partida, há apenas um estado vazio discreto.
- Cada partida entra uma única vez, identificada por sua geração. Reload, repetição de snapshot e mensagem atrasada não duplicam nem removem uma geração já preservada.
- Cada entrada registra somente geração, instante de término, duração, quantidade de rodadas, classificação, nome e identidade visual dos assentos, patrimônio final, quantidade de propriedades e rodada de eliminação quando aplicável.
- Mãos, cartas, negociações privadas, log completo, credenciais e códigos de reentrada nunca são preservados no histórico.
- Todos os integrantes da sala veem o mesmo histórico publicado pela autoridade. Sala antiga ou sem histórico continua válida e equivale a histórico vazio.
- As estatísticas são derivadas do histórico: partidas, vitórias, taxa de vitória, colocação média e melhor patrimônio final por jogador; duração média e média de rodadas para a sala. Não existem contadores narrativos novos no motor.
- O histórico não cruza salas e não cria conta, perfil, ranking público, leaderboard, replay, matchmaking nem analytics individual.
- Um **preset de sala** é somente um mapeamento nomeado para configurações já suportadas. “Leilão secreto” seleciona `sealed-bid`; “Maior dado” seleciona `dice-roll`. O host escolhe antes do início e todos veem a configuração publicada.
- A preferência local do navegador pode preencher a escolha inicial de uma sala nova do host, mas nunca substitui o estado publicado de uma sala existente. Convidado não altera preset e a escolha não muda depois que a partida começa.


---

## 12. Interface e Experiência do Usuário

### 12.1 Layout do Tabuleiro

Visão 2D de cima, quadrada, com o número de casas e a topologia do mapa ativo. O interior
exibe HUD, log de eventos e demais superfícies funcionais. Na Cidade da Fuligem, as 40
casas devem aproveitar a área liberada para exibir nomes completos; o miolo não mostra
nomes de regiões nem divisórias decorativas.

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
| Usar Confisco Geral | Jogador ativa a carta — escolhe propriedade construída do adversário |
| Usar Imposto Federal | Jogador ativa a carta — escolhe alvo |
| Usar Boicote | Jogador ativa a carta — escolhe propriedade alvo |
| Usar Imunidade Total | Jogador ativa a carta — sem alvo (protege o próprio jogador) |
| Diplomacia disponível (reação) | Jogador é alvo de carta ofensiva — pergunta se quer usar Diplomacia |
| Bunker Fiscal disponível (reação) | Jogador deve pagar imposto — pergunta se quer usar Bunker |
| Aquisição Hostil sofrida (notificação) | Jogador perdeu propriedade — visualizar transferência |
| Usar Bus Ticket | Jogador ativa antes de rolar — escolhe casa do mesmo lado |
| Fim de jogo | Último jogador restante — classificação completa e resumo (§9.5, [D-038](adr/D-038-fim-de-jogo-tem-classificacao-e-resumo.md)) |
| Empréstimo (solicitação) | Devedor solicita empréstimo durante seu turno |
| Empréstimo (recebido) | Credor recebe solicitação |
| Free Parking coletado | Jogador para em Férias com prêmio acumulado |
| Speed Die — escolha de dado (Ônibus) | Resultado da face Ônibus |
| Speed Die — escolha de casa (Triples) | Triples nos dados |
| Hangar | Jogador deseja construir hangar em aeroporto próprio |

> 📌 **A cobrança de dívida NÃO é modal** (v1.21, [D-056](adr/D-056-cobranca-de-divida-sai-do-centro-da-tela.md)). Ela aparece como **cartão no miolo do tabuleiro**, dentro do anel de casas (v1.28, [D-066](adr/D-066-cobranca-de-divida-vai-para-o-miolo-do-tabuleiro.md)): **não cobre casa nenhuma e não reposiciona o tabuleiro** — a decisão de o que hipotecar ou vender é tomada olhando o tabuleiro inteiro, que continua parado e clicável no lugar em que estava. A cobrança não escurece a tela além do próprio miolo, não captura nem prende o foco, e Esc continua sem fechá-la (§12.6): sai-se dela pagando, negociando ou declarando falência (§9.1). Ela mostra, na ordem: a quem se deve, quanto, o caixa atual, quanto falta e **quanto ainda dá para levantar** vendendo construções e hipotecando tudo — este último é a mesma medida que autoriza o botão de falência. A escolha de credor para empréstimo abre a partir do cartão, sem empilhar um botão por adversário.
>
> A cobrança é do **devedor nomeado** na dívida (v1.25, [D-061](adr/D-061-obrigacao-a-outro-jogador-nao-e-truncada.md)), que pode não ser o jogador da vez. Quem não é o devedor vê, no lugar dela, quem a mesa está aguardando — mesmo tratamento que a janela de reação (§10.6) e o pedido de empréstimo (§15.2) já recebem.
>
> O modal de **Leilão** preserva o tabuleiro e os saldos de todos os jogadores totalmente
> legíveis. Pode bloquear comandos fora do modal e manter o foco acessível, mas não aplica
> desfoque nem véu opaco sobre os painéis laterais: conhecer o caixa dos adversários é
> informação estratégica para o lance.

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
- **Efeitos ativos no tabuleiro** (Greve, Estatização, Boicotes, Valorizações, Embargos e Imunidades ativos) — visíveis a todos.
- **Caixa líquido durante dívida** (v1.25, [D-061](adr/D-061-obrigacao-a-outro-jogador-nao-e-truncada.md)): quando um jogador deve mais do que tem, o HUD mostra o **líquido real** (caixa − obrigação pendente). Líquido negativo aparece em **vermelho** e acompanhado de texto — nunca só por cor (§12.6) —, com **quanto ainda falta pagar**. Vale para o devedor **e** para os adversários: a mesa precisa saber que há dívida em resolução e de quem, inclusive quando o devedor não é o jogador da vez. O modelo econômico não muda: o caixa continua nunca ficando negativo no estado, o negativo é uma **leitura** de caixa menos obrigação.
- **Terrenos livres até o pregão** (v1.25, [D-060](adr/D-060-leilao-de-escassez-restaurado-com-janela-legivel.md)): quantos terrenos sem dono ainda faltam para o gatilho da §7.5, derivado do motor, nunca negativo, preservado após reconexão. Com o pregão aberto, o contador dá lugar ao estado do leilão.
- **Log de eventos completo** (v1.25, [D-063](adr/D-063-toda-mutacao-de-caixa-tem-causa-registrada.md)): **nenhuma** regra move caixa sem fato correspondente no log. Toda mudança de caixa tem motivo registrado — saldo anterior, valor, motivo e saldo final —, inclusive as que acontecem fora da vez do jogador afetado (cartas que cobram de todos §10.6, Aquisição Hostil e Imposto Federal §10.6) e as que movem caixa de mais de um jogador de uma vez (troca §8.3).

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

### 12.6 Acessibilidade e Responsividade

> Seção nova em v1.9, apoiada em [D-039](adr/D-039-acessibilidade-aa-no-caminho-de-jogo.md).

**Alvo:** WCAG 2.2 nível **AA** no **caminho de jogo** — home, lobby, tabuleiro e HUD, modais de decisão (§12.2), superfícies de pausa/reconexão (§11.3/§11.4) e fim de jogo (§9.5). O alvo é verificado automaticamente e bloqueia a publicação (§12.8). Fora do caminho de jogo (popovers informativos, superfícies de diagnóstico) o alvo é o mesmo, sem verificação automatizada.

| Compromisso | Regra |
|---|---|
| Teclado | Todo controle é alcançável e operável por teclado, na ordem visual, sem armadilha de foco |
| Foco | Sempre visível, com contraste próprio; modal recebe o foco ao abrir e o devolve a quem o abriu ao fechar |
| Esc | Fecha modal **informativo**. **Não** fecha modal que decide a partida (compra, leilão, reação, dívida, descarte) — Esc não pode virar comando |
| Nome acessível | Todo ícone ou imagem com significado tem nome; ícone decorativo é ocultado do leitor de tela |
| Anúncio | O log de eventos é região viva educada; "sua vez" e prazo vencendo são anunciados com urgência |
| Cor | Nunca é o único canal: posse, jogador da vez, raridade de carta e status de conexão têm segundo sinal |
| Contraste | ≥ 4,5:1 para texto e ≥ 3:1 para elemento de interface e indicador de foco |
| Alvo de toque | ≥ 24 × 24 px no caminho de jogo |
| Movimento | `prefers-reduced-motion` respeitado em toda animação; com movimento reduzido o fato continua legível — nenhuma informação existe só na animação |
| Zoom | Até 200% sem perda de função |

> 📌 **Exceção de contraste, medida e aceita** (2026-07-26, spec 044): as **bordas de superfície** (`--color-ink-500`, `--color-coffee-500` — borda de todo cartão, campo e botão) medem **~1,5–1,7:1** contra os fundos escuros, abaixo do 3:1 exigido para elemento de interface. Corrigir significaria clarear um token onipresente e mudar a aparência de toda borda do jogo; o autor decidiu **manter a identidade visual**. A exceção é **só da borda decorativa**: contraste de **texto** (≥4,5:1) e do **indicador de foco** (≥3:1) continuam obrigatórios e verificados. Nenhuma informação depende de enxergar a borda — ela separa superfícies que já se distinguem por preenchimento. Revisitar quando houver referência visual nova.

**Orientação e tamanho:** o tabuleiro é servido em **paisagem**, a partir de 740 × 360 px (celular em paisagem) e 1024 × 768 px (tablet). Em **retrato**, o produto exibe um aviso para girar o aparelho em vez de servir a mesa ilegível — a sessão não é perdida na rotação, e a tela de aviso segue as mesmas regras acima. Nenhuma superfície do caminho de jogo exige rolagem horizontal; modal que não cabe rola por dentro.

### 12.7 Telemetria Mínima

> Seção nova em v1.9, apoiada em [D-040](adr/D-040-telemetria-minima-anonima.md).

O produto registra o mínimo necessário para saber se as partidas **começam e terminam**, e para diagnosticar falha relatada por jogador:

| O quê | Onde | Conteúdo |
|---|---|---|
| Sala criada, partida iniciada, partida finalizada, partida pausada por causa | Tabela própria no Supabase do projeto, só inserção | Contagem de jogadores, rodadas, duração, causa da pausa |
| Exceção contida (§11.4, [D-035](adr/D-035-falha-de-interface-nao-derruba-a-partida.md)) | Serviço de monitoramento de erro | Identificador da ocorrência, mensagem, pilha |

Invariantes:

- **Anônimo.** Nenhum nome de jogador, mão de cartas, token de sessão ou código de reentrada (princípio VI, §11.4). O **id da sala nunca trafega em claro** — ele é credencial de acesso (§11.1); só um identificador derivado e irreversível correlaciona eventos da mesma partida.
- **Sem efeito na partida.** Falha de envio não pausa, não bloqueia comando e não vira causa de pausa (§11.3).
- **Desligável.** Sem configuração de ambiente, o produto funciona inteiro e não envia nada; desenvolvimento não emite.
- **Contagem, não comportamento.** Mede partidas, não pessoas: sem perfil, sem funil por jogador, sem rastreio entre salas.

### 12.8 Publicação

> Seção nova em v1.9, apoiada em [D-041](adr/D-041-publicacao-em-vercel-com-gate-verde.md). Decisão técnica — nenhuma regra de jogo depende dela.

A versão em produção só é promovida a partir da linha principal e **depois** de todos os gates automatizados verdes, incluindo a auditoria de acessibilidade (§12.6) e uma partida completa exercitada de ponta a ponta. Toda proposta de mudança ganha um ambiente navegável próprio. Voltar à versão anterior é um passo, sem reconstrução. As migrations do banco fazem parte do lançamento, não do deploy.

---

## 13. Mecânicas de Balanceamento

Esta seção descreve as mecânicas adicionadas ao Magnata Imobiliário para corrigir os desequilíbrios estruturais do Monopoly/Richup.io.

### 13.1 Problemas Identificados

| Problema | Descrição |
|---|---|
| First-mover advantage | Quem joga primeiro chega antes às propriedades. Com 8 jogadores, o último encontra o tabuleiro quase todo comprado na 1ª volta |
| Gate de grupo completo | Construção exige grupo completo → dependência total de negociação. Um jogador não-cooperativo pode bloquear outro indefinidamente |
| Jogador travado | Jogador sem territórios = $0 de poder de negociação. Mesmo com dinheiro, está funcionalmente eliminado |
| Partida arrastada | Resultado decidido nos primeiros 15 minutos, mas partida continua por horas |

### 13.2 Speed Die (Dado de Velocidade)

> Personagem renomeado de "Mr. Banco Master" para "Mr. Magnata" em v1.20, apoiado em [D-053](adr/D-053-projeto-renomeado-para-magnata-imobiliario.md).

Terceiro dado especial baseado na mecânica oficial do Monopoly (edição 2006+). Ativado após o jogador completar a **primeira volta** do tabuleiro.

**Faces do Speed Die (6 faces):**

- Faces **1, 2 e 3** (3 faces): somam ao movimento normal.
- Face **Mr. Magnata** (2 faces): o jogador move normalmente e depois avança até a **próxima propriedade não comprada** — podendo comprá-la imediatamente. Se todas estiverem compradas, avança até a próxima propriedade não hipotecada de adversário e paga aluguel.
- Face **Ônibus** (1 face): jogador escolhe mover o valor de um dos dois dados individualmente, ou a soma dos dois.
- **Triples** (os três dados iguais): pode mover seu token para **qualquer casa do tabuleiro** à sua escolha.

**Regras adicionais:**

- Não participa do Ritual de Largada; o modo Maior dado usa apenas os dois dados brancos.
- Não é usado ao tentar sair da prisão com dupla.
- Para Utilidades, o valor do Speed Die é somado aos outros dados.
- Speed Die **não conta** para duplas — 3-3 nos brancos + 3 no Speed Die não é tripla dupla.

> 📌 O Mr. Magnata resolve o first-mover advantage — cria oportunidades de compra independentes de onde o dado "natural" leva.

### 13.3 Construção com Grupo Parcial

Jogadores podem construir possuindo **qualquer** quantidade de cidades do país (≥1) — **não** é exigida a maioria (revisado 034). O aluguel construído escala pela posse:

- **Teto de construção por posse:** enquanto o país estiver incompleto, cada cidade pode alcançar no máximo o nível correspondente à quantidade de cidades daquele país que o jogador possui. Em país de 3 cidades: 1/3 libera até 1 casa; 2/3 libera até 2 casas por cidade; 3/3 libera toda a escada. Em país de 2 cidades: 1/2 libera até 1 casa; 2/2 libera toda a escada.
- **Fator de posse** sobre a tabela de construção: `0,5 + 0,5 × (cidades que possui − 1) / (tamanho do país − 1)`.
- País de 3 cidades: 1/3 = **50%**, 2/3 = **75%**, 3/3 = **100%**. Duo (2 cidades): 1/2 = **50%**, 2/2 = **100%**.
- País completo = 100% da tabela; o fator nunca fica abaixo de 50%.
- A regra de uniformidade ainda se aplica dentro das cidades possuídas.
- **Arranha-céu** continua exigindo o país completo (§13.7); o fator não se aplica a ele (sempre 100%).
- Aluguéis **sem** construção mantêm o set bonus (§5.1: base → 150% maioria → 200% país completo).

> 📌 Construir cedo (com 1 cidade) já vale a pena, mas possuir menos cidades nunca libera uma escada maior que possuir mais. **Completar o país libera casas, hotéis e arranha-céu e leva o aluguel a 100%** — o incentivo de fechar o grupo via trade se mantém forte, sem cooperação obrigatória.

### 13.4 Free Parking com Prêmio Acumulado

A casa Free Parking (índice 24) entrega a **Loteria**, prêmio em dinheiro acumulado desde a largada e ao longo da partida:

- Todo valor pago em **impostos** (Income Tax, Luxury Tax) vai para o centro.
- Todo valor pago em **multas** de cartas Acaso/Tesouro vai para o centro.
- A multa da **Prisão** ($50) vai para o centro.
- Todo valor pago no **Leilão secreto da largada** vai para o centro antes do primeiro turno (D-046); o modo Maior dado não acrescenta dinheiro.
- **Prêmio inicial** colocado no centro ao início: **$500**.
- O jogador que parar no Free Parking recebe **todo** o dinheiro acumulado.
- Após coletado, o centro é **reabastecido** com $500 do banco.

> 📌 Catch-up discreto e natural. Quem está perdendo torce para cair no Free Parking.

### 13.5 Bônus de GO

Valor **fixo**, definido no tema (`THEME.GO_PASS`):

| Situação | Valor recebido |
|---|---|
| Passar pelo GO | **$200** |
| Parar **exatamente** no GO | **$400** (em dobro) |

- Cartas que enviam o jogador **diretamente ao GO** ("Volta para o GO") creditam os $400 de parada exata.
- Cartas/efeitos que movem **para trás** cruzando o GO **não** pagam bônus (Seção 3.3).
- O Bus Ticket é pulo direto no mesmo lado — nunca cruza o GO (Seção 10.7).

> 📌 **Histórico (D-007, revisão 2026-05-24):** o GO Progressivo original ($100–$400 inversamente ao ranking de patrimônio) foi substituído pela regra fixa após playtest — o valor variável confundia e parecia "pouco". O catch-up fica por conta do Free Parking (Seção 13.4) e de tuning futuro — o Fiscal, que também era alavanca, saiu na v1.27 ([D-065](adr/D-065-fiscal-sai-do-jogo.md)).

### 13.6 Hangar (Melhoria de Aeroporto)

Cada aeroporto pode receber **um Hangar**, melhoria individual que **dobra o aluguel** daquele aeroporto específico:

- Custo: **$100** (configurável no tema).
- Não exige possuir múltiplos aeroportos.
- Não pode ser hipotecado junto com o aeroporto — o Hangar deve ser vendido antes da hipoteca.
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

### 13.8 Tax Man (Fiscal) — REMOVIDO (v1.27)

Token especial controlado pelo banco. A cada turno:

- Um jogador rola os dados pelo Fiscal (ordem de rotação a definir — sugestão: jogador imediatamente após o ativo).
- O Fiscal move o número de casas indicado.
- Se cair em **propriedade com dono**: o dono paga ao banco o valor que normalmente cobraria de aluguel daquela propriedade.
- Se cair em outras casas: nenhum efeito.
- Se o Fiscal cair em propriedade do próprio jogador que rolou por ele: **o jogador paga ao banco mesmo assim**.

> ⛔ **O Fiscal saiu do jogo em v1.27** ([D-065](adr/D-065-fiscal-sai-do-jogo.md)). A regra acima **não vale mais** e fica registrada só como histórico. A seção não é renumerada: os ids de §13 são citados em código e em outras decisões.
>
> Ele foi a causa raiz de **quatro** relatos de bug financeiro do playtest. A v1.25 tentou consertar narrando o débito ([D-063](adr/D-063-toda-mutacao-de-caixa-tem-causa-registrada.md)); narrar resolveu "não sei de onde saiu" e não resolveu "não entendo o que está acontecendo". Quatro propriedades somadas tornavam a mecânica opaca: o **token nunca foi desenhado** no tabuleiro (esta seção o define como token e nenhuma tela o mostrava), ele age **na passagem de turno**, cobra de quem **não agiu**, e o dinheiro é **destruído** — não há nem para onde rastrear.
>
> **Custo aceito:** o principal sumidouro de dinheiro depois dos impostos de casa e a única alavanca de catch-up sobre **patrimônio** saem juntos, e **nada entra no lugar** — a partida tende a alongar. Se o desequilíbrio aparecer, a ordem de teste é imposto de casa (§4.5), custo do GO (§13.5) e Loteria (§13.4), todas mecânicas que o jogador já vê funcionando.

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
- Os juros são cobrados a cada vez que o devedor **passa pelo GO** — debitado automaticamente do devedor e creditado ao credor **na hora**.
- **O empréstimo vence em 3 voltas do devedor** (v1.21, [D-054](adr/D-054-emprestimo-vence-em-tres-voltas.md)) — contadas pelas passagens **dele** pelo GO, a partir da concessão. Ver Seção 15.6.
- O devedor pode **quitar a qualquer momento** pagando apenas o **principal**, e com isso se livra das voltas de juros que ainda faltavam.
- O credor **não pode cancelar** ou exigir pagamento antecipado unilateralmente — o prazo é do devedor, e é o mesmo (3 voltas) em todo empréstimo.

### 15.4 Cálculo de Juros

**Exemplo:** João pediu $500 emprestado de Pedro a 20% de juros.

- A cada passagem pelo GO: João paga **$100** de juros a Pedro (20% de $500), debitado na hora.
- Se João deixar vencer: paga $100 na 1ª volta, $100 na 2ª e, na **3ª**, paga os $100 de juros daquela volta **mais os $500 do principal** — **$800 desembolsados no total** (Seção 15.6).
- Se João quitar durante a 1ª volta, antes de passar pelo GO: paga só os **$500** do principal, sem juros nenhum.
- Se João quitar depois de 2 voltas: já desembolsou $200 em juros e paga os **$500** do principal — **$700 no total**.
- Juros são sempre **simples** (sobre o principal original), não compostos.

### 15.5 Falência do Devedor com Empréstimo Ativo

- O credor herda todas as propriedades do devedor (sem construções — retornam ao banco pelo valor de venda).
- O credor assume todas as dívidas do devedor com o banco (hipotecas, impostos pendentes).
- O credor recebe o dinheiro restante em caixa.
- O empréstimo é considerado **liquidado** — credor assumiu ativos e passivos como compensação.

> 📌 O credor herda **tudo**, ativos E passivos. Se as dívidas herdadas forem maiores que os ativos, o credor assume o prejuízo.

### 15.6 Vencimento e Cobrança Automática

> Seção nova em v1.21, apoiada na [D-054](adr/D-054-emprestimo-vence-em-tres-voltas.md), que revoga parcialmente a [D-009](adr/D-009-emprestimos-entre-jogadores.md).

Todo empréstimo nasce com **prazo de 3 voltas do devedor**, contadas pelas passagens dele pelo GO desde a concessão:

| Passagem pelo GO | O que é cobrado |
|---|---|
| 1ª | Juros da volta |
| 2ª | Juros da volta |
| **3ª** | Juros da volta **+ o principal**, automaticamente — o empréstimo é encerrado |

- A cobrança do vencimento é **automática**: não pede confirmação ao devedor nem ao credor, e acontece logo após o bônus do GO.
- Se o caixa do devedor **não cobrir** a cobrança, o que faltar vira **dívida pendente ao credor** (§9.1). O devedor precisa vender construções, hipotecar, negociar ou **declarar falência** — nada é perdoado nem parcelado.
- O prazo é medido no GO **do devedor**. Turnos parados, prisão ou voltas curtas não aceleram nem atrasam o vencimento em relação aos outros jogadores.
- Empréstimo concedido e quitado **antes da 1ª passagem pelo GO** não paga juros nenhum.
- **Um empréstimo por vez continua valendo** (§15.3): só depois de encerrado — por quitação ou por vencimento — o devedor pode tomar outro.
- Falência do devedor com empréstimo ativo segue §9.3/§15.5 sem alteração. O vencimento não cria destino de ativos novo.
- O prazo restante é **informação pública**: quantas voltas faltam aparece onde o empréstimo é exibido, para devedor e credor.

---

## 16. Fora do Escopo desta Versão (v1.0)

| Feature | Observação |
|---|---|
| Inteligência Artificial (bots) | Decidido: fora do escopo. Apenas jogadores humanos |
| Timer de turno | Decidido: sem timer. Jogador finaliza quando quiser |
| Modo local (hotseat) | Apenas multiplayer online via sala |
| Múltiplos temas simultâneos | Revisado em v1.31 ([D-069](adr/D-069-segundo-mapa-jogavel-cidade-da-fuligem.md), [D-070](adr/D-070-fuligem-tem-topologia-e-regras-proprias.md)): **dois mapas jogáveis** — Cidades do Mundo (`atlas`) e Cidade da Fuligem (`fuligem`) —, escolhidos **por sala** na criação e imutáveis depois. Cada mapa pode ter topologia e regras declaradas próprias; mais de um mapa na **mesma partida** segue fora de escopo |
| Transferência de host | Host desconectado pausa a partida indefinidamente |
| Chat em tempo real | Não previsto no v1 |
| Espectadores | Não previsto no v1 |
| Histórico global de partidas | Não previsto no v1; a única exceção é o histórico limitado à sala privada atual (§11.7, D-067) |
| Sistema de contas/perfis | A definir se auth anônima ou por email será necessária |
| Versão mobile nativa | Web responsivo apenas |
| Mercado de ações / investimento em propriedades alheias | Candidata a v2 |
| Modo jogo rápido | Candidato a v2 como modo alternativo de sala |
| Co-propriedade de imóveis | Rejeitada na fase de discovery |

---

## 17. Glossário

O glossário do domínio mudou de lugar: vive em [`CONTEXT.md`](../CONTEXT.md) na raiz do repo,
ao lado do código que os termos nomeiam. Esta seção existe só como ponteiro — o SRS segue
sendo a fonte de verdade da **regra**, o `CONTEXT.md` é a fonte dos **nomes**.

---

**Magnata Imobiliário — SRS v1.32 | Julho 2026 | Documento de fonte de verdade absoluta**
