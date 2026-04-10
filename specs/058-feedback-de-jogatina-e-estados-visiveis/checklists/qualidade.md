# Checklist de qualidade — spec 058

Rodado como `/speckit-analyze` + `/speckit-checklist`: consistência entre spec, plano e tasks, e
aderência ao constitution.

## Cobertura: todo FR tem task

| Bloco | FRs | Tasks |
|---|---|---|
| Posse de títulos | FR-001 … FR-006 | T009–T014 |
| Reação registrada | FR-007 … FR-012 | T015–T020 |
| Empréstimos | FR-013 … FR-020 | T021–T026 |
| Imunidades | FR-021 … FR-025 | T027–T030 |
| Efeitos ativos | FR-026 … FR-028 | T031–T034 |
| Estatização (D-080) | FR-029 … FR-031 | T001–T005 |
| Pregão | FR-032 … FR-039 | T035–T039, T050 |
| Bandeiras no tabuleiro | FR-040 … FR-042 | T006–T008 |
| Som de negociação | FR-043 … FR-048 | T040–T044 |
| Responsividade e a11y | FR-049 … FR-055 | T048–T053 |

Sem FR órfão. Sem task sem FR — as das fases 0, 9 e 11 são pré-requisito de regra, andaime
determinístico e gate, todas exigidas pelo enunciado.

## Consistência spec ⇄ plano

- [x] Toda causa-raiz do plano (C1–C6) responde a um sintoma do `Input` da spec.
- [x] Nenhuma decisão do plano (D1–D7) introduz regra ausente do SRS.
- [x] O plano não contradiz nenhuma Clarification — em particular, o **soft-close permanece**
      (C5) e a duração da Estatização veio da D-080, não da spec.
- [x] As primitivas novas moram onde a seam já existe (`game/ui/panels/`), sem pasta nova.

## Constitution

- [x] **I** — a única regra alterada tem ADR e bump de SRS anteriores à spec.
- [x] **VI** — o fato de reação é emitido **depois** do uso; nada da mão antes.
- [x] **VII** — o cue de negociação está fora do `GameState` e não re-toca em reconexão.
- [x] II–V intocados.

## Riscos aceitos

| Risco | Mitigação |
|---|---|
| `meet` deixa faixas do disco visíveis onde antes a bandeira sangrava até a borda | Aceito e verificado nas dez bandeiras: perder as quinas custa menos que perder uma faixa inteira. A moldura de latão do disco já é parte da identidade |
| `clockOffsetMs` é uma **estimativa** por amostra | Por isso o valor exibido também é fechado dentro da janela: o teto não depende da qualidade da amostra |
| `effectRow` ganhar `room` toca todos os chamadores | `Room \| null` continua válido; `identityOf` tem fallback documentado para partida sem sala |
| Espécie nova de log quebra switches | É exatamente o objetivo: os quatro consumidores terminam em `assertNever`, então omitir um é erro de compilação |

## Fora de escopo, reafirmado

Sem migration/DDL/Supabase. Sem dependência nova. Sem redesenho de Atlas ou Fuligem. Sem
orientação obrigatória. Sem alteração de outras cartas, do destino do dinheiro da Estatização, do
soft-close de 24 s ou da economia geral.
