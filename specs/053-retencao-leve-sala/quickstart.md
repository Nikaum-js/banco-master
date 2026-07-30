# Quickstart de validação: retenção e presets

1. Aplique migrations 0001–0007 num Supabase local limpo.
2. Rode os contratos SQL e as suítes `roomHistory`, `roomPresets`, `rematch`, `conformance` e `supabaseFallback`.
3. Crie uma sala em dois BrowserContexts isolados.
4. Escolha cada preset como host e confirme a mesma escolha no convidado; convidado não altera.
5. Finalize uma partida, volte ao lobby em ambos e abra “Histórico da sala”.
6. Recarregue os dois contextos e confira mesma entrada/estatísticas.
7. Inicie e finalize revanche; confirme duas gerações e economia nova.
8. Inspecione `match_history`: nenhum campo privado.
9. Teste desktop e 740×360 com teclado, axe e screenshots.

```bash
bunx vitest run tests/net/roomHistory.test.ts tests/net/roomPresets.test.ts tests/net/rematch.test.ts tests/net/supabaseFallback.test.ts
bun run lint
bun run typecheck
bun run build
```
