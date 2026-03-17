# Quickstart: validação da spec 054

## Pré-condições

- branch `codex/054-salas-publicas-seguras`;
- Bun conforme `.bun-version` e `bun.lock`;
- Supabase CLI via `bunx` + Docker para os testes reais locais;
- nenhuma credencial `service_role`.

## Gates estáticos e unitários

```bash
bun run lint
bun run typecheck
bunx vitest run
bun run build
git diff --check
```

## Banco real local

```bash
bunx supabase start
bunx supabase db reset
docker exec -i supabase_db_magnata-imobiliario \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin \
  < tests/db/rpc.sql
docker exec -i supabase_db_magnata-imobiliario \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin \
  < tests/db/public_room_directory.sql

export VITE_SUPABASE_URL="$(bunx supabase status -o json | jq -r '.API_URL')"
export VITE_SUPABASE_ANON_KEY="$(bunx supabase status -o json | jq -r '.ANON_KEY')"
bun run attack:public-rooms
```

O roteiro precisa provar: zero salas privadas enumeradas, allowlist exata, mutações alheias
recusadas, limites, listing expirado sem `roomId` e corrida pela última vaga.

## BrowserContexts isolados

Com as variáveis locais devolvidas por `supabase status -o env`:

```bash
CI=1 PLAYWRIGHT_DEV_PORT=5184 PLAYWRIGHT_PREVIEW_PORT=4184 \
  bunx playwright test e2e/publicRooms.spec.ts --project=chromium
```

O E2E usa contextos separados para host, pessoa admitida pelo diretório, convidado privado
e observador mobile. Ele valida publicação/despublicação, filtros, entrada pública, convite
intacto, início, teclado, mobile e Axe. O contrato SQL prova separadamente que a revanche
não republica o lobby.

## Inspeção do bundle

```bash
rg -n "sb_secret_|SERVICE_ROLE_KEY|SUPABASE_SERVICE|postgresql://" dist
```

Chave publishable é pública por desenho. A string genérica `service_role` pode existir no
SDK do Supabase; o que falha o gate é uma credencial administrativa, JWT secreto ou conexão
Postgres incluída no artefato.
