-- Contrato das RPCs contra um Postgres DE VERDADE.
--
-- POR QUE ISTO EXISTE
--
-- `tests/net/fakeSupabase.ts` é um espelho em TypeScript do que estas funções fazem. Espelho
-- concorda com o que quem o escreveu IMAGINOU que o Postgres faz, então ele nunca discorda por
-- conta própria — e a suíte inteira passava verde com `reopen_room` quebrada em produção.
--
-- O bug que originou este arquivo: `reopen_room` fazia `set seats = ...(seats)` e
-- `set opening_mode = opening_mode`, onde parâmetro e coluna têm o mesmo nome e AMBOS estão em
-- escopo dentro de um UPDATE. Com `plpgsql.variable_conflict = error` (o default, e o que
-- produção usa) isso é `42702: column reference is ambiguous`.
--
-- O detalhe que decide o desenho deste teste: **aplicar a migration não teria pego**.
-- `create function` não valida o corpo de uma função plpgsql — a query só é preparada na
-- primeira execução. Um job que apenas rodasse as migrations num banco limpo passaria verde.
-- Por isso aqui as funções são CHAMADAS, não só criadas.
--
-- O QUE ESTE ARQUIVO NÃO COBRE
--
-- A resolução de overload pelo PostgREST — a causa do 404 `PGRST202` que abriu esta
-- investigação — não passa por aqui: isto fala com o Postgres direto. Aquele modo de falha é
-- drift entre `main` e o banco, e é responsabilidade do `docs/RUNBOOK.md` §1, não do CI
-- (migrations ficam fora do deploy por decisão — ver o rodapé de `.github/workflows/deploy.yml`).

\set ON_ERROR_STOP on

\set host_uid '11111111-1111-1111-1111-111111111111'
\set guest_uid '22222222-2222-2222-2222-222222222222'

-- `auth.uid()` lê o JWT da requisição. Sem PostgREST no circuito, plantamos o claim na sessão —
-- é exatamente de onde a função do Supabase lê.
create or replace function pg_temp.act_as(uid text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    false
  );
end $$;

delete from public.rooms where id = 'TEST01';

-- ---------------------------------------------------------------------------------------------
-- 1. A anfitriã cria a sala.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as(:'host_uid');

select public.write_room(
  'TEST01',
  'lobby',
  format('[
    {"playerId":"p1","uid":"%s","name":"Anfitria","color":"#e11d48","isHost":true,"connected":true,"reentryCode":"HOST01"},
    {"playerId":"p2","uid":"%s","name":"Convidado","color":"#2563eb","isHost":false,"connected":true,"reentryCode":"GUEST1"}
  ]', :'host_uid', :'guest_uid')::jsonb,
	  0,
	  'sealed-bid',
	  null,
	  '[]'::jsonb
);

do $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = 'TEST01';
  assert r.status = 'lobby', 'status inicial: ' || r.status;
	  assert r.match_generation = 0, 'geração inicial: ' || r.match_generation;
	  assert r.match_history = '[]'::jsonb, 'histórico inicial: ' || r.match_history::text;
  assert jsonb_array_length(r.seats) = 2, 'assentos gravados: ' || jsonb_array_length(r.seats);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. Quem não é anfitrião não escreve a sala.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as(:'guest_uid');

do $$
declare recusou boolean := false;
begin
  begin
	    perform public.write_room('TEST01', 'lobby', '[]'::jsonb, 0, 'sealed-bid', null, '[]'::jsonb);
  exception when others then
    recusou := true;
    assert sqlerrm like '%not the current host%', 'recusou pelo motivo errado: ' || sqlerrm;
  end;
  assert recusou, 'write_room aceitou escrita de quem não é anfitrião';
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. A partida corre e termina — snapshot com segredos de ambos.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as(:'host_uid');

