# Research: Avatares finais

## Decisão 1 — Arte canônica no `PlayerFace`

**Decision**: mover as cinco formas finais e as oito skins para catálogos compartilhados consumidos pelo `PlayerFace`; o lobby renderiza esse mesmo componente e trata forma e skin como seletores independentes.

**Rationale**: garante que preview, token e superfícies de identidade nunca divirjam. A skin é uma camada sobre a forma; nenhuma das quarenta combinações precisa de arte duplicada.

**Alternatives considered**:

- Manter SVGs grandes exclusivos do laboratório: rejeitado porque a escolha desapareceria ou exigiria duas artes.
- Adicionar um emblema ao token: rejeitado pela D-044; cria um segundo símbolo em 16–32px.

## Decisão 2 — Avatar e skin públicos e não exclusivos no assento

**Decision**: persistir dois ids fechados no assento, sem validação de unicidade; `normalizeRoom` e `identityOf` aplicam Clássico Vivo e Careca para ausência ou valor inválido.

**Rationale**: avatar e skin são identidade visual pública, não credencial nem regra competitiva. A cor já resolve distinção obrigatória.

**Alternatives considered**:

- Guardar apenas em armazenamento local: rejeitado porque os demais jogadores e a reconexão não veriam a escolha.
- Tornar exclusivo: rejeitado por adicionar corrida e recusa sem benefício.

## Decisão 3 — Compatibilidade sem migration

**Decision**: reutilizar o parâmetro opcional `piece` da RPC existente apenas como envelope de fio versionado e traduzi-lo para `avatar + skin` dentro do adapter. O estado persistido usa os dois campos canônicos; payload antigo contendo só um Avatar normaliza para a skin Careca.

**Rationale**: a função em produção já difunde o valor opcional e o host continua sendo quem valida e grava o assento. Não há mudança de tabela, política ou autoridade.

**Alternatives considered**:

- Criar uma sexta migration apenas para renomear o parâmetro: correta em isolamento, mas operacionalmente desproporcional para um envelope já compatível.
- Persistir a chave `piece`: rejeitado porque ressuscita o vocabulário revogado.

## Decisão 4 — Idle intermitente e lento

**Decision**: ciclos de 7–12 segundos, com gestos concentrados em janelas curtas e maior parte do tempo em repouso. Movimento reduzido desliga todos os idles.

**Rationale**: responde ao feedback de repetição acelerada e evita animação decorativa contínua competindo com o jogo.

**Alternatives considered**:

- Apenas multiplicar todas as durações: rejeitado porque produziria movimento lento constante, ainda estranho.
- Remover toda animação: rejeitado porque olhos e boca em movimento são parte aprovada da personalidade.

## Decisão 5 — Dependências

**Decision**: usar SVG/CSS e o Motion já presente; remover React Spring e Anime.js introduzidos apenas pelo laboratório.

**Rationale**: a versão final precisa funcionar no componente compartilhado de 16–72px. Remover runtimes experimentais reduz bundle e mantém o idle controlado por uma única política de movimento.

**Alternatives considered**:

- Manter os runtimes para uma opção cada: rejeitado porque duplica mecanismos em tokens numerosos sem benefício visual proporcional.
