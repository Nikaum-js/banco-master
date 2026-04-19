# Research: Progressão de construção por posse

## Decisão 1 — Teto parcial derivado da posse

**Decision**: enquanto o país estiver incompleto, o nível máximo é igual ao número de cidades possuídas; país completo libera o nível 7.

**Rationale**: reproduz literalmente a regra aprovada e garante monotonicidade de oportunidade: adquirir mais cidades nunca reduz o teto disponível.

**Alternatives considered**:

- Manter a uniformidade apenas entre cidades possuídas: rejeitado porque uma única cidade continuaria chegando ao segundo hotel.
- Exigir país completo para qualquer construção: rejeitado por violar o princípio V.
- Remover uniformidade: rejeitado porque permitiria concentração integral em uma cidade e mudaria uma regra não solicitada.

## Decisão 2 — Fonte única para motor e interface

**Decision**: o cálculo do teto vive no módulo de construção e é reutilizado pela projeção da gestão.

**Rationale**: o comando precisa continuar autoritativo; a interface deve explicar exatamente a mesma restrição sem reimplementar a fórmula.

**Alternatives considered**:

- Calcular o teto separadamente no motor e na interface: rejeitado por risco de drift.
- Persistir o teto no `GameState`: rejeitado porque é derivável de posse e tamanho do país.

## Decisão 3 — Compatibilidade não destrutiva

**Decision**: snapshots com construção acima do novo teto permanecem válidos; o novo gate bloqueia somente progressões futuras.

**Rationale**: rebaixar ou reembolsar automaticamente alteraria partidas em andamento, exigiria migration e violaria a resiliência da sessão.

**Alternatives considered**:

- Rebaixar e reembolsar ao carregar: rejeitado por mutar economia histórica e introduzir resultado inesperado.
- Invalidar snapshots antigos: rejeitado por quebrar reconexão.

## Decisão 4 — Ordem dos bloqueios

**Decision**: hipoteca e topo continuam prioritários; uniformidade é avaliada antes do teto; o teto é avaliado antes de caixa. A tentativa de Skyscraper em estado legado parcial mantém a razão específica de país incompleto.

**Rationale**: a mensagem deve indicar a primeira ação estrutural que o jogador consegue corrigir. Caixa não resolve um teto de posse, e construir na cidade defasada resolve uniformidade antes de ampliar a posse.

**Alternatives considered**:

- Mostrar sempre caixa primeiro: rejeitado porque esconderia um bloqueio que continuaria após obter dinheiro.
- Colapsar todos os bloqueios parciais em uma mensagem: rejeitado porque uniformidade e posse exigem ações diferentes.