select public.write_snapshot(
  'TEST01',
  5,
  '{"turn": 12}'::jsonb,
  format('{"hands": {"%s": ["carta-h"], "%s": ["carta-g"]}, "decks": {"acaso": ["x"]}}',
         :'host_uid', :'guest_uid')::jsonb,
  'ended',
  format('[
    {"playerId":"p1","uid":"%s","name":"Anfitria","color":"#e11d48","isHost":true,"connected":true,"reentryCode":"HOST01"},
    {"playerId":"p2","uid":"%s","name":"Convidado","color":"#2563eb","isHost":false,"connected":true,"reentryCode":"GUEST1"}
  ]', :'host_uid', :'guest_uid')::jsonb,
	  0,
	  'sealed-bid',
	  null,
	  '[
	    {
	      "generation": 0,
	      "endedAt": 9000,
	      "durationMs": 8000,
	      "rounds": 12,
	      "standings": [
	        {
	          "historyId": "hist-host",
	          "playerId": "p1",
	          "name": "Anfitria",
	          "color": "#e11d48",
	          "avatar": "classic-alive",
	          "skin": "careca",
	          "rank": 1,
	          "netWorth": 5000,
	          "properties": 6,
	          "eliminatedAtRound": null
	        },
	        {
	          "historyId": "hist-guest",
	          "playerId": "p2",
	          "name": "Convidado",
	          "color": "#2563eb",
	          "avatar": "classic-alive",
	          "skin": "careca",
	          "rank": 2,
	          "netWorth": 0,
	          "properties": 0,
	          "eliminatedAtRound": 12
	        }
	      ]
	    }
	  ]'::jsonb
);

-- ---------------------------------------------------------------------------------------------
-- 4. Redação por perspectiva (D-037/D-043): o código de reentrada alheio não trafega.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as(:'guest_uid');

do $$
declare vista jsonb;
begin
  vista := public.room_preview('TEST01');

  assert not exists (
    select 1 from jsonb_array_elements(vista->'seats') as s
    where s->>'playerId' = 'p1' and s ? 'reentryCode'
  ), 'o convidado enxergou o reentryCode da anfitriã';

	  assert exists (
    select 1 from jsonb_array_elements(vista->'seats') as s
    where s->>'playerId' = 'p2' and s->>'reentryCode' = 'GUEST1'
	  ), 'o convidado não enxergou o próprio reentryCode';

	  assert jsonb_array_length(vista->'matchHistory') = 1,
	    'o histórico público não chegou ao convidado';
	  assert not ((vista->'matchHistory')::text like '%reentryCode%'),
	    'o histórico público contém credencial';

  -- A mão alheia também não trafega.
  assert (public.read_snapshot('TEST01')->'secrets'->'hands') ? '22222222-2222-2222-2222-222222222222'
     and not ((public.read_snapshot('TEST01')->'secrets'->'hands') ? '11111111-1111-1111-1111-111111111111'),
     'a mão da anfitriã vazou para o convidado';
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. A revanche. É AQUI que a ambiguidade de `reopen_room` estourava — o caminho que
--    efetivamente reabre a sala, não o early-return idempotente.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as(:'host_uid');

-- Sem `reentryCode` nos assentos de propósito: quem reabre não conhece os códigos, e
-- `preserve_seat_codes` tem que devolvê-los.
select public.reopen_room(
  'TEST01',
  format('[
    {"playerId":"p1","uid":"%s","name":"Anfitria","color":"#e11d48","isHost":true,"connected":true},
    {"playerId":"p2","uid":"%s","name":"Convidado","color":"#2563eb","isHost":false,"connected":true}
  ]', :'host_uid', :'guest_uid')::jsonb,
  1,
  'dice-roll'
);

do $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = 'TEST01';

  assert r.status = 'lobby', 'a revanche não voltou ao lobby: ' || r.status;
  assert r.match_generation = 1, 'a geração não avançou: ' || r.match_generation;
  assert r.game is null, 'a revanche não limpou o game';
  assert r.secrets = '{}'::jsonb, 'a revanche não limpou os segredos: ' || r.secrets::text;
  assert r.opening_auction is null, 'a revanche não limpou o leilão de abertura';

  -- `seq` é monotônico pela VIDA da sala, não por partida (D-052).
  assert r.seq = 5, 'a revanche mexeu no seq: ' || r.seq;

  -- Prova que o UPDATE usou o PARÂMETRO, e não a coluna homônima. Se alguém "resolver" a
  -- ambiguidade com `use_column` em vez de variável local, isto continua 'sealed-bid' e falha.
	  assert r.opening_mode = 'dice-roll', 'opening_mode ignorou o parâmetro: ' || r.opening_mode;
	  assert jsonb_array_length(r.match_history) = 1,
	    'a revanche apagou o histórico: ' || r.match_history::text;

  -- D-043: o código é imutável, e quem reabre não o conhecia.
  assert exists (
    select 1 from jsonb_array_elements(r.seats) as s
    where s->>'playerId' = 'p1' and s->>'reentryCode' = 'HOST01'
  ), 'a revanche destruiu o reentryCode da anfitriã';
  assert exists (
    select 1 from jsonb_array_elements(r.seats) as s
    where s->>'playerId' = 'p2' and s->>'reentryCode' = 'GUEST1'
  ), 'a revanche destruiu o reentryCode do convidado';
