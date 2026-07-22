# BANCO MASTER — Identidade sonora (39 cues)

> Documento de design da spec 035. Substitui a lógica "um beep pra cada coisa" por uma
> **mesa de jogo premium e viva**. Toda escolha abaixo foi feita sobre arquivos reais,
> baixados e analisados (duração, centroide espectral, direção melódica) — não por chute
> pelo nome.

---

## O NORTE aplicado: domínios de material

A coesão vem de uma regra física: **cada domínio do jogo tem UM material**, como se tudo
acontecesse na mesma mesa. Ouvir o material já diz o domínio; o gesto diz a ação.

| Domínio | Material | Cues |
|---|---|---|
| Dados | osso/resina na madeira | dice-roll, dice-double, dice-speed, dice-bus |
| Movimento | peão de madeira no tabuleiro | step-tick, step-land |
| Dinheiro | moedas e fichas PESADAS + registradora | buy, rent-paid, tax-paid, sell, go-bonus, free-parking, loan-granted, auction-bid |
| Documentos | papel, tomo, envelope | mortgage, unmortgage, decline, todas as cartas |
| Construção | tábua e martelo | build |
| Prisão / agressão | metal | jail-in, jail-out, hostile-takeover (soco), loan-interest (rangido) |
| Atenção / cerimônia | sinos e martelo de leiloeiro | your-turn, immunity, auction-close |
| Momentos raros | stingers musicais (metais, piano, pizzicato) | win, bankruptcy, debt, dice-double (acento) |

**Anti-padrão eliminado:** os ~15 cues que vinham do pack *Interface Sounds* do Kenney
(`confirmation_*`, `select_*`, `pluck_*`, `glass_*`, `minimize/maximize`, `error_*`,
`bong_*`, `tick_*`) — beeps sintéticos de menu, a causa do "robotizado". Zero deles
sobrevive.

## Fontes e licenças

- **Kenney.nl** (CC0 1.0): packs *Casino Audio*, *Impact Sounds*, *RPG Audio*,
  *Music Jingles*, *UI Audio*. Download direto em `kenney.nl/assets/<pack>`.
- **Mixkit** (Mixkit Free License — royalty-free, sem atribuição): 6 cues que foley CC0
  não cobre com personalidade (registradora, apito, power-down, sino de balcão, fanfarra,
  piano de derrota). Página: `mixkit.co/free-sound-effects/`.
- **NADA extraído de Richup/Monopoly GO/Monopoly Plus** — só referência de linguagem.

Nos *Music Jingles* do Kenney, as frases 00–16 existem em 5 instrumentos; usamos apenas
**PIZZI** (pizzicato de cordas — quente, "mesa de madeira") e a análise de f0 confirmou
a direção de cada frase (ex.: PIZZI02 sobe 274→469 Hz; PIZZI04 despenca 218→74 Hz).

## Loudness

Normalizar tudo para **pico −1 dBFS** e loudness alvo **−16 LUFS** (cues frequentes
step-tick/auction-bid: −22 LUFS, ~6 dB abaixo). Fade-out de 10–30 ms em todo corte para
não estalar. `drawKnife3` e `chips-handle-2` do Kenney vêm ~20 dB baixos — normalizar.

---

## DADOS

### dice-roll — rolou os dados
1. **Som:** dois dados de resina caindo e quicando em mesa de madeira — seco, quente,
   grave (centroide ~3,8 kHz), zero música. Intenção: neutralidade tátil, o "clac-clac"
   que abre todo turno sem cansar.
2. **Referência:** Richup e Monopoly Plus usam exatamente esse knock seco de dados na
   mesa; Monopoly GO adiciona brilho só no RESULTADO, não no lançamento.
3. **Duração:** 0,63 s — o cue mais frequente do jogo depois do passo; precisa morrer rápido.
4. **Escolha:** Kenney *Casino Audio* → `dice-throw-1.ogg` (CC0).
5. **Coesão/contraste:** é o material-assinatura da mesa; contrasta com `dice-double`
   (que ganha acento musical) e com `step-tick` (toque único e mais surdo).

### dice-double — saiu dupla
1. **Som:** o mesmo arremesso de dados, mas com um pizzicato ASCENDENTE colado no
   desfecho — "opa, joga de novo!". Foley primeiro, recompensa depois. Intenção: alegria
   contida, convite.
