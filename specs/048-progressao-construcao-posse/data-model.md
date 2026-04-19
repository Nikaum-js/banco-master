# Data Model: Progressão de construção por posse

Nenhum campo persistido é adicionado.

## Cidade

- **Origem**: `Square` de tipo propriedade + título correspondente no `GameState`.
- **Atributos relevantes**: país/grupo, dono, hipoteca e nível de construção 0–7.
- **Invariante mantida**: a diferença de nível entre cidades do mesmo país possuídas pelo jogador não pode superar 1 após uma construção válida.

## País

- **Origem**: conjunto estático de cidades com o mesmo grupo.
- **Atributos derivados**:
  - tamanho total: 2 ou 3;
  - quantidade possuída pelo jogador: 0 até o tamanho total;
  - completo: quantidade possuída igual ao tamanho total.

## Teto de construção por posse

- **Derivação**:
  - nenhuma cidade: nível 0;
  - país incompleto: nível máximo igual à quantidade possuída;
  - país completo: nível máximo 7.
- **Persistência**: nenhuma; recalculado a partir do estado autoritativo.
- **Uso**: bloqueia somente a transição para um nível acima do teto.

## Transições

| Posse | Níveis permitidos por cidade | Próxima ampliação |
|---|---|---|
| 1/3 | 0 → 1 | adquirir a 2ª cidade |
| 2/3 | 0 → 1 → 2, com uniformidade | adquirir a 3ª cidade |
| 3/3 | 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7, com uniformidade | topo |
| 1/2 | 0 → 1 | adquirir a 2ª cidade |
| 2/2 | 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7, com uniformidade | topo |

## Compatibilidade

Um título persistido acima do teto derivado continua com seu nível atual. A tentativa de subir novamente é bloqueada; venda permanece disponível para reduzir o nível pelas regras existentes.
