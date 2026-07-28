# Quickstart: Avatares finais

## Fluxo manual

1. Abra `/?host=1`.
2. Escolha cada um dos cinco avatares e cada uma das oito skins nos grupos separados.
3. Confirme as quarenta combinações no preview e que os dois `aria-pressed` acompanham as escolhas.
4. Crie a sala e confira avatar + skin na lista de assentos.
5. Entre com um segundo jogador usando a mesma combinação e outra cor; a entrada deve funcionar.
6. Inicie a partida e confira a composição no token, painel, HUD, modais e negociação.
7. Recarregue e reentre; avatar + skin devem permanecer.
8. Ative movimento reduzido; os avatares devem ficar estáticos.

## Gates

```bash
bun run typecheck
bunx eslint <arquivos alterados>
bunx vitest run tests/net/room.test.ts tests/net/identity.test.ts tests/net/conformance.test.ts tests/ui/avatarConceptLab.test.tsx
bunx playwright test e2e/avatarSkins.spec.ts
bun run build
```

## Inspeção visual

- Desktop: 1440×820.
- Mobile: 390×844.
- No mobile, rolar a casca até nome, cor e CTA e confirmar que o botão final entra no viewport.
- Tokens: 16px, 24px, 32px e 72px.
- Observar cada idle por pelo menos 20 segundos; nenhum gesto deve parecer contínuo ou repetir antes de 7 segundos.
