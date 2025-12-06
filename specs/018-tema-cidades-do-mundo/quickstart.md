# Quickstart: Tema "Cidades do Mundo" — valores oficiais

## Verificar

```bash
bunx vitest run tests/game   # suíte 002–017 verde SEM edição (prova de zero regressão) + theme.test.ts
bun run build                # tsc -b + vite, exit 0
```

## O que muda

- `src/game/theme.ts` (novo): **todos os knobs econômicos do tema** num lugar só (tunável).
- Módulos derivam de `theme.ts` (mesmos valores; exports preservados → sem quebrar importadores).
- Aeroportos renomeados (nomes únicos; IATA preservado).
- `boardData` relabelado (oficial/tunável, não mais "provisório").
- `docs/TEMA.md`: ficha de referência do tema.

## Como calibrar (depois)

Ajustar balanceamento = editar **um** valor em `theme.ts` (ex.: `INITIAL_CASH`, `HOUSE_RENT_MULT`) e rodar a suíte.

## Arquivos tocados

- `src/game/theme.ts` (novo) · `store.ts` · `economy/rent.ts` · `economy/construction.ts` · `economy/mortgage.ts` · `balancing/balancing.ts` · `turn/turnMachine.ts` · `lib/boardData.ts`
- `docs/TEMA.md` · `tests/game/theme.test.ts`
