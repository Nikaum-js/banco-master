# D-035 — Falha de interface não derruba a partida

**Data:** 2026-07-26 · **Status:** aceita

**Decisão:** Uma exceção não tratada na árvore de interface deixa de ser tela branca. Ela passa a ser contida por **duas fronteiras com contratos diferentes**:

- A **fronteira de jogo** fica **abaixo da sessão de sala**. Quando a superfície da partida quebra, a conexão, a presença, a autoridade e o relógio de prazos continuam de pé; só a vista cai, e é remontada a partir do estado autoritativo. Para a mesa, nada aconteceu.
- A **fronteira de último recurso** cobre a própria casca de sessão. Como a queda dela desmonta a sessão, ela **encerra a presença antes de exibir a tela de falha** — a mesa aprende pelo mecanismo que já existe, a pausa por desconexão (§11.3). Nenhuma causa de pausa nova.

Três regras acompanham a fronteira:

1. **Remontar é uma tentativa, não um laço.** Se a mesma falha se repete na remontagem, a tela para de tentar e diz que parou.
2. **A volta é reentrada, não reload cego.** Numa sala, o caminho de recuperação é o que a spec 041 construiu: link + token, ou link + código do assento ([D-033](D-033-codigo-de-reentrada-por-assento.md)). A tela de falha oferece esse caminho em vez de mandar recarregar e torcer.
3. **Em partida local não existe recuperação, e a tela não finge que existe.** Não há estado durável fora da aba; a tela diz isso.

Exceção **fora do render** — handler de evento, timer, callback de canal, promessa rejeitada — não é alcançada por fronteira nenhuma e **não pode ficar muda**. No caminho de autoridade do host, um comando que aborta ao ser aplicado é recusado de forma visível para quem o enviou, nunca engolido.

**Por quê:** o princípio VII promete que nada se perde e nomeia uma única forma de falha — a rede. A D-034 acrescentou a segunda, a persistência. A terceira sempre esteve lá e nunca foi nomeada: o **nosso próprio código**. Hoje `src/` não tem uma fronteira sequer (achado F1 da auditoria de 2026-07-23), e uma exceção em qualquer render desmonta a árvore inteira — o jogador fica com um `<div id="root">` vazio, sem frase, sem caminho e sem saber que a partida ainda existe do outro lado.

O risco deixou de ser hipotético com a spec 040. O log virou estrutura tipada difundida para todo mundo e renderizada igual em todas as telas (`boards/shared.tsx:1597` chama `describeLogEntry` **durante o render**; `ui/log/describeLog.ts:19` e `ui/log/logIcon.tsx:12` lançam por exaustividade; `ui/sound/classify.ts:42` lança dentro do seletor que alimenta o som). Um `LogKind` sem descritor não derruba **um** jogador: derruba **a mesa inteira, no mesmo instante**, porque todos recebem o mesmo fato. E como o log faz parte do `GameState` (`game/turn/types.ts:87`), ele está no snapshot — recarregar carrega o veneno de volta e a tela quebra de novo. É o único modo de falha do projeto em que **F5 não é saída**.

A escolha de **onde** a fronteira fica não é detalhe de implementação: é a decisão inteira. `roomSession.dispose()` não derruba a conexão, por desenho (StrictMode, spec 037 — `net/roomSession.ts:246`). Uma fronteira única no topo desmonta o `OnlineRoom`, mata o `setInterval` que chama `tick()` (`net/ui/OnlineGate.tsx:79-82`) e **deixa o canal vivo**: presença intacta, mesa não pausa, e o host parou de fechar prazos. Um leilão aberto nunca mais fecha, uma janela de reação nunca vence, e ninguém tem como perceber — a mesa parece normal. Trocar tela branca por mesa zumbi seria repetir na interface exatamente a divergência silenciosa que a D-034 recusou na persistência. Daí a fronteira de último recurso encerrar a presença: se a casca caiu, a autoridade caiu junto, e a mesa merece saber disso pelo mecanismo que já sabe comunicar ausência.

**Alternativa descartada — uma fronteira só, no topo, com botão "recarregar":** é o que a auditoria sugeriu (item 6 da priorização) e o que qualquer app faz. Custa duas coisas aqui. Primeira: transforma toda queda de vista em queda de sessão — num host, um erro de renderização que não precisava chegar à mesa pausa a mesa. Segunda: "recarregar" é conselho vazio contra o crash-loop do estado envenenado; o botão recarrega, o snapshot volta, a tela quebra de novo, e o jogador conclui, corretamente do ponto de vista dele, que a partida acabou.

**Alternativa descartada — causa de pausa própria (`crash`):** nomear a falha de interface como terceira causa parece mais honesto, mas para a mesa a diferença não existe — alguém não está lá. A pausa por desconexão já não pune, já não expira e já nomeia quem falta. Cada causa nova é mensagem nova, coexistência nova e caminho de retomada novo (§11.3, D-034): preço alto por uma distinção que só interessa a quem está lendo o relatório de erro, e que o relatório de erro já registra.

**Como aplicar:** a spec 042 operacionaliza esta decisão. O SRS ganha nota em §11.4 e vai a v1.8. A fronteira de jogo envolve o conteúdo servido pelo `OnlineGate`, não o gate; a de último recurso envolve a raiz e chama o encerramento de presença antes de renderizar. A tela de falha é superfície de sessão, não de partida — ela não entra no `GameState` e não é difundida. O que falta para a promessa valer também em **partida local** é o item 8 da auditoria (snapshot do `GameState` fora da aba): esta decisão não o antecipa nem o dispensa — ela apenas proíbe a interface de prometer o que a arquitetura ainda não tem.
