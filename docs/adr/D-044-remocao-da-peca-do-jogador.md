# D-044 — Remoção da peça do jogador

**Data:** 2026-07-27 · **Status:** aceita
**Revoga:** a escolha de peça introduzida pela spec 038 (FR-022/FR-023) e o §12.5 na parte que a tornava única por sala.

**Decisão:** o jogador deixa de escolher uma **peça** (avião, navio, trem, táxi, balão, bússola, mala, farol). A identidade visual na mesa passa a ser **nome + cor do assento**, e só. Some o catálogo `PIECES`, a regra de unicidade (`availablePieces`, recusa `'piece-taken'`), o campo `piece` de `Seat`/`Identity`/`JoinRequest`/`SessionIdentity`, a arte em `net/ui/pieceGlyphs.tsx` e o seletor "Sua peça" do lobby.

**Por quê:** a peça nunca chegou ao tabuleiro. O token que anda na mesa sempre foi o `PlayerFace` — a carinha pintada com a cor do assento (`game/ui/LiveTokens.tsx`) — e nenhuma superfície de jogo consultava `identity.piece`. O componente escrito justamente para ser o emblema na mesa, `PlayerPiece` (`net/ui/PlayerName.tsx`), ficou com **zero call sites** desde que foi escrito. Fora do lobby, a peça aparecia em exatamente três lugares, todos rótulos: a linha de preview do formulário, a lista de assentos e a revelação de ordem de turno — sempre ao lado do nome, que já identifica, e da cor, que já distingue.

Ou seja: uma escolha obrigatória, com regra de unicidade própria, um erro de recusa próprio (`'piece-taken'`) e uma corrida de concorrência própria no lobby (documentada em `e2e/multiplayer.spec.ts`, que precisava esperar as **duas** listas encolherem), pagando por um adorno que o jogador nunca reencontrava durante a partida. O custo era de manutenção e de fricção na entrada; o benefício, nenhum mensurável. Herança do Monopoly de tabuleiro, onde a peça é o objeto físico que você move — aqui ela não movia nada.

**Alternativas descartadas:**

- **Levar a peça ao tabuleiro** (ativar `PlayerPiece` como badge do token) — resolveria a inconsistência, mas empilha um segundo emblema sobre um token que já carrega cor, carinha e anel de jogador da vez, num alvo de 20–28px. Mais coisa no lugar onde há menos espaço.
- **Manter só como rótulo de lobby** — é o estado que existia. Preserva a fricção e a regra de unicidade sem entregar identidade.
- **Trocar a peça pela skin do avatar** (o visual escolhido em `boards/faceSkins.tsx` ocuparia o mesmo lugar) — é a direção provável, mas o catálogo de skins ainda está em avaliação e não persiste. Quando fechar, entra por decisão própria; amarrar as duas coisas agora seria trocar um requisito por outro ainda não decidido.

**Como aplicar:** o corte é de cliente. A RPC `request_seat` (`supabase/migrations/0003_attested_identity.sql`) continua declarando `piece text default null` — o cliente parou de mandar e o default cobre, então **nenhuma migration é necessária** para que a remoção funcione. Retirar o parâmetro exige `drop function` + recriação numa migration nova, aplicada em produção **antes** do deploy que a usa; fica como limpeza opcional, não como pendência de correção. Salas antigas em `rooms.seats` podem conter a chave `piece` no JSON: ela é simplesmente ignorada na leitura, porque `Seat` não a declara mais.

O SRS perde FR-022/FR-023 e a menção a "token/peça" em §12.5/§13; `CONTEXT.md` perde o verbete. As specs 037/038 **não** são reescritas — são registro do que foi decidido na época, e esta ADR é o que diz o que vale hoje.
