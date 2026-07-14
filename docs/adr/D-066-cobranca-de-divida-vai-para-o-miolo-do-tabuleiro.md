# D-066 — A cobrança de dívida vai para o miolo do tabuleiro

**Data:** 2026-07-30 · **Status:** aceita · **Refina:** [D-056](D-056-cobranca-de-divida-sai-do-centro-da-tela.md) (mantém inteiro o motivo, troca o lugar)

**Decisão:** a cobrança de dívida deixa de ser **faixa ancorada na base da janela** e passa a ser um **cartão no miolo do tabuleiro**, dentro do anel de casas. Enquanto ela estiver aberta:

1. **Nenhuma casa fica escondida** — o cartão ocupa a área do tabuleiro que não é casa. A promessa da D-056 continua valendo por construção, e agora sem cobrar nada em troca.
2. **O tabuleiro não se move.** Nenhuma superfície reserva altura no palco: abrir e fechar a cobrança não desloca a mesa em um pixel. Medido em 1440×900 e 740×360, o retângulo do tabuleiro é idêntico com e sem dívida.
3. **Continua não sendo modal.** Não captura nem prende foco, Esc não fecha (§12.6), e o único escurecimento é um **véu curto dentro do próprio miolo**, que separa o cartão da carta náutica de fundo. Do anel de casas para fora a tela segue intacta e clicável — hipotecar e vender continuam sendo feitos no tabuleiro, com a cobrança aberta.
4. **A leitura é a da D-056, sem corte:** a quem se deve, quanto, o caixa atual, quanto falta e quanto ainda dá para levantar liquidando tudo — este último a mesma medida que autoriza o botão de falência (§9.1). A escolha de credor continua abrindo a partir do cartão, sem empilhar um botão por adversário.
5. **O cartão se mede pelo miolo, não pela janela.** Largura proporcional ao tabuleiro com teto absoluto; num miolo apertado ele encolhe, some a linha de dica e as três ações passam a dividir uma linha só.

**Por quê:** a D-056 acertou o motivo e errou o lugar. O motivo — a cobrança é a única decisão do jogo cuja informação necessária está **fora** dela, então ela não pode cobrir o tabuleiro — segue valendo integralmente. O lugar escolhido para honrá-lo foi a base da janela, e a base da janela só não cobre o tabuleiro se o tabuleiro **encolher**: a faixa media a própria altura e o palco descontava esse valor da altura útil da mesa. Duas consequências, ambas sentidas em uso real:

- **O tabuleiro pulava.** A mesa subia ~90px no instante em que a dívida abria e caía de volta quando ela fechava. Uma dívida é o momento de maior pressão da partida, e a tela inteira se rearranjava debaixo do cursor — reflow no pior instante possível.
- **A base da janela é o pior lugar para a informação mais urgente.** O olho está no tabuleiro e na casa em que o peão acabou de parar; a cobrança aparecia no rodapé, longe do foco, na faixa de tela que o jogo usa para controles acessórios (o controle de áudio precisou de uma regra própria para subir e não cobri-la).

O miolo do tabuleiro cumpre as três exigências ao mesmo tempo e sem contrapartida: é área livre de casa, tem tamanho próprio derivado do tabuleiro, não empurra nada e é para onde o olho já está apontado. É o lugar que a D-056 procurava.

**Custo aceito — o cartão cobre os dados e o histórico enquanto a dívida existe.** Este é o preço honesto da decisão:

- Os **dados** ficam parcialmente atrás do cartão. Rolar com dívida pendente não é permitido de qualquer forma (§3), então nada de operável se perde.
- O **histórico** (diário de bordo no centro) fica parcialmente coberto e volta inteiro assim que a dívida é resolvida. Perde-se contexto de leitura, não capacidade de agir — e o que gerou a dívida está dito no próprio cartão.
- Em **palco empilhado** (≤1100px, tablet em pé), a cobrança rola junto com o tabuleiro em vez de ficar presa na tela. Quem rolar até os painéis laterais precisa voltar ao tabuleiro para agir — que é onde a decisão se toma de todo modo.

Nenhum desses custos esconde casa nem move a mesa, que eram os dois defeitos a matar.

**Como aplicar:** SRS §12.2 (v1.28) — a nota da cobrança troca "faixa ancorada na base, que reduz a altura do tabuleiro" por "cartão no miolo do tabuleiro, que não cobre casa nem reposiciona a mesa"; o resto da nota (não é modal, os cinco números, o devedor nomeado da [D-061](D-061-obrigacao-a-outro-jogador-nao-e-truncada.md)) fica como está. `CONTEXT.md` renomeia o termo **Faixa de cobrança** → **Cobrança de dívida**, porque "faixa" nomeava a forma que acabou de sair.

Implementação: o tabuleiro monta um slot vazio dentro do anel de casas e publica o nó; a cobrança se porta até ele. Adivinhar a geometria do miolo pela janela não é possível — o tabuleiro é quadrado, limitado pela altura, centrado em três colunas no desktop e empilhado com rolagem abaixo de 1100px, e um cartão `fixed` centrado na janela acertaria o miolo só no primeiro caso. Some do palco a variável de reserva de altura (`--dock-h`) e a medição que a alimentava, e some a regra que subia o controle de áudio. Sem slot na árvore (VisualLab, teste que monta só o HUD) o cartão se centra na janela: ausência de slot é caso legítimo, não erro — a cobrança nunca deixa de aparecer por causa de onde foi montada.
