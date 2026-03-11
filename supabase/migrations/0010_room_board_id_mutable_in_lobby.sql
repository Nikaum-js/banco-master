-- D-077 — o mapa da sala passa a ser trocável no LOBBY, pelo host.
--
-- A 0009 deixou `board_id` fora do `do update set` de propósito: pela D-069 o mapa era
-- imutável depois da criação. A D-077 mantém a imutabilidade onde ela ainda vale — do Ritual
-- de Largada em diante — e a suspende onde deixou de valer: enquanto a sala está em `lobby`,
-- não existe estado de partida amarrado à topologia, e a troca é só uma republicação da sala.
--
-- Só `write_room` reabre a coluna, e só quando a sala ESCRITA está em `lobby`. `write_snapshot`
-- (partida em curso) e `reopen_room` continuam sem tocar nela — a revanche preserva o mapa
-- vigente, e trocá-lo depois disso é um `write_room` de lobby como qualquer outro.

create or replace function public.write_room(
  room_id text,
  status text,
  seats jsonb,
  match_generation integer,
  opening_mode text,
  opening_auction jsonb,
  match_history jsonb,
  board_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_uid text := (select auth.uid())::text;
  current_host text := public.room_host_uid(room_id);
  requested_history jsonb := match_history;
begin
  if current_host is not null then
    if current_host is distinct from claimed_uid then
      raise exception 'not the current host of this room';
    end if;
  elsif not exists (
    select 1 from jsonb_array_elements(seats) as seat
    where (seat->>'isHost')::boolean and seat->>'uid' = claimed_uid
  ) then
    raise exception 'not the host of the seats being written';
  end if;

  if not public.room_match_history_is_safe(requested_history) then
    raise exception 'invalid room match history';
  end if;

  insert into public.rooms (
    id, status, seats, match_generation, opening_mode, opening_auction, match_history, board_id
  )
  values (
    room_id,
    status,
    public.preserve_seat_codes(room_id, seats),
    match_generation,
    opening_mode,
    opening_auction,
    requested_history,
    board_id
  )
  on conflict (id) do update set
    status = excluded.status,
    seats = excluded.seats,
    match_generation = excluded.match_generation,
    opening_mode = excluded.opening_mode,
    opening_auction = excluded.opening_auction,
    match_history = public.merge_room_match_history(public.rooms.match_history, excluded.match_history),
    -- O mapa só se move no lobby (D-077). Qualquer outro status escrito preserva o vigente,
    -- inclusive quando a sala chega aqui por um caminho que não é a troca de mapa.
    board_id = case
      when excluded.status = 'lobby' then excluded.board_id
      else public.rooms.board_id
    end;
end;
$$;
