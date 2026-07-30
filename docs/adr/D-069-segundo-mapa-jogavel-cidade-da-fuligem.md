# D-069 — Segundo mapa jogável selecionado por sala: Cidade da Fuligem

**Data:** 2026-07-30 · **Status:** aceita · **Refina:** [D-017](D-017-tabuleiro-de-48-casas.md), [D-019](D-019-autenticacao-anonima-por-link-sem-contas-no-v1.md), [D-020](D-020-modelo-de-autoridade-sincronizacao-host-autoritativo-realtim.md) · **Revisa:** SRS §16 (linha "Múltiplos temas simultâneos") · **Refinada por:** [D-070](D-070-fuligem-tem-topologia-e-regras-proprias.md)

> **Nota de numeração:** `D-068` está reservada pela worktree paralela da spec 054 (diretório
> opt-in de lobbies anônimos), ainda fora do `main`. Esta decisão nasce como `D-069` de
> propósito para evitar a colisão que o índice já documentou na integração da 043. Se a 054
> não integrar, o buraco fica — id é append-only, nunca renumerável.

**Decisão:** o produto passa a oferecer **dois mapas jogáveis** na criação de sala:

1. **Cidades do Mundo** (`atlas`) — o mapa incumbente, visual e funcionalmente **intacto**.
2. **Cidade da Fuligem** (`fuligem`) — mapa novo, ambientado numa cidade da Revolução
   Industrial (fábricas, chaminés, ferrovias, ferro, madeira, cobre, luz de fornalha).

Com quatro regras estruturais:

- **Mapa seleciona um catálogo autoritativo.** Nesta decisão inicial, os dois mapas
  compartilhavam as mesmas 48 posições e economia; a [D-070](D-070-fuligem-tem-topologia-e-regras-proprias.md)
  substitui somente essa restrição e permite topologia, composição e regras próprias
  declaradas por mapa. Permanecem compartilhados o motor, os contratos de estado, os
  efeitos, raridades e regras de carta. Um mapa fornece, por **catálogo de fonte
  única**: identificador estável, nome público, grupos, suas casas (nomes apresentados,
  ícones, textos), apresentação das construções e das cartas, e os cenários de home, lobby e
  partida. Contratos internos do motor (`airport`, `hangar`, `bus-ticket`, `corner-parking`,
  `centerPot`…) permanecem como estão — o catálogo os **apresenta** (no mapa Fuligem:
  Ferrovia, Estação de Carga, Bilhete de Trem, Sorte Grande).
- **O mapa pertence à sala.** É escolhido **antes** da criação da sala, gravado nela como
  identificador estável (`atlas` | `fuligem`), **imutável** depois de criada, e propagado a
  todos os participantes: convidado que entra pelo link, reload e reconexão recebem o mesmo
  mapa da autoridade. Sala antiga ou sem identificação de mapa usa `atlas`. A seleção nunca
  depende apenas de estado local ou CSS do navegador; partida local de desenvolvimento aceita
  a seleção explicitamente.
- **Todos veem o mesmo mundo.** O catálogo aplicado em cada cliente deriva do mapa
  autoritativo da sala — conteúdo (nomes das casas, textos) e tema visual são o mesmo eixo.
- **O conceito "Fliperama Neon" é removido por completo** — componentes, tokens, fonte de
  pixel, classes, testes e comentários exclusivos. Ele nunca foi mapa jogável nem escolha
  persistida (a própria home o rotulava "CONCEITO 02", com criação de salas bloqueada); era
  prévia visual. O identificador `neon` **não** é reaproveitado pelo mapa novo.

**Por quê:** a extensibilidade de temas sempre foi objetivo declarado do SRS (§1.2 "base
reutilizável e extensível para múltiplos temas"; §1.4 "temas desacoplados da lógica de jogo")
— a §16 a listava fora do escopo do **v1.0** por sequenciamento, não por princípio. Com o
v1.0 lançado em produção (E16/M4, 2026-07-27), o segundo mapa é o primeiro exercício real
dessa extensibilidade e o teste de que a fronteira motor/tema aguenta: a seam já existe
(`BoardTopology`, `boardData` como módulo folha, tokens por `data-board-theme`). O esboço
neon provou a mecânica de troca de tokens, mas nunca teve fantasia, conteúdo próprio nem
persistência — mantê-lo ao lado de um mapa real seria custo permanente sem função.

**Como aplicar:**

- SRS: a versão original desta decisão registrou 48 posições compartilhadas; a
  [D-070](D-070-fuligem-tem-topologia-e-regras-proprias.md) substituiu essa parte pela
  composição própria de 40 casas da Fuligem. A seleção por sala e o sentido de
  "simultâneos" permanecem como definidos aqui.
- `CONTEXT.md`: registrar **Mapa**, **Cidade da Fuligem** e os nomes de apresentação do mapa
  novo (Sorte Grande, Ferrovia, Estação de Carga, Bilhete de Trem, Oficina, Fábrica,
  Complexo de Fábricas, Torre de Ferro).
- Vocabulário do mapa Fuligem é **restrito à lista aprovada**: GO, Banco, Propriedade,
  Aluguel, Hipoteca, Leilão, Troca, Empréstimo, Falência, Prisão, Acaso e Tesouro **não** são
  renomeados. Sem bandeiras/códigos de país no mapa novo — apresentação própria por ícones.
- A sala grava `boardId` na criação (precedente: `opening_mode` do Ritual de Largada, D-046);
  o valor é publicado pela autoridade como o resto do estado da sala (D-020).
- Nenhuma regra nova de jogo nasce desta decisão; a spec que a operacionaliza é a 055.
  As regras e a topologia próprias da Fuligem nascem depois, na D-070/D-071 e na spec 056.
