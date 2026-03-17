# Research: Diretório opt-in de salas públicas anônimas

## R1 — Fonte enumerável

**Decisão:** usar RPC `security definer` que retorna JSON por allowlist, sobre tabela interna
sem policies de acesso direto.

**Motivo:** `public.rooms` não tem `SELECT` por D-036; abrir uma view ou filtrar no cliente
recriaria a enumeração que a spec 043 fechou. JSON explícito evita que coluna futura vaze
automaticamente.

**Alternativas rejeitadas:** policy `published = true` em `rooms`; view com `security
invoker`; Edge Function com `service_role`. As duas primeiras ampliam a superfície de
`rooms`; a última introduz segredo/serviço desnecessário para um contrato que o Postgres
atestado já consegue cumprir.

## R2 — Identidade

**Decisão:** reutilizar `ensureSession()` e `auth.uid()` da sessão anônima.

**Motivo:** D-019/D-042 e D-068 vedam conta permanente. A identidade já sobrevive a reload,
é atestada pelo Supabase e é a unidade aprovada para os limites.

**Alternativas rejeitadas:** fingerprint, IP, `localStorage` próprio, magic link e OAuth.
Fingerprint/IP adicionam dado pessoal e são frágeis; token próprio é forjável; login está
fora do escopo.

## R3 — Entrada e corrida da última vaga

**Decisão:** uma RPC `join_public_room()` serializa pela linha de `rooms`, revalida a
publicação e adiciona o assento antes de devolver o `roomId`.

**Motivo:** o cliente precisa do `roomId` para abrir os tópicos privados, mas uma RPC apenas
de resolução permitiria conhecer o destino antes da decisão final. A admissão atômica dá
exatamente um vencedor para a última vaga e usa o precedente server-side de
`reattach_by_code`, sem mover comandos da partida para o servidor.

**Alternativas rejeitadas:** devolver `roomId` ao selecionar; mandar dois pedidos Realtime ao
host; admission token em duas fases. A primeira vaza em corrida; a segunda não serializa a
vaga no servidor; a terceira não impede o portador de reutilizar o `roomId` como convite.

## R4 — Presença do host

**Decisão:** heartbeat autenticado a cada 30 segundos, elegível até 60 segundos após o último
sucesso, com polling do diretório em intervalo superior a 5 segundos.

**Motivo:** o Realtime do cliente não materializa uma presença consultável por SQL. O
heartbeat comprova que o host atual ainda consegue alcançar o servidor e cumpre a janela
60 + 30 sem alterar `Room.connected`, pausa ou reentrada.

**Alternativas rejeitadas:** usar `rooms.updated_at`, porque convidados e persistência também
o atualizam; cron que despublica, porque ausência deve apenas esconder; estado decidido pelo
cliente, porque seria forjável.

## R5 — Rate limiting

**Decisão:** registrar eventos mínimos numa tabela RLS-fechada e serializar cada decisão por
`pg_advisory_xact_lock` derivado de `auth.uid()` e ação.

**Motivo:** janelas deslizantes simples são auditáveis e testáveis no Postgres real. O lock
impede duas requisições simultâneas de ultrapassarem o teto.

**Alternativas rejeitadas:** debounce, memória do browser, contador global ou dependência
externa. Os dois primeiros são contornáveis; o terceiro pune identidades alheias; a quarta
é desproporcional.

## R6 — Identificador e idade

**Decisão:** `listing_id` aleatório e rotativo; rótulo derivado apenas dele; `created_at`
server-side em `rooms`; resposta devolve minutos inteiros aproximados.

**Motivo:** o identificador público não deriva do `roomId` e perde validade ao despublicar.
O relógio do servidor sustenta ordenação e idade confiáveis.

**Alternativas rejeitadas:** hash estável do `roomId`, nome do host, timestamp exato e relógio
do cliente. Todos aumentam correlação ou manipulabilidade.

## R7 — Compatibilidade e isolamento

**Decisão:** migration aditiva `0008`; ausência de linha em `public_room_listings` significa
privada. O código privado não importa o módulo do diretório.

**Motivo:** salas legadas permanecem utilizáveis e falha da projeção não entra no caminho de
convite/reentrada/partida.

**Alternativas rejeitadas:** coluna `is_public` obrigatória em `rooms` e substituição de
`room_preview`. Ambas acoplam o fluxo privado ao diretório.

## R8 — Observabilidade

**Decisão:** ampliar a união fechada de D-040 com três eventos sem `roomId`, `listingId`,
nome ou uid.

**Motivo:** permite medir adoção e sucesso sem criar trilha de pessoas/salas. Contadores de
segurança do Postgres continuam internos e não são payload de telemetria.

**Alternativas rejeitadas:** logs textuais livres, Sentry breadcrumbs com DTO, ou ausência
completa de sinal operacional.
