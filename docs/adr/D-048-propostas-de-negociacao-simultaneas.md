# D-048 — Propostas de negociação simultâneas e independentes

**Data:** 2026-07-28 · **Status:** aceita

**Refina:** [D-010](D-010-imunidade-de-aluguel-negociavel.md) e [D-028](D-028-bus-tickets-negociaveis.md).

**Decisão:** uma partida pode manter várias **Propostas de negociação** ativas ao mesmo tempo, inclusive mais de uma criada pelo mesmo jogador ou entre o mesmo par de jogadores. Cada proposta recebe uma identidade persistente e é aceita ou recusada de forma independente pelo próprio destinatário. Criar uma proposta não bloqueia o turno nem impede qualquer jogador de abrir o compositor e enviar outra.

Uma proposta não reserva dinheiro, propriedades, Bus Tickets ou imunidades. Ao aceitar, o motor revalida toda a composição contra o estado mais recente: somente uma proposta ainda válida é executada. Aceitar ou recusar remove apenas a proposta escolhida; as demais continuam ativas. A lista pública apresenta somente quem propôs, para quem e a ação de abrir. Valores e itens ficam nos detalhes sob demanda.

**Por quê:** o contrato anterior guardava uma única proposta global. Além de impedir negociações paralelas sem regra de produto que justificasse isso, ele fazia o botão de nova proposta parecer disponível enquanto o host recusava a ação. Exibir o conteúdo completo de todas as propostas no painel também não escala: uma única troca pode conter várias propriedades, imunidades, Bus Tickets e dinheiro. A identidade independente resolve a concorrência; a apresentação por rota preserva leitura e espaço.

**Alternativas descartadas:**

- **Manter uma proposta global e apenas liberar o botão:** a interface abriria, mas o motor continuaria recusando o envio.
- **Reservar os ativos ao propor:** uma oferta ainda não aceita passaria a bloquear compras, construções e outras negociações, criando travas implícitas fora do fluxo do turno.
- **Mostrar o conteúdo de cada proposta na lista:** multiplica cartões e rolagem conforme a quantidade de itens; os detalhes já têm uma superfície própria.
- **Substituir a proposta anterior do mesmo jogador:** impediria comparar ou manter ofertas alternativas e perderia estado sem ação explícita.

**Como aplicar:** substituir `pendingTrade` por uma coleção persistente de propostas identificadas e por um contador monotônico de ids. Comandos de aceitar e recusar devem carregar o id escolhido, e a autoridade deve derivar o destinatário dessa proposta. Snapshots legados com `pendingTrade` são normalizados para uma coleção de um item. A interface lista as rotas em uma região de altura limitada, abre os detalhes pelo id e mantém “Nova negociação” acionável independentemente da quantidade ativa.