2. **Referência:** Monopoly GO pinga um sparkle sobre o foley quando sai dupla — o foley
   mantém o mundo físico, o acento vende o bônus.
3. **Duração:** ~1,1 s — mais raro que o roll, merece 0,5 s de juice extra.
4. **Escolha (produzido):** `dice-throw-2.ogg` + cauda de `jingles_PIZZI02.ogg`
   (sobe 274→469 Hz) a −6 dB, entrando ~80 ms após o impacto. Ambos Kenney, CC0.
5. **Coesão/contraste:** mesma família física do `dice-roll`; o pizzicato ascendente o
   torna inconfundível de olhos fechados.

### dice-speed — Speed Die
1. **Som:** chocalhar rápido de dados na mão/copo, SEM arremesso — um "rattle" curto e
   nervoso. Intenção: urgência, dado "extra" com energia própria.
2. **Referência:** Monopoly Plus toca o shake no copo antes do lance; aqui o shake
   sozinho vira a identidade do dado extra.
3. **Duração:** ~0,6 s (recorte do final do arquivo de 1,52 s) — frequente, tem que ser seco.
4. **Escolha (produzido):** Kenney *Casino Audio* → `dice-shake-3.ogg`, últimos ~0,6 s
   com fade-in de 30 ms (CC0).
5. **Coesão/contraste:** madeira e osso como os irmãos, mas gesto de CHOCALHO vs. os
   ARREMESSOS de roll/bus — impossível confundir.

### dice-bus — dado de Bus Ticket
1. **Som:** UM dado só, arremesso mais gordo e grave rolando mais tempo na mesa.
   Intenção: "isto é outro dado" — mais peso, menos pressa.
2. **Referência:** Rento/Business Tour diferenciam dados especiais pelo peso do quique,
   não por sintetizador.
3. **Duração:** 0,47 s — frequente quando a mecânica entra; curto.
4. **Escolha:** Kenney *Casino Audio* → `die-throw-4.ogg` (CC0). (Já era o atual — acerto
   que fica.)
5. **Coesão/contraste:** um dado vs. dois do `dice-roll`; grave e rolado vs. o rattle do
   `dice-speed`.

## MOVIMENTO

### step-tick — peão avança uma casa
1. **Som:** tumpzinho surdo de peão de madeira batendo no tabuleiro — grave (~60 Hz de
   corpo), macio, quase feltro. Intenção: cadência hipnótica que NUNCA irrita em 8 casas
   seguidas.
2. **Referência:** Monopoly Plus é a régua: o token bate na casa com madeira abafada;
   Richup usa tick sintético — exatamente o que estamos abandonando.
3. **Duração:** 0,25 s, tocado a cada casa — o cue mais repetido do jogo; mixar ~6 dB
   abaixo dos demais.
4. **Escolha:** Kenney *Impact Sounds* → `footstep_wood_002.ogg` (CC0).
5. **Coesão/contraste:** madeira do domínio movimento; surdo e mate vs. o "tok" claro do
   `step-land` — o ouvido sente o trajeto e ouve a chegada.

### step-land — peão para na casa de destino
1. **Som:** "tok" de madeira mais claro e afinado (~300 Hz), o peão ASSENTA. Intenção:
   pontuação final da frase de movimento — chegou, agora algo vai acontecer.
2. **Referência:** Monopoly GO fecha o trajeto com um toque mais brilhante e definitivo
   que os passos; Business Tour idem.
3. **Duração:** 0,27 s — frequente, seco.
4. **Escolha:** Kenney *Impact Sounds* → `impactWood_light_000.ogg` (CC0).
5. **Coesão/contraste:** mesma madeira do `step-tick`, uma terça acima em brilho; nunca
   se confunde com o `build` (tábua + estrépito) nem com o gavel (grave, duplo).

## DINHEIRO / PROPRIEDADE

### buy — comprou propriedade
1. **Som:** registradora clássica: tecla + "cha-ching" de sino + gaveta. Intenção: A
   recompensa da compra — o som mais gostoso do jogo, dinheiro com peso e cerimônia.
2. **Referência:** é O som canônico de compra em todo o gênero (Monopoly GO, Rento);
   ninguém precisa aprender o que significa.
