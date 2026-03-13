# Quickstart: validar o Ritual de Largada

## Headless

```bash
bunx vitest run tests/game/openingAuction.test.ts tests/net/openingAuction.test.ts tests/net/hostOpeningAuction.test.ts tests/net/boot.test.ts tests/net/conformance.test.ts
bun run typecheck
```

Provar:

- validação de faixa/passo/duplicata/autoria;
- ordem por valor e desempate reprodutível;
- $2.000 menos lance por jogador;
- Loteria = $500 + soma;
- nenhum valor alheio no estado público antes da revelação;
- convidado muda para `playing` sem `orderSeen` manual.
- seleção do host persiste e aparece igual ao convidado;
- Maior dado aceita somente o dono do assento da vez, publica um arremesso por vez, revela dois d6 por assento, ordena pela soma e preserva $2.000/$500.

## Navegador

```bash
bun run dev
```

1. Abrir uma sala e entrar por outro contexto de navegador.
2. Host escolher **Leilão secreto** e confirmar que o convidado vê a seleção sem poder alterá-la.
3. Host clicar em **Abrir leilão** e confirmar que ambos veem o Leilão da Largada.
4. Lacrar valores distintos; antes do fechamento, inspecionar que cada tela só mostra o próprio.
5. Ver a revelação ordenar a mesa e aumentar a Loteria.
6. Não clicar no convidado; confirmar entrada automática no tabuleiro.
7. Conferir saldos e painel da Loteria.
8. Criar outra sala, escolher **Maior dado** e iniciar.
9. No host, acionar **Rolar meus dados**; confirmar que host e convidado veem o mesmo jogador rolando e o mesmo resultado.
10. Confirmar que o convidado só recebe a ação depois de o resultado do host aparecer; rolar no convidado.
11. Conferir a revelação da ordem por soma, caixas de $2.000 e Loteria de $500.

## Visual e acessibilidade

- screenshots desktop 1440 × 900 e paisagem compacta 740 × 360;
- teclado: seletor, atalhos e lacre;
- foco visível e status textual dos assentos;
- repetir com `prefers-reduced-motion: reduce`;
- axe sem violações sérias/críticas.

## Regressão

```bash
bunx vitest run
bun run lint
bun run typecheck
bun run build
```
