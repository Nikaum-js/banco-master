# Research — Spec 056

## Estado encontrado

- A worktree já continha um tabuleiro Fuligem de 40 casas e comentários apontando para
  D-070/D-071 inexistentes.
- Minas ainda tinham `MINE_RENT`, `rentMine`, cobrança no resolver, tabela na escritura e
  simulação própria.
- O mapa declarava quatro `zones`; `BoardZones` e CSS desenhavam os nomes/linhas no miolo.
- As células continuavam priorizando `square.short`, apesar de a Fuligem ter menos casas.
- Todo `Overlay` aplicava a mesma vinheta e `backdrop-blur-[3px]`, inclusive leilão.

## Conclusões

- Não criar uma categoria nova para compra: a categoria rentável já representa títulos
  adquiríveis. A exceção de renda pertence ao cálculo/resolução da Mina.
- Remover a escada inteira evita divergência futura entre motor, simulação e UI.
- Aumentar somente o peso da faixa da Fuligem protege o Atlas e entrega área vertical real.
- Uma prop semântica no `Overlay` é mais segura que CSS selecionando filhos do leilão.
- O overlay transparente ainda deve cobrir a viewport para impedir interação acidental.

## Alternativas rejeitadas

- **Cobrar R$ 0 passando pelo fluxo de aluguel:** geraria log e eventos financeiros
  enganosos.
- **Ocultar zonas só com CSS:** deixaria markup e modelo mortos, sujeitos a regressão.
- **Reduzir fonte para caber:** contradiz o ganho de área solicitado e piora legibilidade.
- **Remover o overlay do leilão:** quebraria trap de foco, semântica modal e bloqueio de
  comandos ao fundo.
