# D-052 — Revanche reabre a mesma sala

**Data:** 2026-07-29 · **Status:** aceita

**Decisão:** ao terminar uma partida online, a classificação continua sendo o fechamento oficial da mesa, mas deixa de ser uma saída sem retorno. Cada jogador pode sair do resumo e voltar à **mesma sala**, preservando seu assento, nome, cor, Avatar, Skin e código de reentrada. Quando o host volta à sala, ele a reabre para uma nova partida e pode usar o fluxo normal do lobby para iniciá-la.

A revanche:

1. **Não começa automaticamente.** O host ainda escolhe o Ritual de Largada e aciona o início.
2. **Preserva a sala e os participantes**, inclusive quem estiver temporariamente desconectado; as regras normais de conexão do lobby continuam valendo.
3. **Não preserva a partida encerrada.** Caixa, propriedades, construções, cartas, efeitos, empréstimos, negociações, leilões, ordem de turno, Loteria e log são recriados pelos valores iniciais.
4. **Preserva a classificação encerrada enquanto ela estiver aberta.** Cada jogador decide quando deixa o resumo; a ação de outro participante não apaga a tela que ele ainda está lendo.
5. **Mantém a autoridade.** O mesmo host continua sendo a única autoridade capaz de preparar e iniciar a próxima partida.

**Por quê:** voltar ao início do aplicativo obriga um grupo que acabou de jogar junto a criar outra sala, reenviar link, escolher novamente a mesma identidade e aguardar todos se reorganizarem. Nada disso acrescenta decisão de jogo. A sala já representa o grupo e seus assentos; a partida encerrada representa apenas uma rodada de jogo dentro dela. Separar os dois ciclos reduz atrito sem alterar nenhuma regra do tabuleiro.

O resumo final não vira um botão de reinício instantâneo. Ele continua estável, compartilhado e recarregável como determina a [D-038](D-038-fim-de-jogo-tem-classificacao-e-resumo.md). A nova partida nasce somente no lobby, com confirmação explícita do host e um estado de jogo novo.

**Revoga parcialmente:** a alternativa “sem revanche” da [D-038](D-038-fim-de-jogo-tem-classificacao-e-resumo.md), a FR-027/FR-028 da spec 038 e a FR-008 da spec 044 apenas no que exigiam voltar ao início ou tornar o link incapaz de reabrir a mesa. Classificação, resumo, persistência do resultado e caminho de partida local permanecem válidos.

**Como aplicar:** o SRS ganha a Revanche em §11.6 e a saída da classificação em §9.5. A autoridade publica a sala de volta ao estado de lobby e limpa somente o estado específico da partida; o identificador da sala, os assentos, as credenciais de reentrada e o host permanecem. O snapshot seguinte deve ser distinguível do snapshot encerrado para que reload ou mensagem atrasada nunca ressuscite a partida anterior. A spec 049 operacionaliza o ciclo completo e sua cobertura de regressão.
