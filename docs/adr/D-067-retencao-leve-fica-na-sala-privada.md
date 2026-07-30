# D-067 — Retenção leve fica na sala privada

**Data:** 2026-07-30 · **Status:** aceita · **Refina:** [D-019](D-019-autenticacao-anonima-por-link-sem-contas-no-v1.md), [D-038](D-038-fim-de-jogo-tem-classificacao-e-resumo.md), [D-046](D-046-leilao-da-largada-financia-a-loteria.md) e [D-052](D-052-revanche-reabre-a-mesma-sala.md)

**Decisão:** a sala privada passa a conservar uma memória curta das partidas finalizadas nela e a apresentar essa memória no lobby de revanche. A retenção pertence à sala, não à pessoa:

1. **Histórico limitado e idempotente.** A sala guarda no máximo as 10 partidas finalizadas mais recentes. Cada entrada é identificada pela geração da partida e só pode existir uma vez, mesmo após reload, repetição de snapshot ou mensagem atrasada.
2. **Resumo, não replay.** A entrada contém somente o que já existe no resumo final: geração, término, duração, rodadas, classificação, identidade visual dos assentos, patrimônio, quantidade de propriedades e rodada de eliminação. Mãos, cartas, negociações privadas, log completo, credenciais e códigos de reentrada nunca entram no histórico.
3. **Estatísticas derivadas.** Partidas, vitórias, taxa de vitória, colocação média e melhor patrimônio por jogador, além de duração e rodadas médias da sala, são calculados das entradas preservadas. O motor não ganha contadores narrativos nem instrumentação financeira nova.
4. **Separação econômica total.** O histórico atravessa a revanche, mas nenhum dado econômico ou mecânico da partida anterior volta ao novo estado de jogo. A D-052 continua valendo para caixa, posição, propriedades, construções, cartas, efeitos, negociações, ordem, Loteria, decks e log.
5. **Sem perfil.** O histórico não cruza salas e não cria conta, perfil, ranking público, leaderboard, matchmaking, replay ou analytics individual. A identidade estável usada para agrupar estatísticas existe somente dentro daquela sala e não é credencial.
6. **Presets sem regras novas.** O lobby apresenta objetos de preset extensíveis que mapeiam exclusivamente configurações já autorizadas. No lançamento, “Leilão secreto” seleciona `sealed-bid` e “Maior dado” seleciona `dice-roll`. O host escolhe antes do início, todos veem a escolha publicada e o navegador pode apenas lembrar a preferência local do host para uma sala nova; a autoridade publicada sempre vence.

**Por quê:** a revanche da D-052 mantém o grupo reunido, mas hoje apaga também a única lembrança compartilhada do encontro. Conservar dez resumos já calculados dá continuidade à sala sem criar o produto muito maior que §16 rejeitou: não há identidade global, coleta comportamental ou armazenamento do percurso inteiro. Derivar as estatísticas desse conjunto pequeno mantém a regra auditável e impede que o motor seja contaminado por dezenas de acumuladores.

O mesmo princípio vale para presets. O Ritual de Largada já é uma configuração pública e host-autoritativa; nomear suas combinações como objetos torna a apresentação extensível sem criar uma segunda fonte de verdade nem insinuar dinheiro inicial, velocidade, timer ou bots.

**Como aplicar:** SRS v1.29, §11.6 e novo §11.7. `public.rooms` recebe uma coluna aditiva limitada a dez resumos. Só a autoridade da sala grava o conjunto, as RPCs continuam atestando o host e salas antigas leem histórico vazio. A interface mostra histórico e estatísticas somente no lobby de revanche, em painel compacto e acessível. O preset resolve para `openingMode`; não existe estado paralelo de “modo do preset”.
