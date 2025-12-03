# D-070 — Cidade da Fuligem tem topologia e regras próprias

**Revogada parcialmente por:** [D-072](D-072-taxa-de-fumaca-sai-da-fuligem.md) — a Taxa de Fumaça saiu do jogo; topologia própria e Desvio pela Ferrovia permanecem.
**Refinada por:** [D-073](D-073-desvio-pela-ferrovia-uma-vez-por-turno.md) — o Desvio pode ser usado no máximo uma vez por turno.

**Data:** 2026-07-30 · **Status:** aceita · **Refina:** [D-017](D-017-tabuleiro-de-48-casas.md), [D-069](D-069-segundo-mapa-jogavel-cidade-da-fuligem.md)

**Decisão:** a Cidade da Fuligem deixa de ser apenas uma troca de apresentação sobre as 48
posições do Atlas. Cada mapa continua usando o mesmo motor e pertence à sala, mas pode
declarar sua própria topologia, composição econômica e regras explícitas:

- **Cidades do Mundo (`atlas`)** permanece intacto, com 48 casas, 10 grupos e a economia
  existente.
- **Cidade da Fuligem (`fuligem`)** usa 40 casas: 4 cantos, 22 propriedades em 8 bairros,
  4 Ferrovias, 4 Minas, 3 Acasos, 2 Tesouros e 1 Bilhete de Trem. Os cantos ficam em
  `0/10/20/30`, com 9 casas entre eles.
- A Fuligem não tem as três Utilidades nem casas fixas de Imposto. As Minas ocupam essas
  quatro vagas. Os ralos e redistribuições próprios do mapa são declarados abaixo.
- A seleção continua autoritativa, gravada e imutável por sala. O catálogo seleciona
  topologia, casas, apresentação e regras; contratos compartilhados do motor continuam
  únicos.

Duas regras pertencem somente à Fuligem:

1. **Taxa de Fumaça:** construir Fábrica, Complexo de Fábricas ou Torre de Ferro paga
   `R$ 50` para a Sorte Grande. Oficinas não pagam.
2. **Desvio pela Ferrovia:** ao terminar o turno sobre uma Ferrovia própria e não
   hipotecada, o jogador pode mover para outra Ferrovia própria e não hipotecada. O
   deslocamento é direto, não passa pelo GO e a casa de destino não cobra aluguel.

**Direção de interface:** a faixa de casas deve ocupar área proporcionalmente maior que no
Atlas, aproveitando as 40 casas para apresentar nomes completos. O miolo não recebe nomes
de regiões, linhas divisórias ou outra marca meramente geográfica: continua livre para
dados, diário, Sorte Grande e cobrança de dívida.

**Por quê:** preservar 48 posições tornava a Fuligem visualmente apenas uma skin e carregava
tipos de casa que não serviam à fantasia do mapa. A topologia de 40 casas encurta o circuito,
cria uma curva própria de bairros e abre espaço real para nomes longos sem reduzir a fonte.
As duas regras novas amarram construção, ferrovias e o pote central ao mundo industrial sem
criar cooperação obrigatória.

**Consequências:**

- código que percorre ou calcula lados deve usar o tabuleiro e a topologia ativos, nunca
  assumir `48`, `12` ou os cantos do Atlas;
- simulação, cartas, persistência e UI precisam aceitar compráveis diferentes por mapa;
- D-069 continua válida para seleção, autoridade e remoção do Neon, mas sua exigência de
  mesma topologia/economia é substituída por esta decisão;
- a spec que operacionaliza a mudança é a 056.