3. **Duração:** ~1 s — pouco frequente e importante; pode respirar.
4. **Escolha:** manter o atual `buy.wav` (Mixkit cash register, Mixkit Free License) —
   escolha da rodada anterior que já obedecia ao NORTE.
5. **Coesão/contraste:** o único "cha-ching" completo do conjunto; `rent-paid` e afins
   usam moedas/fichas sem sino — hierarquia clara de cerimônia.

### decline — recusou compra/oferta
1. **Som:** capa de livro/pasta fechando: "tump" seco de papel e capa dura. Intenção:
   "passo." — recusa educada, zero drama, zero buzzer de erro.
2. **Referência:** Monopoly Plus resolve recusas com foley de papel/pasta; buzzers de
   erro (Richup) soam punitivos e robóticos.
3. **Duração:** 0,23 s — frequente em leilões/ofertas; instantâneo.
4. **Escolha:** Kenney *RPG Audio* → `bookClose.ogg` (CC0).
5. **Coesão/contraste:** domínio papel/documentos; fechamento surdo vs. as texturas
   deslizantes das cartas e o thud+clique do `mortgage`.

### build — construiu estrutura
1. **Som:** tábua de madeira assentando com um estrépito de encaixe — carpintaria de
   verdade, com peso. Intenção: satisfação de progresso físico, "subiu uma parede".
2. **Referência:** Monopoly GO faz da construção um mini-espetáculo de marteladas; a
   versão mesa-premium é uma tábua só, bem gorda.
3. **Duração:** 0,78 s — ação deliberada e estratégica, pode ocupar espaço.
4. **Escolha:** Kenney *Impact Sounds* → `impactPlank_medium_001.ogg` (CC0).
5. **Coesão/contraste:** a madeira mais RUIDOSA do conjunto (clatter), vs. os toques
   limpos de passo/gavel; nada a ver com o `sell` (fichas).

### sell — vendeu construção
1. **Som:** pilha curta de fichas contadas de volta pra mão — metálico-cerâmico,
   descendente. Intenção: transação fria; recebeu, mas desfez algo.
2. **Referência:** Monopoly GO devolve "coin burst" em vendas; a versão de mesa são
   fichas riscando a pilha.
3. **Duração:** 0,37 s — utilitário, curto.
4. **Escolha:** Kenney *Casino Audio* → `chips-stack-3.ogg` (CC0).
5. **Coesão/contraste:** dinheiro-fichas; gesto de EMPILHAR vs. o punhado gordo do
   `rent-paid` e a ficha única do `auction-bid`; contraparte fria do `build`.

### mortgage — hipotecou
1. **Som:** tomo pesado batendo no balcão + um clique metálico discreto no final — a
   escritura entregue e TRANCADA no cofre do banco. Intenção: gravidade, porta que se
   fecha sobre o seu patrimônio.
2. **Referência:** Monopoly Plus usa papelada grave para hipoteca; o clique final é o
   detalhe que sela o significado.
3. **Duração:** ~0,6 s — decisão séria, merece o peso.
4. **Escolha (produzido):** Kenney *RPG Audio* → `bookPlace3.ogg` + `metalClick.ogg`
   (normalizado, −8 dB) colado na cauda (CC0).
5. **Coesão/contraste:** papel+metal = documento sob custódia; o espelho exato do
   `unmortgage`, que puxa o papel DE VOLTA.

### unmortgage — quitou hipoteca
1. **Som:** escritura deslizando pra fora do envelope — papel encorpado, gesto de
   RECUPERAR. Intenção: alívio e posse de volta, sem fanfarra.
2. **Referência:** Monopoly Plus também resolve com papel; o sentido vem do gesto
   inverso ao da hipoteca.
3. **Duração:** 0,63 s.
4. **Escolha:** Kenney *Casino Audio* → `cards-pack-take-out-2.ogg` (CC0).
5. **Coesão/contraste:** papel do domínio documentos; extração suave vs. o thud+clique
   do `mortgage` — par pergunta-resposta.

### rent-paid — aluguel pago
1. **Som:** punhado GORDO de moedas mudando de mãos — não duas moedinhas: um maço, com
   graves. Intenção: dor/ganho palpável; a economia deste jogo tem PESO (trava do SRS).
2. **Referência:** Monopoly GO faz o dinheiro cascatear; Richup usa um "plim" anêmico —
   anti-referência.
