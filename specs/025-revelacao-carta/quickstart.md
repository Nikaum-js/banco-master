# Quickstart — Revelação de carta sacada (025)

## O que entrega

Ao parar em Acaso/Tesouro, um modal central **mostra a carta** (nome/deck/raridade/efeito) antes de qualquer efeito; "Continuar" saca e processa (aplica imediata / guarda na mão / abre descarte ou atalho). Regras de carta inalteradas.

## Validação automatizada

```bash
bunx vitest run tests/game    # inclui cards/revelacao.test.ts + cards/* de 006 (devem seguir verdes)
bun run build                 # type-check + build (exit 0)
```

- `cardRevealResolve` + `confirmCardReveal` + `activeModal(card-reveal)` cobertos (SC-005).
- **Crucial:** `decks.test`/`hand.test` (006) verdes — prova de que `cardResolve` não mudou.

## Validação visual (manual — sem RTL)

```bash
bun run dev
```

1. Force o topo de um deck (ex. via DebugLogger/estado) ou jogue até cair em Acaso/Tesouro.
2. O peão anda até a casa → abre o **modal de revelação** com a carta (nome/deck/cor de raridade/descrição). Nada mudou ainda (caixa/mão).
3. "Continuar":
   - imediata → efeito aplicado (caixa/posição mudam; aparece no Histórico);
   - mão → entra na sua mão (contador X/3);
   - mão cheia → abre o descarte; Atalho → abre Frente/Trás.
4. Confirme que outro jogador nunca vê o conteúdo de uma carta de mão sua.

## Critério de pronto

- Testes verdes (incl. 006 intacto); build limpo.
- Revelação aparece antes do efeito; "Continuar" produz o mesmo resultado do fluxo atual.
- Turno não finaliza com revelação pendente.
- Acabamento do cartão aprovado no `bun run dev`.
