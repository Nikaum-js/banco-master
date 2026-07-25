# D-026 — Construção com país parcial + aluguel escalonado por posse

**Data:** 2026-05-27 · **Status:** aceita (revisa [D-004](D-004-construcao-com-grupo-parcial.md))
**Decisão:** Construir casas/hotéis NÃO exige mais a maioria do país — basta possuir a cidade (≥1). O aluguel construído deixa de ser 70%/100% binário e passa a escalar pela posse: `fator = 0,5 + 0,5 × (cidades que possui − 1) / (tamanho do país − 1)` — trio 1/3=50% · 2/3=75% · 3/3=100%; duo 1/2=50% · 2/2=100%. **Arranha-céu** segue exigindo país completo (fator sempre 1,0). Aluguel **sem** construção mantém o set bonus (base/150%/200%, §5.1).
**Por quê:** destrava o "jogador parado" (constrói cedo com 1 cidade) sem desbalancear — completar o país **dobra** o aluguel construído, mantendo forte o incentivo de fechar o grupo via trade. Mais granular e justo que o degrau único de 70%.
**Como aplicar:** `rent.ts` (`posseFactor` + ramo construído de `rentCity`), `construction.ts` (remove trava de maioria em `canBuild`), `deedView.ts`/`shared.tsx` (remove razão/mensagem `'maioria'`). SRS §5.1/§5.2/§13.3 atualizados. Spec 034.
