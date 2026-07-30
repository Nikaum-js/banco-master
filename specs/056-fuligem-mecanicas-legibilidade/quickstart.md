# Quickstart — Spec 056

```bash
bun run lint
bun run typecheck
bunx vitest run tests/game/fuligem tests/lib/mapCatalog.test.ts
bun run build
```

Para a verificação visual local:

```bash
bun run dev -- --host 127.0.0.1
```

Abrir uma partida local com `?local=1&players=2&map=fuligem`, conferir o anel e provocar
uma recusa de compra para abrir o leilão. Capturar screenshot nas viewports obrigatórias.
