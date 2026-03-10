# D-038 — Fim de jogo tem classificação e resumo

**Data:** 2026-07-26 · **Status:** aceita

**Decisão:** o fim de partida deixa de ser um anúncio de vencedor e passa a ser um **fechamento com classificação**. Quando resta um jogador não-eliminado (§9.5), toda tela mostra:

1. **A classificação completa**, do 1º ao último. A ordem é a **inversa da ordem de eliminação**: o vencedor é 1º, o último a falir é 2º, o primeiro a falir é último. Não há critério de desempate a inventar — a eliminação é sequencial e o motor a observa uma de cada vez.
2. **O patrimônio final** de cada jogador — o mesmo `netWorth` que o motor já usa para Auditoria Fiscal e Aquisição Hostil (`game/cards/effects.ts:25`): caixa + preço das propriedades (hipotecada pela metade) + custo das construções. Para quem foi eliminado, o patrimônio congelado é **zero** por definição da falência (§9.1) — o que a linha mostra é **quantas propriedades ele tinha** e **em que rodada caiu**.
3. **A duração da partida** — número de rodadas completas e tempo decorrido entre o início e o fim.

Para isso, o estado da partida passa a registrar três fatos que hoje ele não guarda: a **ordem de eliminação**, o **número da rodada** e o **instante de início**. São fatos do motor, determinísticos e serializáveis — entram no snapshot como qualquer outro campo (princípio VII).

**Por quê:** o §9.5 do SRS define quem vence em uma frase e o §12.2 lista um modal "Fim de jogo" sem dizer o que ele contém. O que existe hoje (`game/ui/GameHUD.tsx:157`) é uma coroa, o nome do vencedor e um botão — e é tudo o que oito pessoas recebem depois de uma hora de partida. Quem foi eliminado no décimo minuto não descobre em que lugar terminou; quem perdeu por pouco não tem como saber que foi por pouco.

A ordem de eliminação é a única classificação que este jogo pode afirmar com honestidade. Ordenar os eliminados por patrimônio não funciona: falência é definida como patrimônio esgotado (§9.1), então **todos os eliminados terminam em zero** e a ordenação por dinheiro empataria a mesa inteira. Sobreviver mais tempo é o resultado que o jogo mede o tempo todo — e é o que a mesa já sente como colocação enquanto joga.

O registro precisa estar **no estado**, não na tela. Três motivos, todos concretos aqui:

- O **log é bounded em 50 entradas** (`game/log.ts:11`). Numa partida de 8 jogadores, a primeira falência já saiu da janela muito antes do fim — reconstruir a classificação a partir do log daria resultado diferente conforme o tamanho da partida.
- O snapshot é o que **reconecta e recarrega** (§11.4). Classificação derivada de memória de aba morre no F5 do vencedor.
- Todas as telas renderizam o mesmo estado (D-032). Classificação calculada por cliente é classificação que pode divergir entre telas — o oposto da autoridade única da D-020.

**Alternativa descartada — estatísticas narrativas ("maior aluguel cobrado", "quem mais construiu"):** é o resumo que dá vontade de fazer, e custa instrumentar os **40 pontos** onde o caixa é mutado hoje (`grep` por `cash +=`/`cash -=` em `src/game`), cada um virando acumulador novo no estado, replicado no snapshot e mantido por toda spec futura que mexa em dinheiro. Preço alto e permanente por uma tela que aparece uma vez por partida. O que a D-038 exige é derivável do estado final mais três campos baratos. Se houver tração e alguém pedir os destaques, eles nascem em spec própria com o custo explícito na mesa.

**Alternativa descartada — classificar por patrimônio no momento da eliminação:** exigiria congelar `netWorth` no instante da falência, o que dá **zero para todo mundo** (§9.1). Sem valor informativo e com campo novo por jogador.

**Alternativa descartada — revanche na tela de fim:** recusada pela spec 038 (FR-027) e mantida recusada aqui. A partida é da sala e o anfitrião não reinicia a mesa; o caminho continua sendo voltar ao início e criar outra. Numa partida local, "novo jogo" continua existindo porque não há sala a encerrar.

**Como aplicar:** a spec 044 operacionaliza. O SRS ganha o conteúdo do fechamento em §9.5 e a linha correspondente em §12.2, e vai a v1.9. A classificação é **derivada** por uma função pura do estado final (nenhum campo `rank` guardado — rank é consequência, não fato). Os três campos novos entram no `GameState` com default seguro para snapshot antigo, no mesmo ponto onde `normalizeLog` já normaliza carregamento (`game/log.ts:22`). O fim de jogo não ganha caminho de saída novo: sala encerra como já encerra (spec 037, FR-028 — o link não reabre a mesa).
