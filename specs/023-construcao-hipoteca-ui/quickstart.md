# Quickstart — UI de construção e hipoteca (023)

## O que entrega

Clicar a **sua** propriedade no tabuleiro abre o popover (carta do imóvel) com dados reais e ações: **construir/vender** casa, **hangar** (aeroporto), **hipotecar/deshipotecar** — cada uma habilitada só quando o motor permite. As marcas de casas/hotel e de hipoteca passam a aparecer no tabuleiro. Motor inalterado (só extração de predicados).

## Validação automatizada

```bash
bunx vitest run tests/game    # inclui tests/game/ui/deedView.test.ts + suíte 004/005/011 (refactor não pode quebrar)
bun run build                 # type-check + build (exit 0)
```

- `deedView` coberto pelos cenários do contrato (SC-005).
- **Crucial:** os testes de construção/hipoteca (004/005/011) devem seguir **verdes** — prova de que extrair os predicados não mudou comportamento.

## Validação visual (manual — sem RTL)

```bash
bun run dev
```

1. **Construir**: garanta a maioria de um grupo (compre as cidades), clique a cidade de **menor nível** → popover mostra "Construir" habilitado → casa sobe no tabuleiro e o caixa cai. Clique a de nível maior → "Construir" desabilitado com dica de uniformidade.
2. **Vender**: numa cidade com construção, "Vender" desce um nível e devolve metade.
3. **Hipoteca**: numa propriedade sem construção no grupo, "Hipotecar" credita metade do preço e a marca de hipoteca aparece; "Deshipotecar" cobra metade × 1,10 (precisa de caixa).
4. **Hangar**: aeroporto próprio → "Construir Hangar"/"Vender Hangar".
5. **Terceiro/livre**: clicar propriedade de outro dono ou livre → popover só informativo, sem ações.

## Critério de pronto

- `deedView` verde nos cenários; suíte 004/005/011 verde; build limpo.
- Ações abrem/disparam corretamente e o tabuleiro reflete o novo estado na hora.
- Nenhuma ação habilitada que o motor recusaria; terceiro/livre sem ações.
- Acabamento dos popovers aprovado no `bun run dev`.
