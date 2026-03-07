# D-049 — Toda construção deve ser vendida antes da hipoteca

**Data:** 2026-07-28 · **Status:** aceita

**Refina:** SRS §6.1 e §13.6.

**Decisão:** nenhum título pode ser hipotecado enquanto houver construção vinculada a ele. Cidades continuam exigindo a venda de todas as casas, hotéis e arranha-céus do grupo antes da hipoteca. Aeroportos passam a exigir a venda do próprio Hangar antes da hipoteca.

**Por quê:** a hipoteca representa o valor do terreno sem melhorias. Permitir que o Hangar acompanhasse um aeroporto hipotecado contrariava a regra geral de liquidação das construções, mantinha valor ativo em um título sem aluguel e criava tratamento excepcional sem benefício de jogo.

**Como aplicar:** a validação central de hipoteca deve rejeitar cidades cujo grupo contenha qualquer nível de construção e aeroportos com Hangar. A interface deriva a disponibilidade dessa mesma validação; comandos diretos e remotos não podem contorná-la.
