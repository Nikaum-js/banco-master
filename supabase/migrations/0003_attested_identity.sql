-- Spec 043 (D-035/D-036/D-037) — endurecimento de identidade de transporte. A identidade do
-- participante deixa de ser um token auto-declarado e passa a ser a sessão anônima atestada
-- pelo Supabase Auth (`auth.uid()`). A partir dela: quem escreve onde (tópicos), quem lê o quê
-- (funções em vez de `select` direto) e o que sai da casa da autoridade (perspectiva).
--
-- Este arquivo cresce em fases (D14 do plan) — cada uma commitável e testada sozinha, e NENHUMA
-- aplicada em projeto vivo antes da Fase 6 (FR-030): a aplicação real pede confirmação explícita.
--
-- ============================================================================================
-- FASE 2 (T009) — a tabela fecha e os três tópicos ganham política. Sem RPC ainda (Fase 3+).
-- ============================================================================================

-- 1) Reset pré-lançamento (data-model §8): o vínculo de identidade muda de natureza (token
-- auto-declarado → uid atestado) e não há partida real a preservar. Fingir compatibilidade
-- deixaria linhas com assentos que ninguém consegue reivindicar.
delete from public.rooms;

-- 2) `secrets` — snapshot em duas partes (data-model §7, usado a partir da Fase 5): a autoridade
-- grava o público (mãos/decks já com slot oculto) em `game` e os segredos por assento aqui.
-- Nenhuma conversão de dado: a tabela acabou de ser esvaziada.
alter table public.rooms add column if not exists secrets jsonb not null default '{}'::jsonb;

comment on column public.rooms.seats is
  'Assentos: playerId/uid/nome/cor/peça/host/connected/reentryCode (043: uid substitui token — '
  'D-035). jsonb sem schema fixo; a forma vive em src/net/room.ts.';
comment on column public.rooms.secrets is
  '043, D-037: { hands: { "<uid>": CardId[] }, decks: { acaso: CardId[], tesouro: CardId[] } }. '
  'O servidor nunca interpreta — só seleciona chave (read_snapshot, Fase 5). '
  'Split/merge em src/net/perspective.ts.';

-- 3) Tabela `rooms` — nada de `select` direto (D5): toda leitura passa por função
-- (`room_preview`/`read_snapshot`, Fases 4/5). `insert` continua aberto a qualquer sessão
-- autenticada (quem cria a sala é o anfitrião dela); `update` estreita de "qualquer um" para
-- "só o uid do assento de anfitrião da PRÓPRIA linha" — é isto que fecha os vetores 2/3 (broadcast
-- e publishRoom por não-autoridade, provados em `conformance.test.ts`, viram consequência da
-- mesma regra aqui). `delete` continua sem política, como sempre foi.
--
-- O aviso do linter 0024 (políticas permissivas demais), documentado como deliberado na 0001,
-- deixa de ser esperado a partir daqui — se voltar a aparecer, é regressão (SC-005).
drop policy if exists "rooms_anon_select" on public.rooms;
drop policy if exists "rooms_anon_insert" on public.rooms;
drop policy if exists "rooms_anon_update" on public.rooms;

create policy "rooms_insert_authenticated" on public.rooms
  for insert to authenticated
  with check (true);

create policy "rooms_update_host_only" on public.rooms
  for update to authenticated
  using (
    exists (
      select 1 from jsonb_array_elements(seats) as seat
      where (seat->>'isHost')::boolean and seat->>'uid' = (select auth.uid())::text
    )
  )
  with check (
    exists (
      select 1 from jsonb_array_elements(seats) as seat
      where (seat->>'isHost')::boolean and seat->>'uid' = (select auth.uid())::text
    )
  );

-- 4) Tópicos do Realtime (policies.md §2) — todos privados (`config: { private: true }` no
-- client). Autorização via RLS em `realtime.messages`, avaliada por `realtime.topic()`
-- (o nome do canal assinado) contra `(select auth.uid())`. A IDENTIDADE É O ENDEREÇO (D3): a
-- comparação abaixo é o que torna o remetente inforjável, sem assinatura de payload.
--
-- | Tópico                    | leitura (select)                  | escrita (insert)            |
-- |----------------------------|------------------------------------|------------------------------|
-- | room:<id>:lobby            | qualquer sessão autenticada        | só o uid do anfitrião        |
-- | room:<id>:play             | só quem tem assento na sala        | só o uid do anfitrião        |
-- | room:<id>:s:<uid>          | o próprio uid e o anfitrião        | o próprio uid e o anfitrião  |
alter table realtime.messages enable row level security;