3. **Duração:** 0,85 s — evento central do jogo, frequente mas nunca "troquinho".
4. **Escolha:** Kenney *RPG Audio* → `handleCoins.ogg` (CC0).
5. **Coesão/contraste:** o som de dinheiro mais encorpado do conjunto depois do `buy`;
   moedas (não fichas) o separam de sell/lance/go.

### tax-paid — pagou imposto
1. **Som:** CARIMBO burocrático (thud de almofada) e as moedas saindo logo atrás —
   a Auditoria Fiscal carimbou e levou. Intenção: ironia seca, resignação.
2. **Referência:** nenhum concorrente caracteriza imposto (usam o som genérico de
   pagar) — aqui é identidade própria por cima da linguagem de moedas do gênero.
3. **Duração:** ~0,7 s.
4. **Escolha (produzido):** Kenney *RPG Audio* → `bookPlace1.ogg` (carimbo) +
   `handleCoins2.ogg` (normalizado) com ~60 ms de sobreposição (CC0).
5. **Coesão/contraste:** moedas como `rent-paid`, mas precedidas do carimbo — a
   assinatura fiscal; nada musical, ao contrário de `debt`.

### go-bonus — passou no GO  [NEUTRO/DISCRETO]
1. **Som:** UMA ficha mate pousando na mesa — opaca (centroide ~2 kHz), volume baixo.
   Intenção: registro contábil, não celebração (trava de catch-up do constitution).
2. **Referência:** contra-referência: Monopoly GO celebra o GO com jackpot — aqui é
   deliberadamente o oposto.
3. **Duração:** 0,24 s, mixado discreto.
4. **Escolha:** Kenney *Casino Audio* → `chip-lay-3.ogg` (CC0).
5. **Coesão/contraste:** dinheiro-ficha em dose mínima; mate vs. o clique brilhante do
   `auction-bid` e o toquinho duplo do `free-parking`.

### busticket-gain — ganhou Bus Ticket
1. **Som:** alicate de picotar bilhete: "click-clack" mecânico, gostoso, de metal
   pequeno — o trocador picotou seu ticket. Intenção: colecionável charmoso, tátil.
2. **Referência:** Board Kings dá personalidade mecânica a colecionáveis; o gesto do
   picotador é leitura instantânea de "bilhete".
3. **Duração:** 0,36 s.
4. **Escolha:** Kenney *UI Audio* → `switch16.ogg` — gravação de interruptor físico
   real, aqui ressignificada como picotador (CC0).
5. **Coesão/contraste:** o único "click-clack" mecânico do conjunto; irmão temático do
   `dice-bus`, mas timbre 100% diferente.

### debt — entrou em dívida
1. **Som:** pizzicato de contrabaixo despencando pro registro grave (218→74 Hz) — a
   corda afrouxou, o chão cedeu. Intenção: tensão elegante, estômago frio, sem buzzer.
2. **Referência:** jogos de tabuleiro digitais premium usam acentos de cordas graves
   para reveses; o "error beep" do Richup é a anti-referência.
3. **Duração:** 0,56 s — raro o bastante para ser musical.
4. **Escolha:** Kenney *Music Jingles* → `jingles_PIZZI04.ogg` (CC0).
5. **Coesão/contraste:** primeiro degrau da escada sombria que termina em `bankruptcy`
   (piano); um gesto só, vs. a frase completa da falência.

### loan-granted — empréstimo concedido
1. **Som:** a banca EMPURRA uma pilha de fichas pra você — arrastado ascendente,
   generoso mas impessoal. Intenção: dinheiro entrou, mas veio da mesa, não é seu.
2. **Referência:** gesto clássico de cassino (dealer push) que Monopoly Plus usa em
   pagamentos da banca.
3. **Duração:** 0,55 s.
4. **Escolha:** Kenney *Casino Audio* → `chips-handle-2.ogg`, normalizado (CC0).
5. **Coesão/contraste:** fichas deslizando PARA você vs. `sell` (empilha) e `rent-paid`
   (moedas); a versão sombria dele é o `loan-interest`.

### loan-interest — juros incidiram
1. **Som:** rangido curto de madeira sob pressão — a corda do empréstimo apertando.
   Intenção: desconforto que cresce, lembrete incômodo, não punição.
