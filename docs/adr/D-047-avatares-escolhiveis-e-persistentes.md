# D-047 — Avatares escolhíveis e persistentes

**Data:** 2026-07-28 · **Status:** aceita
**Revoga parcialmente:** [D-044](D-044-remocao-da-peca-do-jogador.md), apenas na afirmação de que a identidade visual é nome + cor e só.
**Refina:** [D-045](D-045-paleta-de-assentos-derivada-em-oklch.md).

**Decisão:** o jogador escolhe independentemente um **avatar** e uma **skin** no mesmo formulário em que escolhe nome e cor. O catálogo de avatares é fechado em cinco formas: **Clássico Vivo, Olhos Orbitais, Linha Única, Prisma e Totem**. O catálogo de skins recupera os oito visuais já existentes: **Careca, Cavanhaque, Topete, Cartola, Safári, Aviador, Robô e Astronauta**. As quarenta combinações são válidas: nenhuma skin pertence a uma única forma, substitui a forma ou fica indisponível para alguma delas.

O avatar ocupa o próprio `PlayerFace` e a skin é desenhada como camada compatível sobre ele. A composição aparece no preview do lobby, no token que percorre o tabuleiro e nas superfícies de identidade da partida; não existe peça visual separada. As duas escolhas pertencem ao assento, são públicas, persistem em sala e snapshot e sobrevivem à reconexão. Avatares e skins **não são exclusivos**. A cor continua obrigatória e única por sala; ela preserva a distinção medida sob visão típica, deuteranopia e protanopia. Sala persistida sem os campos recebe **Clássico Vivo + Careca** como fallback.

**Por quê:** a D-044 removeu uma escolha que não chegava ao jogo e registrou explicitamente a skin persistente como direção provável, ainda em avaliação. O catálogo foi agora avaliado no próprio lobby. As cinco formas aprovadas não substituem as skins anteriores: são eixos diferentes da mesma composição. Diferentemente da peça removida, forma e visual transformam o token existente em vez de adicionar um segundo emblema; tudo que é escolhido antes de entrar é reencontrado durante toda a partida.

As animações são presença discreta, não atividade constante. Cada avatar pode piscar, olhar ou mudar de expressão, mas os ciclos de idle precisam incluir repouso perceptível e respeitar `prefers-reduced-motion`. O movimento não pode prejudicar a leitura do token entre 16px e 72px.

**Alternativas descartadas:**

- **Manter o carrossel apenas como laboratório visual:** a escolha continuaria sem efeito depois de entrar, repetindo a inconsistência que motivou a D-044.
- **Avatar exclusivo por sala:** criaria corrida e recusa de entrada sem necessidade; a cor já garante distinção obrigatória.
- **Manter Forma Líquida:** rejeitada na avaliação visual final do catálogo.
- **Transformar cada skin em um avatar fechado:** apagaria acessórios aprovados e impediria combinações que o catálogo anterior já comunicava.
- **Limitar skins por formato:** criaria compatibilidade implícita e opções que somem sem regra de produto.
- **Reintroduzir as peças antigas:** continuariam sendo um segundo símbolo sem presença no token.

**Como aplicar:** adicionar identificadores fechados de avatar e skin ao assento e aos pedidos de entrada, com fallback aditivo para salas legadas. O RPC existente ainda aceita o parâmetro opcional `piece`; enquanto a limpeza dessa assinatura não justificar migration própria, o cliente o usa como envelope versionado da combinação e o traduz imediatamente para `avatar + skin` na fronteira de transporte. Payload antigo contendo apenas um avatar continua válido. Toda superfície que renderiza identidade deve obter cor, avatar e skin da mesma projeção de assento.
