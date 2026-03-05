# Quickstart — Modais centrais (022)

## O que esta feature entrega

As decisões dirigidas por resolução (compra, leilão de propriedade, leilão de casas, descarte por mão cheia, Atalho ±3) aparecem como **cartões modais no centro do tabuleiro**, em vez de na barra do HUD. Motor inalterado.

## Validação automatizada (a parte testável)

```bash
bunx vitest run tests/game    # inclui tests/game/ui/activeModal.test.ts
bun run build                 # type-check + build (exit 0)
```

`activeModal(game)` é coberto para os 5 estados + o caso "nenhum" (SC-005).

## Validação visual (manual — sem RTL no projeto)

```bash
bun run dev
```

Roteiro rápido no cliente local (1 cliente, demo):

1. **Compra**: role os dados até parar numa propriedade livre → o **cartão de compra** abre no centro (nome/cor/preço/aluguéis). "Comprar" debita e dá o título; "Recusar" abre o **leilão**.
2. **Leilão**: após recusar, o cartão de leilão mostra lance/licitante e o prazo (~10s); "Lance +$50" sobe o lance; "Passar" sai; deixar o tempo correr fecha sozinho.
3. **Descarte**: force uma mão de 4 cartas → o cartão de descarte mostra **as suas** cartas (cor de raridade + rótulo) e descarta a escolhida.
4. **Atalho**: saque a carta Atalho → o cartão pergunta "Frente"/"Trás".
5. **HUD não duplica**: enquanto qualquer um desses cartões está aberto, a barra do HUD **não** repete os mesmos botões.
6. **Sem modal**: nos demais estados (rolar, dívida, reação, prisão, finalizar) — nenhum cartão central aparece.

## Critério de pronto

- `activeModal` verde nos 6 casos; build limpo.
- Os 5 modais abrem/fecham e disparam os comandos certos (resultado idêntico ao HUD antigo).
- Descarte nunca mostra carta de adversário (princípio VI).
- Acabamento visual aprovado pelo usuário (referência visual fornecida antes de codar a UI).
