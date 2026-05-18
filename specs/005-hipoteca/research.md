# Research — Hipoteca (Fase 0)

Decisões técnicas. Feature pequena: escreve a flag `mortgaged` (efeitos já existem).

---

## D1 — Sem novo estado; reusa `Title.mortgaged` (003)

- **Decisão:** não adicionar campos. `mortgageProperty`/`unmortgageProperty` apenas ligam/desligam `Title.mortgaged` e movem `cash`.
- **Rationale:** os *efeitos* da hipoteca já consomem a flag (003: aluguel 0; 004: `canBuild` bloqueia grupo com hipotecada). Adicionar estado seria redundante.
- **Alternativas:** guardar o valor recebido na hipoteca por propriedade — rejeitada: o valor é derivável de `price/2` a qualquer momento.

## D2 — Bloqueio do §6.1 reusa a checagem de construção

- **Decisão:** hipotecar é bloqueado se a propriedade — ou qualquer do grupo possuída pelo jogador — tem construção (`houses > 0 || hotel`). Reusa a varredura de grupo de `construction.ts`/`titles.ts`.
- **Rationale:** simetria com a 004 (que bloqueia construir em grupo com hipotecada); evita estados inconsistentes (hipotecar embaixo de uma construção).
- **Alternativas:** permitir hipotecar e auto-vender construções — rejeitada: o SRS manda vender antes (decisão do jogador, não automática).

## D3 — Base dos 10% = valor da hipoteca (clarificação)

- **Decisão:** valor da hipoteca = `round(price/2)`. Deshipotecar = `round(valor × 1,10)`; taxa de manter na transferência = `round(valor × 0,10)`.
- **Rationale:** clarificação aprovada (padrão Monopoly — juros sobre o emprestado).
- **Alternativas:** 10% sobre o preço cheio — rejeitada pela clarificação.

## D4 — Regra de transferência como helpers puros (gatilho deferido)

- **Decisão:** expor `unmortgageCost(square)` e `transferKeepFee(square)` como funções puras; o **gatilho** (negociação/falência) chama-as quando uma hipotecada muda de dono. Esta spec não implementa trade/falência.
- **Rationale:** mantém a regra/taxa num só lugar, pronta para as specs que disparam a transferência.
- **Alternativas:** implementar a transferência agora — rejeitada: invade Negociação/Falência.

## D5 — Comandos puros com no-op em inválido

- **Decisão:** `mortgageProperty`/`unmortgageProperty` puras `(state) → state`; no-op se sem posse, já no estado-alvo, com construção, ou sem caixa.
- **Rationale:** consistência com 002–004.

Nenhum `NEEDS CLARIFICATION` pendente (base dos 10% resolvida no clarify).