2. **Referência:** nenhum concorrente tem juros; linguagem emprestada do survival-horror
   de mesa: madeira rangendo = estrutura cedendo.
3. **Duração:** 0,34 s — recorrente por turno, tem que ser breve.
4. **Escolha:** Kenney *RPG Audio* → `creak3.ogg` (CC0).
5. **Coesão/contraste:** a única MADEIRA ORGÂNICA (rangido) do conjunto — todos os outros
   sons de madeira são percussivos; parente emocional de `debt`, timbre oposto.

## LEILÃO

### auction-bid — novo lance
1. **Som:** UMA ficha batida na mesa com decisão — clique brilhante, assertivo.
   Intenção: "eu cubro!" — pôquer, adrenalina em miniatura.
2. **Referência:** Business Tour e pôquer digital usam chip único por lance; Richup usa
   blip de UI — anti-referência.
3. **Duração:** 0,23 s — dispara em rajada em leilões quentes; precisa empilhar bem.
4. **Escolha:** Kenney *Casino Audio* → `chip-lay-2.ogg` (CC0).
5. **Coesão/contraste:** ficha-dinheiro (lance É dinheiro); brilhante vs. o `go-bonus`
   mate; a série de cliques termina no gavel grave do `auction-close`.

### auction-close — leilão encerrado (martelada)
1. **Som:** martelo de leiloeiro: DUAS batidas secas de madeira grave — "tok-TOK,
   vendido!". Intenção: veredito, cerimônia, fim de disputa.
2. **Referência:** Monopoly Plus encerra leilões com gavel real; é o símbolo universal.
3. **Duração:** ~0,75 s (batidas a ~140 ms).
4. **Escolha (produzido):** Kenney *Impact Sounds* → `impactWood_heavy_002.ogg`
   duplicado com 140 ms de intervalo, segunda batida +2 dB (CC0).
5. **Coesão/contraste:** a madeira mais GRAVE e cerimonial do conjunto; batida dupla o
   isola de step-land (única, clara) e build (clatter).

## CARTAS

### card-draw — sacou carta  [GENÉRICO — trava de privacidade]
1. **Som:** carta deslizando do topo do baralho — papel liso, neutro, IDÊNTICO para
   qualquer raridade (FR-016). Intenção: ritual de mesa, poker face sonora.
2. **Referência:** Hearthstone/Monopoly GO fazem o draw ser papel puro e guardam o brilho
   pra REVELAÇÃO — exatamente o que a trava pede.
3. **Duração:** 0,60 s.
4. **Escolha:** Kenney *Casino Audio* → `card-slide-1.ogg` (CC0). (Mantido da rodada
   anterior — já era correto.)
5. **Coesão/contraste:** o gesto mais suave da família papel; sem ataque (vs. `card-play`)
   e sem far-fetch (vs. `card-reveal`).

### card-reveal — carta revelada
1. **Som:** leque rápido de cartas abrindo — "frrrp" de papel com floreio. Intenção:
   "tcharam" físico; a informação virou pública.
2. **Referência:** Monopoly Plus vira a carta de Sorte com flutter de papel audível.
3. **Duração:** 0,72 s.
4. **Escolha:** Kenney *Casino Audio* → `card-fan-1.ogg` (CC0). (Mantido.)
5. **Coesão/contraste:** o único FLUTTER do conjunto; teatral vs. o slide anônimo do
   `card-draw`.

### card-play — jogou carta da mão
1. **Som:** carta ESTALADA na mesa — snap de papel com autoridade. Intenção: compromisso;
   jogada declarada.
2. **Referência:** o "card slam" de Hearthstone/Balatro, em versão foley de mesa.
3. **Duração:** 0,69 s.
4. **Escolha:** Kenney *Casino Audio* → `card-place-1.ogg` (CC0). (Mantido.)
5. **Coesão/contraste:** ataque forte vs. draw (suave) e discard (arrastado pra longe).

### card-discard — descartou carta
1. **Som:** carta empurrada deslizando PARA LONGE — atrito longo, desinteressado.
   Intenção: abandono, "não me serve".
2. **Referência:** gesto padrão de descarte em qualquer card game de mesa filmado de
   cima (Balatro, Slay the Spire em foley).