drop policy if exists "room_lobby_select" on realtime.messages;
drop policy if exists "room_lobby_insert" on realtime.messages;
drop policy if exists "room_play_select" on realtime.messages;
drop policy if exists "room_play_insert" on realtime.messages;
drop policy if exists "room_seat_select" on realtime.messages;
drop policy if exists "room_seat_insert" on realtime.messages;

-- Anfitrião da sala <room_id> — único ponto que sabe ler "quem é a autoridade" a partir da
-- linha. `stable` (não `immutable`: lê a tabela) e `security definer` com `search_path` fixo
-- em vazio (linter 0011) — sem isso, um `search_path` mutável dentro de uma função invocada
-- por policy é vetor de escalada.
--
-- Em `public`, não em `realtime`: o schema `realtime` é gerido pela extensão e a role que
-- aplica a migration pode não ter `CREATE` nele — `public` é sempre gravável e é onde 0001/0002
-- já criam as funções de trigger. `security definer` é o que importa aqui (bypassa a ausência
-- de `select` em `rooms` a partir do passo 3), não o schema em que a função mora.
create or replace function public.room_host_uid(room_id text) returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select seat->>'uid'
  from public.rooms, jsonb_array_elements(seats) as seat
  where public.rooms.id = room_id and (seat->>'isHost')::boolean
  limit 1;
$$;

-- `(select realtime.topic())`/`(select auth.uid())` — envolvidos em `select` por convenção de
-- performance do Postgres RLS (initPlan: avaliado uma vez por query, não por linha).
--
-- room:<id>:lobby — leitura: qualquer sessão autenticada que apresente o id (o link é a
-- credencial de entrada, D-019); escrita: só a autoridade.
create policy "room_lobby_select" on realtime.messages for select to authenticated
  using (split_part((select realtime.topic()), ':', 3) = 'lobby');

create policy "room_lobby_insert" on realtime.messages for insert to authenticated
  with check (
    split_part((select realtime.topic()), ':', 3) = 'lobby'
    and (select auth.uid())::text = public.room_host_uid(split_part((select realtime.topic()), ':', 2))
  );

-- room:<id>:play — leitura: só quem tem assento na sala (evita que um mero portador do link
-- leia o jogo — D-036); escrita: só a autoridade.
create policy "room_play_select" on realtime.messages for select to authenticated
  using (
    split_part((select realtime.topic()), ':', 3) = 'play'
    and exists (
      select 1 from public.rooms, jsonb_array_elements(seats) as seat
      where public.rooms.id = split_part((select realtime.topic()), ':', 2)
        and seat->>'uid' = (select auth.uid())::text
    )
  );

create policy "room_play_insert" on realtime.messages for insert to authenticated
  with check (
    split_part((select realtime.topic()), ':', 3) = 'play'
    and (select auth.uid())::text = public.room_host_uid(split_part((select realtime.topic()), ':', 2))
  );

-- room:<id>:s:<uid> — leitura/escrita: o próprio uid do sufixo, ou a autoridade da sala
-- (broadcastPrivate/watchSeat, D2/D9). A comparação de sufixo É o coração da spec: o
-- remetente não escolhe, ele é o nome do canal que conseguiu assinar.
create policy "room_seat_select" on realtime.messages for select to authenticated
  using (
    split_part((select realtime.topic()), ':', 3) = 's'
    and (
      split_part((select realtime.topic()), ':', 4) = (select auth.uid())::text
      or (select auth.uid())::text = public.room_host_uid(split_part((select realtime.topic()), ':', 2))
    )
  );

create policy "room_seat_insert" on realtime.messages for insert to authenticated
  with check (
    split_part((select realtime.topic()), ':', 3) = 's'
    and (
      split_part((select realtime.topic()), ':', 4) = (select auth.uid())::text
      or (select auth.uid())::text = public.room_host_uid(split_part((select realtime.topic()), ':', 2))
    )
  );

-- ============================================================================================
-- FASE 3 (T016) — a escada de entrada sai do canal. Duas funções `security definer`, cada uma
-- por um motivo diferente (D4 do plan):
--
--   • `request_seat` NÃO valida regra de sala (cheia/cor tomada/já iniciada continua sendo o
--     host, com `joinRoom`) — só carimba `auth.uid()` e difunde ao lobby via `realtime.send()`,
--     que roda como o role admin do Realtime e por isso ALCANÇA `:lobby` mesmo o pedinte não
--     sendo a autoridade (a política `room_lobby_insert` acima não se aplica aqui: RPC não
--     passa pelo cliente Realtime, escreve direto em `realtime.messages`).
--   • `reattach_by_code` é a ÚNICA regra de domínio que passa a existir em SQL: o caso que a
--     justifica — o anfitrião que perdeu o aparelho — não tem autoridade para se autorizar.
--     `update public.rooms` dentro de uma `security definer` bypassa a ausência de política de
--     `update` para não-anfitrião (D5) — é exatamente esse bypass controlado que o caso pede.
-- ============================================================================================

