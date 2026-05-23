# Quickstart — Modais informativos (030)

## Testar a lógica (sem UI)

```bash
bunx vitest run tests/game/economy/notice.test.ts   # registro + dispensa
bunx vitest run tests/game                           # suíte inteira (007/016 intactos)
```

## Validar na tela (`bun run dev`)

1. **Free Parking**: deixar impostos/multas acumularem o pote; parar em **Férias** → modal "coletou R$X do Free Parking" → "OK" fecha.
2. **Aquisição Hostil sofrida**: ter a carta na mão (painel 029), usar em uma propriedade de outro jogador → após a transferência, modal "{vítima} perdeu {propriedade} para {atacante}" → "OK" fecha.
3. A notificação **não trava** o turno (some ao dispensar; o jogo segue).

## Atenção

- Single-client: a notificação aparece na tela atual; o roteamento per-cliente é do M3 (o dado já carrega vítima/jogador).
- Comportamento de coleta (007) e de aquisição (016) não muda — só ganha o aviso.
