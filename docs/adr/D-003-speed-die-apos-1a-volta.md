# D-003 — Speed Die após 1ª volta

**Data:** 2026-05 · **Status:** aceita, **SUSPENSO pós-playtest (2026-05-24)**
**Decisão:** Speed Die é ativado individualmente para cada jogador após completar a 1ª volta do tabuleiro.
**Por quê:** Acelera meio/fim de partida e corrige first-mover advantage. Espelha a regra oficial Monopoly 2006+.
**Atualização (2026-05-24):** desativado por feedback de playtest ("o 3º dado gera muita confusão" — Mr.Magnata/Ônibus/Triple). Implementado via flag `THEME.SPEED_DIE_ENABLED=false` (jogo rola sempre 2 dados); o motor, os modais (bus-move/triple-dest) e os testes do Speed Die **permanecem** no código — reversível voltando o flag a `true`. Reavaliar se o first-mover advantage voltar a incomodar (ver D-006: depende de Speed Die + Mr.Magnata + GO Progressivo).