3. **Duração:** 0,77 s.
4. **Escolha:** Kenney *Casino Audio* → `card-shove-1.ogg` (CC0). (Mantido.)
5. **Coesão/contraste:** direção sonora OPOSTA ao card-play: energia se afastando em vez
   de chegar.

### card-shortcut — carta de atalho/teleporte
1. **Som:** whoosh de tecido — o peão levantou voo num sopro. Intenção: magia leve e
   veloz, sem synth de sci-fi.
2. **Referência:** Monopoly GO teleporta com whoosh+sparkle; ficamos só com o whoosh
   físico, o sparkle iria denunciar raridade em contexto de mão privada.
3. **Duração:** 0,66 s — casa com a animação de voo do peão.
4. **Escolha:** Kenney *RPG Audio* → `cloth1.ogg` (CC0).
5. **Coesão/contraste:** o único som de AR do conjunto; nada percussivo, nada tonal —
   inconfundível com toda a família papel.

## EVENTOS / CARTAS ESPECIAIS

### apagao — evento Apagão
1. **Som:** power-down elétrico: zumbido caindo de pitch até o silêncio + baque surdo —
   a cidade desligou. Intenção: escuridão audível, humor sombrio.
2. **Referência:** convenção universal de blackout (de Overcooked a Monopoly GO nos
   eventos): pitch-down elétrico.
3. **Duração:** ~1,5 s — evento raro de tabuleiro inteiro, pode ocupar a cena.
4. **Escolha:** manter `apagao.wav` (Mixkit power-down, Mixkit Free License).
5. **Coesão/contraste:** único som ELÉTRICO do conjunto — e é sobre eletricidade; o
   contraste é o próprio conceito.

### greve — evento Greve
1. **Som:** apito estridente de manifestação/guarda + rumor — a rua parou. Intenção:
   interrupção coletiva, urgência cívica.
