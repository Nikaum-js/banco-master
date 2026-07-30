# Data Model — Spec 056

Não há persistência nova.

## MineSquare

- mantém `pos`, `kind: 'mine'`, `name`, `short`, `metal` e `price`;
- não ganha campo de aluguel;
- hipoteca continua derivada de `price × MORTGAGE_RATIO`;
- o bônus é derivado de `metal` e só fica ativo quando `ownerId` corresponde e
  `mortgaged === false`.

## BoardTopology

- Atlas: `size=48`, cantos `0/12/24/36`;
- Fuligem: `size=40`, cantos `0/10/20/30`;
- `trackTemplate` controla a área do anel sem mudar os índices.

## Overlay

- `veil: 'default' | 'clear'`;
- não entra no estado do jogo ou da sala;
- `clear` muda apenas fundo e blur.
