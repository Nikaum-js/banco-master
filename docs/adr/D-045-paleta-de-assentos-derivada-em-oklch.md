# D-045 — Paleta de assentos derivada em OKLCH

**Data:** 2026-07-27 · **Status:** aceita
**Refina:** [D-044](D-044-remocao-da-peca-do-jogador.md) — com a peça fora, a cor virou o único distintivo entre jogadores.

**Decisão:** as oito cores de assento (`SEAT_COLORS` em `net/room.ts`, espelhadas em `PLAYER_COLORS`) deixam de ser escolhidas a olho e passam a ser **derivadas em OKLCH** sob três critérios verificáveis:

1. **Croma coeso** (~0,12–0,14 em todas) e **claridade escalonada** (L de 0,62 a 0,82) — é o que faz as oito lerem como um conjunto em vez de oito acasos.
2. **Separação medida no pior caso** entre visão típica, **deuteranopia** e **protanopia**, via simulação LMS. Não basta serem diferentes para quem enxerga as três faixas.
3. **Ordem por ponto-mais-distante**, não por roda de cores: o assento `n+1` é sempre o mais distante do pior par já em mesa. Mesas pequenas, que são a maioria, ficam com a maior separação que a paleta permite.

| # | nome | hex | L | C | H | contraste no fundo |
|---|---|---|---|---|---|---|
| 1 | ouro | `#d9a650` | 0,76 | 0,119 | 78° | 8,4:1 |
| 2 | azul | `#3b8bd0` | 0,62 | 0,130 | 248° | 5,1:1 |
| 3 | ciano | `#36dde7` | 0,82 | 0,130 | 201° | 11,2:1 |
| 4 | turquesa | `#00bca5` | 0,71 | 0,129 | 180° | 7,7:1 |
| 5 | coral | `#e77376` | 0,69 | 0,144 | 20° | 6,3:1 |
| 6 | verde | `#7b9d41` | 0,65 | 0,126 | 127° | 6,0:1 |
| 7 | rosa | `#b665a2` | 0,62 | 0,129 | 337° | 4,8:1 |
| 8 | violeta | `#b0a5ff` | 0,77 | 0,127 | 289° | 8,6:1 |

ΔE OKLab do pior par, por número de jogadores (pior caso entre as três visões): **2 → 0,255 · 3 → 0,196 · 4 → 0,109 · 6 → 0,073 · 8 → 0,070**.

**Por quê:** a paleta anterior (`#a76bf5 #06b6d4 #14b8a6 #d946ef #f97316 #35d97b #4d8bf5`) foi escolhida a olho e tinha dois pares que **colapsam** sob dicromacia vermelho-verde: laranja×verde com ΔE **0,013** em deuteranopia e roxo×azul com **0,015** em protanopia — indistinguíveis na prática. Como o token do tabuleiro é um disco colorido de ~24px, dois jogadores nesse par não teriam como se achar na mesa. A paleta nova leva o pior par de 0,013 para **0,070**, ~5× mais separação, sem perder contraste no fundo de tinta (mínimo 4,8:1).

**O verde é oliva de propósito.** Foi o achado mais caro da derivação: todo verde-grama bonito (`#52b766`, `#4ac06c`, `#68c36d`) desaba para ΔE 0,003–0,05 sob deuteranopia, porque colide ao mesmo tempo com o turquesa e com o ouro — que são inegociáveis (o ouro é a cor da marca). Um verde mais escuro e menos saturado é o preço de ter oito assentos distinguíveis; trocá-lo por um verde mais alegre é reintroduzir, sabendo, o defeito que esta decisão corrige.

**Alternativas descartadas:**

- **Roda de matizes igualmente espaçada com L e C constantes** — é a resposta harmônica de manual e falha no critério 2: espaçamento igual em matiz não é espaçamento igual em percepção, e sob dicromacia a roda inteira colapsa em um eixo. Foi o primeiro desenho tentado; produziu justamente os pares indistinguíveis.
- **Otimizar só por separação** — maximiza o critério 2 e destrói o 1: a busca livre entrega cores embarradas (croma < 0,11) e claridades extremas, porque o gamut do sRGB é mais estreito nas pontas. As restrições estéticas entram como piso, não como enfeite.
- **Ordenar por roda de cores** (degradê no seletor) — mais bonito na fileira do lobby, pior na mesa: coloca os vizinhos de matiz nos primeiros assentos, que são os que mais aparecem juntos.

**Como aplicar:** os dois arrays são espelhos e mudam juntos — `SEAT_COLORS` (`net/room.ts`, fonte para a escolha no lobby) e `PLAYER_COLORS` (`game/ui/panels/playersView.ts`, paleta do token). A paleta é **disjunta das cores de grupo** do tabuleiro (`boards/groupColors.ts`), que seguem em variáveis de tema. Qualquer cor nova ou trocada passa pelos três critérios antes de entrar — em especial o 2, que é o que não se enxerga revisando a olho.
