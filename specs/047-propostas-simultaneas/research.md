# Research: Propostas de negociação simultâneas

## Identidade da proposta

**Decision**: usar id numérico monotônico armazenado no próprio `GameState`.

**Rationale**: o host e o replay precisam produzir o mesmo resultado sem gerar UUID na borda. O contador persiste no snapshot e permite endereçar uma proposta sem depender da posição no array.

**Alternatives considered**: índice do array, que muda após remoções; hash do conteúdo, que colide em ofertas iguais; UUID gerado pelo cliente, que amplia a superfície de validação.

## Concorrência de ativos

**Decision**: não reservar ativos e revalidar integralmente no aceite.

**Rationale**: propostas não bloqueiam o turno nem outras propostas. O contrato existente já possui `validateTrade`; reutilizá-lo no aceite mantém a transação atômica.

**Alternatives considered**: reserva pessimista, que bloquearia o jogo; cancelar automaticamente propostas conflitantes, que descartaria intenção sem decisão do destinatário.

## Autoridade

**Decision**: `accept-trade` e `reject-trade` carregam `proposalId`; `actorOf` busca o envelope e retorna seu `toId`.

**Rationale**: com várias propostas, o tipo da ação isolado não identifica quem decide. A ação completa é a única entrada segura compartilhada entre host e affordance.

**Alternatives considered**: enviar `toId` no comando, que permitiria ao cliente declarar a própria autorização; manter proposta selecionada fora do estado do jogo, que não serve ao host.

## Apresentação

**Decision**: renderizar no painel apenas `from → to` e “Ver proposta”, em uma lista com rolagem interna; detalhes vivem no modal.

**Rationale**: a altura da linha deixa de depender da composição e o CTA permanece próximo. A proposta selecionada é estado local de tela, não estado global da partida.

**Alternatives considered**: preview resumido, que ainda cresce e omite informação; accordion no painel, que mistura navegação e detalhe e desloca toda a lateral.

## Compatibilidade

**Decision**: normalizar `pendingTrade` legado para uma proposta de id 1 e inicializar `nextTradeProposalId` em 2; estado sem proposta começa com coleção vazia e contador 1.

**Rationale**: preserva salas existentes sem migration remota nem perda de uma negociação em andamento.
