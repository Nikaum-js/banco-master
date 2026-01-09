# D-054 — Empréstimo vence em três voltas, com cobrança automática

**Data:** 2026-07-29 · **Status:** aceita

**Decisão:** todo empréstimo entre jogadores passa a nascer com **prazo de três voltas do devedor**, contadas pelas passagens dele pelo GO a partir da concessão. O contrato deixa de ser aberto:

1. **1ª e 2ª passagens pelo GO** — o devedor paga só os juros da volta ao credor, como já acontecia.
2. **3ª passagem pelo GO** — o motor cobra **os juros daquela volta e o principal**, automaticamente, sem pedir confirmação a ninguém. O empréstimo é encerrado no ato.
3. **Quitação antecipada** — o devedor continua podendo quitar a qualquer momento pagando **apenas o principal**, e com isso se livra das voltas de juros que ainda faltavam. Quitar é sempre mais barato que esperar o vencimento.
4. **Caixa insuficiente no vencimento** — o que faltar vira **dívida pendente ao credor**, exatamente como já acontece quando os juros do GO não cabem no caixa. O devedor cai na janela de cobrança (§9.1) e precisa vender construção, hipotecar, negociar ou declarar falência. Nada é perdoado e nada é parcelado.
5. **O credor continua sem poder cobrar antes.** Ele não cancela, não antecipa e não renegocia; o prazo é parte do contrato desde a assinatura e é o mesmo para todo empréstimo.

O prazo é **do devedor**, medido no GO dele — quem está preso, parado ou dando voltas curtas não é punido pelo relógio dos outros. Um empréstimo concedido e quitado antes da primeira passagem pelo GO nunca paga juros.

**Por quê:** com prazo aberto, o empréstimo virava renda perpétua. O devedor não tinha nenhum momento em que fosse obrigado a encarar o principal, então a decisão racional era nunca quitar — os juros por volta doíam menos que o desembolso de uma vez, e o credor recebia uma anuidade sem fim em vez de correr um risco. Os dois lados jogavam menos: o devedor não precisava planejar caixa, e o credor não precisava avaliar se aquele devedor sobreviveria.

Três voltas dão a esse instrumento a forma de uma decisão de verdade. O devedor sabe desde a assinatura qual é o horizonte e escolhe entre queimar juros ou levantar o principal a tempo; o credor sabe que vai receber, mas também sabe que a data de recebimento é a data em que o devedor pode quebrar — e é aí que a [D-009](D-009-emprestimos-entre-jogadores.md) finalmente cumpre o que prometia, que era criar risco de aliança, não uma fonte de renda passiva.

Três, e não duas ou cinco: duas voltas quase não dão espaço para o devedor reagir com hipoteca e negociação, e cinco fazem o vencimento cair fora do horizonte de decisão da maioria das partidas — o instrumento voltaria a ser aberto na prática.

**Revoga parcialmente:** a [D-009](D-009-emprestimos-entre-jogadores.md), apenas no ponto em que o prazo era indefinido. Range de juros (10–50%), definição da taxa pelo credor, juros simples sobre o principal original, cobrança por passagem pelo GO e limite de um empréstimo ativo por devedor permanecem intactos.

**Como aplicar:** o SRS ganha o prazo em §15.3, o vencimento em §15.6 e o exemplo atualizado em §15.4. O empréstimo passa a carregar quantas voltas já correram, e a contagem pertence ao estado da partida — não pode ser derivada do relógio nem recontada na interface. A cobrança do vencimento acontece na mesma porta que já cobra os juros ao passar pelo GO, depois do bônus, e usa o mesmo caminho de dívida pendente quando o caixa não cobre. A interface mostra o prazo restante onde o empréstimo já é exibido, e quem deve precisa conseguir ler "faltam N voltas" sem abrir nada. A falência do devedor com empréstimo ativo continua regida por §9.3/§15.5 — o vencimento não cria destino de ativos novo.
