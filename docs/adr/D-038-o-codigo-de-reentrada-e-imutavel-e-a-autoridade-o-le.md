# D-038 — O código de reentrada é imutável, e a autoridade o lê

**Data:** 2026-07-27 · **Status:** aceita
**Decisão:** o `reentryCode` de um assento passa a ter duas propriedades garantidas **pelo servidor**, não pela boa-fé de quem escreve:

- **imutável depois de mintado** — nenhuma gravação da linha da sala altera ou apaga um código já guardado, venha ela de quem vier, **inclusive da própria autoridade**. Toda escrita conserva o código armazenado para cada assento, casando por `playerId`. Assento novo entra com o código que o anfitrião mintou; assento removido some junto com a linha do assento, como sempre;
- **legível pela autoridade** — o anfitrião da sala recebe os assentos íntegros nas duas leituras de servidor (`room_preview` e `read_snapshot`). Para quem não é a autoridade nada muda: o próprio código, e só o próprio.

**Por quê:** a [D-036](D-036-acesso-a-sala-autorizado-no-servidor.md) desenhou a prévia da sala para quem está **entrando** — alguém que tem o link, ainda não tem assento, e não pode ler segredo de ninguém. A [D-037](D-037-estado-por-perspectiva-a-mao-nao-trafega.md) fez o mesmo com o snapshot. Nenhuma das duas perguntou o que acontece quando **a autoridade** usa essas leituras, e ela usa: é de lá que ela remonta a sala que **grava em seguida**.

O resultado foi um defeito com três caminhos e uma raiz só — a autoridade lia por um caminho pensado para não-autoridade, o código alheio voltava vazio, e ela persistia esse vazio:

1. **anfitrião dá F5 no lobby** — não existe snapshot ainda, então a autoridade é remontada a partir da sala que o *cliente* vê, e o cliente nunca recebe código nenhum. O primeiro `saveRoom` apagava o código de **todos os convidados**, antes mesmo de a partida começar. É o caminho mais comum dos três;
2. **alguém reanexa** — `handleSeatReattached` recarregava a sala pela prévia (redigida) e a regravava: quem *não* reanexou perdia o código, e a segunda reanexação ficava impossível;
3. **`read_snapshot` devolvia `seats` cru** — o espelho do mesmo descuido, na direção oposta: em vez de esconder demais, mostrava demais. Todo jogador com assento recebia o código de **todos**, e o código é credencial portadora — `reattach_by_code` o converte em posse do assento. Quem lesse o do anfitrião tomava a autoridade junto.

Os três eram invisíveis para a suíte headless e para a UI: `client.ts` redige de novo ao aplicar, então nada aparecia na tela — o segredo simplesmente já tinha cruzado o fio, ou já tinha sido destruído em silêncio.

**Por que a autoridade pode ler.** Ela **mintou** cada um desses códigos (`newReentryCode`, em `host.ts`), os teve em memória e os escreveu na linha. Escondê-los dela não protege nada que ela não tenha tido primeiro — e a [D-037](D-037-estado-por-perspectiva-a-mao-nao-trafega.md) já lhe dá `secrets` inteiro, isto é, a mão de todo mundo. Quem toma o assento de anfitrião toma o jogo; saber os códigos não acrescenta poder a quem já pode expulsar, ler tudo e reescrever a sala. O que a leitura íntegra acrescenta é **correção**: é ela que devolve a unicidade do código por construção, porque `newReentryCode(rng, taken)` só evita colisão contra os códigos que consegue enxergar.

**Por que a imutabilidade mora na gravação.** As três variantes acima são o mesmo erro cometido em três lugares. Corrigir cada chamador deixa o quarto caminho — o que ninguém escreveu ainda — livre para repetir o defeito. A garantia vale mais no único ponto por onde todos passam: a escrita. Depois dela, "recarregar não pode ser desaprender" deixa de depender de o chamador lembrar disso.

**Alternativas descartadas:**

- **Só a imutabilidade na gravação, mantendo o código escondido também da autoridade** — fecha a destruição sem abrir leitura nenhuma, e é a opção de menor superfície. Descartada porque a unicidade do código deixaria de ser por construção: o anfitrião mintaria sem ver os já tomados, e duas colisões dariam o assento errado a quem reanexasse. A probabilidade é ínfima (~1 em 4×10⁷ por sala), mas trocaria uma garantia por uma aposta, e o custo de evitá-la é uma leitura que não concede poder novo.
- **Corrigir os três chamadores, sem guarda na gravação** — foi o que a implementação fez primeiro, e é o que deixa o próximo caminho desprotegido. Um defeito que se repetiu três vezes por conta própria não deve depender de disciplina para não voltar.
- **Mintar o código no servidor** — resolveria unicidade e leitura de uma vez, mas põe geração de domínio em SQL. A [spec 043](../../specs/043-identidade-de-transporte/spec.md) limita deliberadamente a regra de domínio no banco a `reattach_by_code`, e por bom motivo: o que está em SQL não é testável pela suíte headless.

**Como aplicar:** `preserve_seat_codes(room_id, seats)` no `0003`, chamada por `write_room` e por `write_snapshot`; a exceção da autoridade em `room_preview` e em `read_snapshot`, pela mesma seleção por chave que a [D-037](D-037-estado-por-perspectiva-a-mao-nao-trafega.md) já usa para `secrets`. Os dois adapters espelham as duas coisas (`localTransport`/`LocalHub` e o `fakeSupabase` da suíte) — paridade de recusa, como na D12 do plan. A prova de que a redação continua valendo para quem não é a autoridade é `tests/net/seat-secrets.test.ts`, que varre o payload inteiro em vez de conferir campo esperado.
