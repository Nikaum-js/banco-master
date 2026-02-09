# D-077 — Mapa da sala é trocável no lobby, pelo host

**Data:** 2026-07-31 · **Status:** aceita · **Refina:** [D-069](D-069-segundo-mapa-jogavel-cidade-da-fuligem.md) · **Revisa:** SRS §2.1, §11.1, §16

**Decisão:** o mapa continua **pertencendo à sala** e sendo **um só para todos**, mas deixa de
ser imutável depois da criação. O **host** pode trocá-lo **enquanto a sala está em lobby** —
o lobby inicial e também o lobby de revanche da [D-052](D-052-revanche-reabre-a-mesma-sala.md).

Com três limites:

- **Só no lobby.** Em `bidding`, `rolling`, `playing`, `paused` e `ended` o mapa não muda: a
  partir do Ritual de Largada existe estado de jogo amarrado à topologia e à economia do mapa,
  e não há troca que o preserve. A recusa é do mesmo tipo que a de `selectOpeningMode`
  (`not-in-lobby`), não uma exceção nova.
- **Só o host.** Mesma autoridade que já escolhe o Ritual de Largada e inicia a partida
  ([D-020](D-020-modelo-de-autoridade-sincronizacao-host-autoritativo-realtim.md)); o
  convidado vê o mapa selecionado, sem poder mudá-lo.
- **A troca não toca em mais nada.** Assentos, nomes, cores, Avatares, Skins, códigos de
  reentrada, geração de partida e histórico de partidas da sala atravessam intactos — trocar
  de mapa não é reabrir a sala. Partida já encerrada e gravada no histórico não é reescrita:
  ela foi jogada no mapa que foi, e o resumo permanece como está.

**Por quê:** a D-069 colocou a escolha **antes** da criação da sala e a congelou ali, para
garantir que todos vissem o mesmo mundo. A garantia é legítima; o momento, não. Quem cria a
sala geralmente ainda está **sozinho** — o grupo se forma depois, pelo link, e é aí que a
conversa sobre qual mapa jogar acontece. Com o mapa congelado, a única saída era descartar a
sala, criar outra, redistribuir o link e reunir todo mundo de novo: exatamente o atrito que a
D-052 removeu do fim de partida e que reapareceu na escolha de mapa. Na revanche o efeito é
pior — um grupo que joga na mesma sala fica preso ao mapa da primeira partida para sempre.

A coerência que a imutabilidade protegia não depende dela: quem manda continua sendo a **sala
publicada pela autoridade**, aplicada por todo cliente que a recebe (convite, reload,
reconexão), e a troca só existe onde não há estado de partida para invalidar. O que a
imutabilidade de fato entregava era simplicidade de persistência — e essa é uma conveniência
de implementação, não uma regra de produto.

**Como aplicar:**

- SRS: §11.1 passa a dizer que o host escolhe o mapa na criação **e pode trocá-lo no lobby**;
  §2.1 e §16 perdem a palavra "imutável" na descrição do mapa por sala.
- `CONTEXT.md`: o verbete **Mapa** troca "imutável depois" por "trocável pelo host enquanto a
  sala está em lobby".
- Domínio: `selectBoardId(room, boardId)` ao lado de `selectOpeningMode`, com a mesma recusa
  `not-in-lobby`; a autoridade publica e persiste a sala, e o cliente aplica o mapa recebido
  como já fazia.
- Persistência: a migration do mapa ([`0009`](../../supabase/migrations/0009_room_board_id.sql))
  deixou `board_id` **fora** do `do update set` de propósito. A migration seguinte o reabre
  **apenas** em `write_room` e **apenas** quando a sala escrita está em `lobby` — imutabilidade
  onde ela ainda vale, escrita onde ela deixou de valer. `write_snapshot` (partida em curso) e
  `reopen_room` continuam sem tocar na coluna.
