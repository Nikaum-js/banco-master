# D-036 — Acesso à sala é autorizado no servidor; o link entra, não lê

**Data:** 2026-07-26 · **Status:** aceita
**Decisão:** A linha da sala deixa de ser acessível a qualquer portador da chave pública do frontend. O acesso passa a ter três níveis, decididos **no servidor**:

- **prévia pela sala** — quem apresenta o id da sala (o link) recebe existência, status e quem já sentou. Não recebe segredo de assento nem estado de partida. É o que a tela de entrada precisa para não ser um beco;
- **estado completo** — legível apenas por quem **tem assento** naquela sala;
- **escrita** — exclusiva da **autoridade** da sala. Quem não é o host não grava a linha, em nenhuma coluna. A criação da sala é a única exceção: quem cria vira o host.

Listar salas deixa de ser possível: não existe leitura sem id.

**Por quê:** as políticas vigentes são `using (true)` para `select`, `insert` e `update` (`supabase/migrations/0001_rooms_snapshots.sql`), e a chave pública que as destranca **está no bundle** — por desenho, é pública. A consequência não é teórica: qualquer pessoa que abra o site pode enumerar todas as salas, ler o snapshot de qualquer partida em curso (o que inclui a mão de todos os jogadores) e **sobrescrever ou zerar** a linha de uma partida alheia sem nunca ter tido o link. O comentário na migration chama isso de "obscuridade do id da sala é a barreira do MVP", mas a obscuridade do id só protege quem precisa do id — e ninguém precisa, porque `select` sem filtro devolve tudo. É o furo mais barato de explorar do projeto inteiro e o único que não exige sequer estar numa partida.

A separação em três níveis é o que preserva a [D-019](D-019-autenticacao-anonima-por-link-sem-contas-no-v1.md) enquanto fecha a porta. O link continua sendo a credencial de **entrada** — é assim que alguém convidado descobre que a sala existe e pede assento. O que ele deixa de ser é credencial de **leitura do estado**: ver a partida passa a exigir estar nela. As duas coisas eram a mesma no v1 por acidente de implementação, não por decisão.

**Alternativas descartadas:**

- **Manter `select` aberto e fechar só a escrita** — resolve a destruição e deixa a leitura: o snapshot alheio continua legível por qualquer um, e junto dele a mão de todo mundo. Metade do furo, com a metade que a [D-037](D-037-estado-por-perspectiva-a-mao-nao-trafega.md) precisa fechada.
- **Segredo compartilhado na URL além do id** (`?room=x&key=y`) — vira um segundo id, com a mesma exposição e o dobro de coisas para vazar em print, histórico de navegador e barra de endereço.
- **Deixar como está até haver tração** — é o argumento vigente na migration. Ele valia enquanto não houvesse partida real; a partir do primeiro convidado, o custo de explorar é abrir o devtools.

**Risco aceito — o id da sala continua sendo adivinhável em tese.** O pedido de assento tem que ser aberto a quem só tem o link, então um atacante que acerte um id de sala consegue pedir assento nela. O id vem de UUID e o espaço é grande o bastante para isso não ser um caminho prático, e o que ele conseguiria é o que qualquer convidado consegue: aparecer no lobby e ser recusado ou expulso. A diferença para hoje é que ele não lê nada antes de ser aceito.

**Como aplicar:** as políticas de `rooms` deixam de ser `true` e passam a se apoiar na identidade atestada da [D-035](D-035-identidade-de-transporte-atestada-pelo-servidor.md) — sem ela, não há em quem apoiar. A prévia sai por função no servidor que recebe o id e devolve o recorte público, para que "ler a prévia" não signifique "ler a linha". O aviso do linter (`0024`, policies permissivas demais) que a migration documenta como deliberado deixa de ser esperado: se ele continuar aparecendo, é regressão. A verificação não é encenável com fake — a política roda no Postgres, então a prova é um roteiro de ataque contra o projeto real, com a chave pública do bundle.
