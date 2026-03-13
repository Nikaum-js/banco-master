# D-046 — Host escolhe o Ritual de Largada

**Data:** 2026-07-28 · **Status:** aceita
**Refinada por:** [D-051](D-051-maior-dado-e-rolado-por-cada-jogador.md), que substitui a resolução automática de Maior dado por rolagens individuais e públicas.
**Refina:** [D-006](D-006-free-parking-com-premio-acumulado.md) — os lances passam a ser mais uma fonte do prêmio acumulado.
**Refina:** a rolagem de ordem inicial descrita no SRS §3.1 e o sorteio da spec 038 (FR-030/FR-031).

**Decisão:** antes de iniciar, o host escolhe no lobby um dos dois modos do **Ritual de Largada**:

1. **Leilão secreto**: todos os assentos, inclusive o host, lacram simultaneamente um valor entre **$0 e $500**, em passos de **$50**, dentro de **15 segundos**. Maior lance joga primeiro; empates são resolvidos pelo RNG da autoridade. Cada jogador paga o próprio lance, e a soma integral entra na **Loteria** (`centerPot`) por cima dos $500 iniciais.
2. **Maior dado**: a autoridade rola automaticamente dois dados brancos para cada assento. A maior soma joga primeiro; empates são resolvidos pelo RNG da autoridade. Ninguém paga pela posição, todos começam com **$2.000** e a Loteria começa com **$500**.

O modo escolhido é parte do estado público e persistido da sala. Convidados podem vê-lo, mas só o host pode alterá-lo, e apenas enquanto a sala está no lobby. Salas novas começam em **Leilão secreto**.

**Por quê:** a primeira posição tem valor real, mas mesas diferentes podem preferir estratégia econômica ou um começo gratuito e casual. A escolha explícita do host torna essa preferência legível antes do início. No leilão, gastar para alcançar propriedades antes compete com preservar caixa; direcionar o custo à Loteria mantém o dinheiro vivo na partida. No modo de dados, a posição não altera a economia.

**Privacidade e autoridade:** durante o Leilão secreto, cada jogador conhece apenas o próprio lance e quais assentos já lacraram. Os valores só se tornam públicos na revelação. A autoridade valida autoria, faixa, passo e unicidade do lance; no modo Maior dado, ela gera e atesta todas as rolagens e a ordem. O cliente nunca declara lance, rolagem ou identidade em nome de outro assento.

**Desconexão e prazo:** o prazo do Leilão secreto pertence ao ritual pré-partida, não ao turno, portanto não altera a D-015. Desconexão antes de lacrar equivale a lance $0 quando o prazo termina; nenhuma cobrança acontece antes da revelação. Reabrir a sala durante uma partida já iniciada continua seguindo as regras de reconexão existentes.

**Como aplicar:** a sala publica e persiste o modo selecionado. No Leilão secreto, o valor viaja pelo canal privado do próprio assento; a autoridade fecha quando todos lacrarem ou o prazo vencer. Em Maior dado, a autoridade resolve as rolagens no clique de início. Nos dois modos, ela cria e grava o primeiro snapshot com a ordem definitiva, publica a revelação e todas as telas entram automaticamente no tabuleiro. A animação é apresentação: prazo, rolagem, cobrança, snapshot e início não dependem de ela terminar.
