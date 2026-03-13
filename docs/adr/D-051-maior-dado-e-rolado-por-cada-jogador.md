# D-051 — Maior dado é rolado por cada jogador, à vista da mesa

**Data:** 2026-07-29 · **Status:** aceita
**Refina:** [D-046](D-046-leilao-da-largada-financia-a-loteria.md), substituindo apenas a resolução automática do modo Maior dado.

**Decisão:** quando o host inicia uma sala configurada como **Maior dado**, a mesa entra numa fase compartilhada de rolagem. Os assentos jogam em sequência, na ordem em que estavam no lobby. Somente o dono do assento da vez pode acionar **Rolar meus dados**; esse gesto solicita a rolagem, mas os dois valores continuam sendo gerados e atestados pela autoridade.

A autoridade publica primeiro quem está rolando, para que todas as telas acompanhem o mesmo arremesso, e só depois publica o resultado. O assento seguinte não é liberado antes de o resultado atual estar visível. Ao terminar o último, a autoridade ordena a mesa por soma decrescente, mantém o desempate por RNG da D-046, grava o primeiro snapshot e mostra a revelação final antes da entrada automática no tabuleiro.

**Por quê:** o resultado automático informa a ordem, mas elimina o ritual social que torna uma disputa por sorte interessante. Dar a cada pessoa o momento de lançar cria antecipação, permite comparar o placar parcial e faz a largada pertencer à mesa inteira, sem entregar ao cliente controle sobre o RNG ou sobre a identidade da jogada.

**Autoridade e autoria:** o pedido não carrega `uid`, `playerId`, valores ou resultado. A identidade vem do tópico privado do assento, a autoridade aceita apenas o assento da vez e gera os dados. Pedidos antecipados, duplicados, de outro assento ou fora da fase são ignorados.

**Resiliência:** a fase, os resultados já revelados e um arremesso em curso vivem na sala persistida. Reload ou reassunção da autoridade continua do ponto registrado, sem apagar rolagens nem criar o `GameState` duas vezes. Se o jogador da vez desconectar antes de acionar, a mesa aguarda sua reconexão, sem rolagem automática ou timer punitivo.

**Acessibilidade:** todas as telas recebem os mesmos estados textuais de vez, arremesso e resultado. `prefers-reduced-motion` remove o movimento dos dados, mas preserva a sequência, os valores e a ação por teclado. A animação comunica o arremesso em curso; a autoridade usa um instante persistido para concluir o resultado mesmo se o host recarregar durante a apresentação.