create or replace function public.request_seat(room_id text, name text, color text, piece text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'who', jsonb_build_object('name', name, 'color', color, 'piece', piece),
      'uid', (select auth.uid())::text
    ),
    'join',
    'room:' || room_id || ':lobby',
    true
  );
end;
$$;

create or replace function public.reattach_by_code(room_id text, code text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := upper(regexp_replace(code, '\s+', '', 'g'));
  target_player_id text;
  new_seats jsonb;
begin
  select seat->>'playerId' into target_player_id
  from public.rooms, jsonb_array_elements(seats) as seat
  where public.rooms.id = room_id
    and upper(regexp_replace(seat->>'reentryCode', '\s+', '', 'g')) = normalized
  limit 1;

  if target_player_id is null then
    return jsonb_build_object('ok', false, 'reason', 'bad-code');
  end if;

  -- Troca só o `uid` (e marca conectado) do assento casado — o resto do assento (nome, cor,
  -- peça, código) é preservado por construção, igual ao reducer puro de `room.ts` (FR-027).
  select jsonb_agg(
    case when seat->>'playerId' = target_player_id
      then (seat - 'uid' - 'connected') || jsonb_build_object('uid', (select auth.uid())::text, 'connected', true)
      else seat
    end
  ) into new_seats
  from public.rooms, jsonb_array_elements(seats) as seat
  where public.rooms.id = room_id;

  update public.rooms set seats = new_seats where id = room_id;

  -- Aviso ao lobby (T020): é como `host.ts` aprende que um assento mudou de dono fora do seu
  -- controle em memória, e recarrega a sala. Mesmo mecanismo de `request_seat` — direto em
  -- `realtime.messages`, sem depender de quem está online ter privilégio de escrita ali.
  perform realtime.send(
    jsonb_build_object('playerId', target_player_id),
    'reattached',
    'room:' || room_id || ':lobby',
    true
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================================================
-- FASE 4 (T022) — o segredo do assento para de trafegar. `room_preview` é a ÚNICA leitura da
-- sala fora de `read_snapshot` (Fase 5): devolve a sala sem `reentryCode` de ninguém, EXCETO o
-- do assento de quem chamou (D5) — sustenta a escada de entrada da 038 sem abrir a linha, e é
-- o que torna a enumeração impossível (sem id, não devolve nada).
-- ============================================================================================

create or replace function public.room_preview(room_id text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'seats', (
      select coalesce(jsonb_agg(
        case when seat->>'uid' = (select auth.uid())::text
          then seat
          else seat - 'reentryCode'
        end
      ), '[]'::jsonb)
      from jsonb_array_elements(r.seats) as seat
    )
  )
  from public.rooms r
  where r.id = room_id;
$$;

-- ============================================================================================
-- FASE 5 (T036) — a mão para de trafegar. `read_snapshot` é a ÚNICA leitura do snapshot
-- (D6): seleciona `game` (já público — `host.ts` grava via `perspective.splitSnapshot`) e
-- filtra `secrets` por CHAVE, sem conhecer o formato de `hand`/`deck` por dentro —
-- `jsonb_build_object`/`->` bastam. Anfitrião (uid do assento `isHost`) recebe `secrets`
-- inteiro; qualquer outro recebe só a própria entrada de `secrets.hands`, nunca `decks`
-- (ninguém além da autoridade tem por que saber a ordem real de um baralho). O merge de volta
-- num `GameState` — `perspective.mergeSnapshot` — é TypeScript, do lado do cliente (T037).
-- ============================================================================================

create or replace function public.read_snapshot(room_id text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'seats', r.seats,
    'seq', r.seq,
    'game', r.game,
    'secrets', case
      when exists (
        select 1 from jsonb_array_elements(r.seats) as seat
        where (seat->>'isHost')::boolean and seat->>'uid' = (select auth.uid())::text
      )
      then r.secrets
      else jsonb_build_object(
        'hands', case
          when r.secrets->'hands' ? (select auth.uid())::text
          then jsonb_build_object((select auth.uid())::text, r.secrets->'hands'->(select auth.uid())::text)
          else '{}'::jsonb
        end,
        'decks', '{}'::jsonb
      )
    end
  )
  from public.rooms r
  where r.id = room_id;
$$;
