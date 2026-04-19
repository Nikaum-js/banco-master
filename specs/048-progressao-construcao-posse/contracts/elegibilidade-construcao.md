# Contract: Elegibilidade de construção

## Entrada observável

- estado atual da partida;
- cidade escolhida;
- jogador do turno;
- posse e níveis das cidades do mesmo país;
- hipotecas e caixa.

## Saída do motor

- uma construção válida sobe exatamente um nível, debita exatamente um custo e registra exatamente um evento;
- uma construção inválida devolve o estado sem alteração.

## Matriz do teto

| Tamanho do país | Cidades possuídas | Teto |
|---|---:|---:|
| 3 | 1 | 1 casa |
| 3 | 2 | 2 casas |
| 3 | 3 | Skyscraper |
| 2 | 1 | 1 casa |
| 2 | 2 | Skyscraper |

## Projeção da interface

A interface recebe a elegibilidade do mesmo estado e expõe:

- `podeConstruir = true` quando todas as guardas permitem a próxima transição;
- `podeConstruir = false` com razão `limite-posse` quando o nível atual já alcançou o teto parcial;
- razões existentes para hipoteca, topo, uniformidade, caixa e país incompleto no passo do Skyscraper.

## Compatibilidade

Nenhuma alteração no formato de comando, `GameState`, snapshot ou transporte. A autoridade continua rejeitando comandos inválidos mesmo que uma interface desatualizada tente enviá-los.