end $$;

-- ---------------------------------------------------------------------------------------------
-- 6. Idempotência: reenviar a MESMA geração já reaberta não é erro (a rede repete).
-- ---------------------------------------------------------------------------------------------
select public.reopen_room(
  'TEST01',
  format('[
    {"playerId":"p1","uid":"%s","name":"Anfitria","color":"#e11d48","isHost":true,"connected":true},
    {"playerId":"p2","uid":"%s","name":"Convidado","color":"#2563eb","isHost":false,"connected":true}
  ]', :'host_uid', :'guest_uid')::jsonb,
  1,
  'dice-roll'
);

do $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = 'TEST01';
  assert r.match_generation = 1, 'a repetição avançou a geração: ' || r.match_generation;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Uma escrita atrasada da mesma geração não regride o histórico.
-- ---------------------------------------------------------------------------------------------
select public.write_room(
  'TEST01',
  'lobby',
  (select seats from public.rooms where id = 'TEST01'),
  1,
  'dice-roll',
  null,
  '[]'::jsonb
);

do $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = 'TEST01';
  assert jsonb_array_length(r.match_history) = 1,
    'escrita atrasada apagou o histórico: ' || r.match_history::text;
  assert (r.match_history->0->>'generation')::integer = 0,
    'escrita atrasada trocou a geração consolidada: ' || r.match_history::text;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 8. A allowlist do histórico recusa qualquer campo privado.
-- ---------------------------------------------------------------------------------------------
do $$
declare recusou boolean := false;
begin
  begin
    perform public.write_room(
      'TEST01',
      'lobby',
      (select seats from public.rooms where id = 'TEST01'),
      1,
      'dice-roll',
      null,
      '[
        {
          "generation": 1,
          "endedAt": 10000,
          "durationMs": 1000,
          "rounds": 2,
          "standings": [
            {
              "historyId": "hist-host",
              "playerId": "p1",
              "name": "Anfitria",
              "color": "#e11d48",
              "avatar": "classic-alive",
              "skin": "careca",
              "rank": 1,
              "netWorth": 1,
              "properties": 0,
              "eliminatedAtRound": null,
              "reentryCode": "NAO-PODE"
            }
          ]
        }
      ]'::jsonb
    );
  exception when others then
    recusou := true;
    assert sqlerrm like '%invalid room match history%', 'recusou histórico pelo motivo errado: ' || sqlerrm;
  end;
  assert recusou, 'write_room aceitou campo privado no histórico';
end $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Geração fora de ordem é recusada.
-- ---------------------------------------------------------------------------------------------
do $$
declare recusou boolean := false;
begin
  begin
    perform public.reopen_room('TEST01', '[]'::jsonb, 3, 'dice-roll');
  exception when others then
    recusou := true;
    assert sqlerrm like '%not ready for rematch%', 'recusou pelo motivo errado: ' || sqlerrm;
  end;
  assert recusou, 'reopen_room aceitou pular gerações';
end $$;

-- ---------------------------------------------------------------------------------------------
-- 10. Quem não é anfitrião não reabre a sala.
-- ---------------------------------------------------------------------------------------------
select pg_temp.act_as(:'guest_uid');

do $$
declare recusou boolean := false;
begin
  begin
    perform public.reopen_room('TEST01', '[]'::jsonb, 2, 'dice-roll');
  exception when others then
    recusou := true;
    assert sqlerrm like '%not the current host%', 'recusou pelo motivo errado: ' || sqlerrm;
  end;
  assert recusou, 'reopen_room aceitou revanche de quem não é anfitrião';
end $$;

delete from public.rooms where id = 'TEST01';

\echo 'contrato das RPCs: OK'
