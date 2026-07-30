# D-071 — Minas são ativos passivos sem aluguel

**Data:** 2026-07-30 · **Status:** aceita · **Complementa:** [D-070](D-070-fuligem-tem-topologia-e-regras-proprias.md)

**Decisão:** as quatro Minas da Cidade da Fuligem são títulos compráveis, negociáveis e
hipotecáveis, mas **não cobram aluguel**. Cair numa Mina que pertence a outro jogador não
transfere dinheiro nem abre dívida; possuir várias Minas não cria escada de aluguel.

Todas custam `R$ 220`, hipotecam por `R$ 110`, não recebem construções e dão um bônus
passivo diferente enquanto pertencem ao jogador e não estão hipotecadas:

| Mina | Bônus passivo |
|---|---|
| Ferro | construções do dono custam 25% menos |
| Carvão | aluguel das Ferrovias do dono sobe 50% |
| Estanho | impostos e aluguéis pagos pelo dono caem 15% |
| Cobre | aluguel das propriedades do dono com qualquer construção sobe 25% |

Hipotecar uma Mina desliga seu bônus até a deshipoteca. O título continua participando de
compra, recusa, leilão, troca, hipoteca, devolução ao banco, falência e efeitos de carta
aplicáveis a títulos sem construção.

**Por quê:** a Mina é uma peça de composição de carteira. Cobrar aluguel além de melhorar
outros ativos duplicava seu valor e fazia quatro títulos de `R$ 220` acumularem a mesma
receita direta das Ferrovias, sem depender de dados ou investimento. Sem aluguel, a decisão
passa a ser estratégica: comprar a Mina certa para o patrimônio que o jogador já possui ou
pretende montar.

**Consequências:**

- remove-se a escada `25/50/100/200` das Minas do motor, escrituras, resumos e simulação;
- a escritura apresenta primeiro o bônus e informa explicitamente que a Mina não cobra
  aluguel;
- efeitos temporários que dobram ou bloqueiam aluguel não transformam uma Mina em fonte de
  renda;
- testes devem provar ausência de transferência ao pousar em Mina alheia e desligamento do
  bônus quando hipotecada;
- a spec que operacionaliza a mudança é a 056.
