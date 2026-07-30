# Quickstart de validação: convite

1. Rode `bun run dev`.
2. Crie uma sala e entre com um segundo BrowserContext.
3. Confirme que o botão de cópia antigo ainda copia `/play?room=<id>`.
4. Abra “Compartilhar sala”; confira foco, QR e URL visível.
5. Em contexto com Web Share API simulada, confirme título/texto/URL e cancelamento silencioso.
6. Em contexto sem a API, confirme cópia, link do WhatsApp e instrução para Discord.
7. Feche por `Escape`; o foco deve voltar ao gatilho.
8. Repita em desktop e 740×360 com `prefers-reduced-motion: reduce`.
9. Rode:

```bash
bunx vitest run tests/net/invite.test.ts tests/ui/roomInviteDialog.test.tsx tests/ui/roomLobby.test.tsx
bunx playwright test tests/e2e/room-invite.spec.ts
```
