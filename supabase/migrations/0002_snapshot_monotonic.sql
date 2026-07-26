-- Spec 041 (D-034/D9) — durabilidade além do processo: o decorator `durableWrites` resolve a
-- reordenação DENTRO de um host, mas não a escrita atrasada de um host que recarregou — a
-- requisição em voo do processo antigo pode aterrissar depois da do novo e regredir a linha.
--
-- Guarda monotônica no banco: `before update` devolve NULL (no-op silencioso, não erro) quando
-- `new.seq < old.seq`. Estritamente `<` — o upsert PARCIAL de `saveRoom` (que não envia `seq`,
-- então `new.seq = old.seq`) precisa continuar passando. Silencioso é o comportamento certo:
-- uma escrita obsoleta não é erro, é ruído (D9 do plan).
create or replace function public.reject_stale_snapshot() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if new.seq < old.seq then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rooms_snapshot_monotonic on public.rooms;
create trigger trg_rooms_snapshot_monotonic before update on public.rooms
  for each row execute function public.reject_stale_snapshot();