2. **Referência:** sem equivalente nos concorrentes; linguagem de rua real ("Cidades do
   Mundo" pede sons urbanos).
3. **Duração:** ~1,2 s — evento raro.
4. **Escolha:** manter `greve.wav` (Mixkit whistle, Mixkit Free License).
5. **Coesão/contraste:** único APITO do conjunto; urbano e humano vs. a mesa de madeira —
   é o mundo lá fora invadindo o salão.

### hostile-takeover — tomada hostil
1. **Som:** impacto de corpo GRAVE e seco (soco/baque abafado, centroide ~280 Hz) — o
   golpe no tabuleiro corporativo. Intenção: violência elegante; alguém sentiu.
2. **Referência:** stingers de impacto de trailers/Board Kings para roubo de propriedade.
3. **Duração:** 0,46 s.
4. **Escolha:** Kenney *Impact Sounds* → `impactPunch_heavy_002.ogg` (CC0).
5. **Coesão/contraste:** o impacto mais físico-agressivo do conjunto; grave-abafado vs.
   o slam metálico do `jail-in` e o gavel cerimonial.

### reaction — carta de reação
1. **Som:** "schwing" de lâmina sacada, ascendente — o parry: alguém interceptou a
   jogada. Intenção: bote de esgrima, reflexo, reviravolta.
2. **Referência:** linguagem de counter dos card games (Yu-Gi-Oh!/Marvel Snap usam
   whoosh-metálico de resposta).
3. **Duração:** 0,48 s — precisa caber DENTRO da jogada que interrompe.
4. **Escolha:** Kenney *RPG Audio* → `drawKnife3.ogg`, normalizado (+20 dB) (CC0).
5. **Coesão/contraste:** único som ASCENDENTE-metálico-arrastado; direção oposta ao
   punch do `hostile-takeover` que ele tipicamente responde.

### immunity — imunidade de aluguel
1. **Som:** UMA badalada de sino grave e redonda ressoando (~0,65 s) — o gongo que
   consagra: "este aqui não paga". Intenção: proteção solene, quase templo.
2. **Referência:** buffs de escudo em jogos premium usam sinos/metal ressonante em vez
   de synth shimmer.
3. **Duração:** 0,65 s com cauda natural.
4. **Escolha:** Kenney *Impact Sounds* → `impactBell_heavy_003.ogg` (CC0).
5. **Coesão/contraste:** sino GRAVE cerimonial vs. o ding agudo de balcão do `your-turn`
   — mesma família "atenção", papéis opostos.

## PRISÃO / TABULEIRO

### free-parking — caiu no pote  [NEUTRO/DISCRETO]
1. **Som:** duas fichas se tocando de leve — "tique" discreto, contábil. Intenção:
   registrar sem celebrar (trava de catch-up).
2. **Referência:** contra-referência: Monopoly GO explode confete no pote; aqui é um
   toque de caixa e só.
3. **Duração:** 0,22 s, mixado baixo.
4. **Escolha:** Kenney *Casino Audio* → `chips-collide-4.ogg` (CC0).
5. **Coesão/contraste:** dose mínima de fichas como `go-bonus`, porém toquinho DUPLO e
   brilhante vs. a ficha única mate — distinguíveis, ambos invisíveis.

### jail-in — foi preso
1. **Som:** porta pesada batendo + trinco metálico travando — a cela fechou atrás de
   você. Intenção: punição com teatro, clang icônico.
2. **Referência:** Monopoly Plus e TODO o gênero usam cell-door-slam; é o som mais
   esperado do jogo depois da registradora.
3. **Duração:** ~0,8 s.
4. **Escolha (produzido):** Kenney *RPG Audio* → `doorClose_3.ogg` + `metalLatch.ogg`
   na cauda (~80 ms depois) (CC0).
5. **Coesão/contraste:** o metal mais pesado do conjunto; o par exato do `jail-out`
   (mesma porta, direção inversa).

### jail-out — saiu da prisão
1. **Som:** a mesma porta ABRINDO com rangido de dobradiça e ar — liberdade. Intenção:
   alívio físico; respirou.
2. **Referência:** Monopoly Plus abre a cela com creak real.
3. **Duração:** 0,92 s.
4. **Escolha:** Kenney *RPG Audio* → `doorOpen_1.ogg` (CC0).
5. **Coesão/contraste:** espelho do `jail-in` (slam+trinco vs. rangido que abre);
   nenhuma outra dupla do jogo conta uma história em dois atos assim.

## ESTADO / FIM

### your-turn — sua vez
1. **Som:** sino de balcão de hotel: "DING!" claro com cauda curta — o concierge chamou
   por você. Intenção: convite leve e charmoso, tema "Cidades do Mundo" (recepção de
   hotel), impossível de ignorar sem irritar.
2. **Referência:** Richup usa uma notificação simples de sino; a versão física de balcão
   mantém a função e ganha alma.
3. **Duração:** ~0,8 s (recorte do primeiro toque).
4. **Escolha (produzido):** Mixkit → **"Service bell"** (id 931,
   `mixkit.co/free-sound-effects/bell/`), primeiro ding recortado com fade (Mixkit Free
   License).
5. **Coesão/contraste:** o único ding AGUDO do conjunto; sino de balcão vs. o gongo
   grave da `immunity` e o sino embutido na registradora do `buy`.

### win — venceu o jogo
1. **Som:** fanfarra de metais REAL, frase curta ascendente e resolvida — pódio, taça,
   cidade aos seus pés. Intenção: triunfo pleno; o único momento de exagero permitido.
2. **Referência:** Monopoly GO e Monopoly Plus fecham com fanfarra orquestral + festa;
   é o clímax que o jogador espera.
3. **Duração:** ~3,5 s (recorte da frase inicial do arquivo de 8,3 s, com fade) — o cue
   mais longo do jogo, tocado uma única vez por partida.
4. **Escolha (produzido):** Mixkit → **"Medieval show fanfare announcement"** (id 226,
   `mixkit.co/free-sound-effects/win/`), primeiros ~3,5 s (Mixkit Free License).
5. **Coesão/contraste:** único METAL DE SOPRO do conjunto; nenhum cue cotidiano chega
   perto desse timbre — hierarquia máxima preservada.

### bankruptcy — faliu, eliminado
1. **Som:** frase curta de piano em queda, sombria e elegante — as luzes do escritório
   se apagando uma a uma. Intenção: desânimo digno; derrota sem deboche (nada de "sad
   trombone" de circo).
2. **Referência:** Monopoly GO usa descida musical na falência; o piano dá o tom
   "lounge cosmopolita" do nosso mundo.
3. **Duração:** 2,66 s — raro e terminal; merece a frase inteira.
4. **Escolha:** Mixkit → **"Losing piano"** (id 2024,
   `mixkit.co/free-sound-effects/lose/`) (Mixkit Free License).
5. **Coesão/contraste:** fecha a escada sombria iniciada no `debt` (pizz de um gesto →
   frase de piano); espelho emocional exato da fanfarra do `win`.

### pause — jogo pausado
1. **Som:** interruptor físico DESLIGANDO — clique real de alavanca, pitch caindo
   (1002→428 Hz medidos). Intenção: alguém apagou a luminária da sala de jogo; tudo
   congela.
2. **Referência:** jogos premium usam toggles físicos para estados de sistema (The
   Witness, Inscryption) — nunca beep de menu.
3. **Duração:** 0,31 s.
4. **Escolha:** Kenney *UI Audio* → `switch1.ogg` — interruptor real gravado (CC0).
5. **Coesão/contraste:** par mecânico com `resume` (mesmo material, direção de pitch
   invertida); único domínio "sistema" do jogo, deliberadamente à parte da mesa.

### resume — jogo retomado
1. **Som:** o mesmo interruptor LIGANDO — clique com pitch subindo (134→919 Hz).
   Intenção: a luz voltou, a mesa respira de novo.
2. **Referência:** idem `pause` — toggle físico espelhado.
3. **Duração:** 0,37 s.
4. **Escolha:** Kenney *UI Audio* → `switch10.ogg` (CC0).
5. **Coesão/contraste:** espelho ascendente do `pause`; a dupla conta "off/on" do jeito
   que `jail-in/out` conta "fecha/abre".

---

## Resumo executivo (cue → arquivo final)

| cue | fonte | produção |
|---|---|---|
| dice-roll | Kenney `dice-throw-1.ogg` | — |
| dice-double | `dice-throw-2` + `jingles_PIZZI02` | layer |
| dice-speed | `dice-shake-3` | trim 0,6 s |
| dice-bus | `die-throw-4.ogg` | — |
| step-tick | `footstep_wood_002.ogg` | −6 dB |
| step-land | `impactWood_light_000.ogg` | — |
| buy | Mixkit registradora (atual) | — |
| decline | `bookClose.ogg` | — |
| build | `impactPlank_medium_001.ogg` | — |
| sell | `chips-stack-3.ogg` | — |
| mortgage | `bookPlace3` + `metalClick` | layer |
| unmortgage | `cards-pack-take-out-2.ogg` | — |
| rent-paid | `handleCoins.ogg` | — |
| tax-paid | `bookPlace1` + `handleCoins2` | layer |
| go-bonus | `chip-lay-3.ogg` | discreto |
| busticket-gain | `switch16.ogg` | — |
| debt | `jingles_PIZZI04.ogg` | — |
| loan-granted | `chips-handle-2.ogg` | normalizar |
| loan-interest | `creak3.ogg` | — |
| auction-bid | `chip-lay-2.ogg` | — |
| auction-close | `impactWood_heavy_002` ×2 | gavel duplo |
| card-draw | `card-slide-1.ogg` (atual) | — |
| card-reveal | `card-fan-1.ogg` (atual) | — |
| card-play | `card-place-1.ogg` (atual) | — |
| card-discard | `card-shove-1.ogg` (atual) | — |
| card-shortcut | `cloth1.ogg` | — |
| apagao | Mixkit power-down (atual) | — |
| greve | Mixkit apito (atual) | — |
| hostile-takeover | `impactPunch_heavy_002.ogg` | — |
| reaction | `drawKnife3.ogg` | normalizar |
| immunity | `impactBell_heavy_003.ogg` | — |
| free-parking | `chips-collide-4.ogg` | discreto |
| jail-in | `doorClose_3` + `metalLatch` | layer |
| jail-out | `doorOpen_1.ogg` | — |
| your-turn | Mixkit "Service bell" #931 | trim |
| win | Mixkit fanfare #226 | trim 3,5 s |
| bankruptcy | Mixkit "Losing piano" #2024 | — |
| pause | `switch1.ogg` | — |
| resume | `switch10.ogg` | — |

Packs Kenney (CC0): Casino Audio, Impact Sounds, RPG Audio, Music Jingles, UI Audio.
Mixkit (Free License): 6 arquivos. Nenhuma fonte exige atribuição.
