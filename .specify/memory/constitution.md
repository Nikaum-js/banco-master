# Banco Master Constitution

> Princípios não-negociáveis do projeto. Toda spec, plan e implementação deve respeitar este documento.
> Regras de negócio detalhadas vivem em [`docs/SRS.md`](../../docs/SRS.md); entidades, invariantes e constantes técnicas pertencem à própria spec de cada feature.

## Core Principles

### I. SRS é fonte de verdade absoluta

Toda regra de produto e de negócio nasce do [`docs/SRS.md`](../../docs/SRS.md). Specs não inventam regras — elas operacionalizam o que o SRS define. Quando o SRS não cobrir um detalhe, a referência comportamental é o Richup.io. Discrepância entre spec e SRS é bug da spec, nunca do SRS.

### II. Discovery antes de código (NÃO-NEGOCIÁVEL)

Nenhuma linha de código de produção é escrita antes da spec correspondente estar em status `aprovada`. Em fase de discovery, mesmo a spec só avança após validação/discussão. Pedidos para "implementar direto" devem ser recusados até que a regra esteja consolidada na spec da feature.

### III. Tesouro precisa impactar

O baralho Tesouro **não pode** virar "casa de troquinho" como no Richup.io. A diferença entre Surpresa e Tesouro é **temática** (caótico/ofensivo vs. defensivo/benigno), **nunca de magnitude**. Toda carta nova de Tesouro precisa passar pelo teste: "isso muda a decisão de alguém no turno?" — se a resposta for não, redesenhar.

### IV. Catch-up é discreto

Mecânicas que ajudam quem está em desvantagem (GO Progressivo, Free Parking, Tax Man) devem operar sem destacar na UI que são catch-up. O jogador recebe o valor/benefício sem rótulo de "porque você está perdendo". O design protege a dignidade competitiva.

### V. Sem dependência obrigatória de cooperação

Jogador sem grupos completos ainda precisa ter caminho de progresso. Construção em grupo parcial (70% aluguel) e Propriedade Coringa existem exatamente para isto. Decisões futuras não podem reintroduzir gates absolutos de cooperação (ex.: "só constrói com grupo completo"). Cooperação é alavanca de eficiência, nunca pré-requisito de jogar.

### VI. Privacidade estratégica de cartas

Cartas em mão são **privadas** (outros jogadores veem apenas contador), **não-negociáveis** em propostas, **limite 3 totais** somando os dois decks. Bus Tickets são contador separado. Estes três atributos são alavancas estratégicas — alterá-los exige decisão registrada em [`docs/DECISIONS.md`](../../docs/DECISIONS.md).

### VII. Resiliência de sessão

Desconexão mid-game **pausa** a partida; nenhum jogador perde propriedades por desconectar. Reconexão deve ser sempre possível, sem timer obrigatório. Persistência via Supabase garante que nada se perde. Frustração por queda de internet é falha do produto, não consequência aceitável.

## Estrutura de Conhecimento

Este projeto adota Spec-Driven Development com a seguinte hierarquia de documentos:

- **`docs/SRS.md`** — fonte de verdade absoluta das regras de negócio (única referência transversal)
- **`.specify/memory/constitution.md`** (este arquivo) — princípios não-negociáveis
- **`docs/DECISIONS.md`** — log append-only de decisões aceitas e rejeitadas (ADR)
- **`specs/<feature>/`** — uma pasta por feature contendo `spec.md`, `plan.md`, `tasks.md` (geradas pelo Spec Kit)

Especificamente **não existe** um doc global de entidades/constantes/máquina de estados — isso pertence à própria spec onde a entidade nasce (seção `Key Entities` + `Functional Requirements`). Quando uma spec depende de conceito definido em outra, declarar `Depende de: spec-X` no header.

Specs lêem o constitution e o SRS antes de serem escritas. Se uma spec exigir mudança em princípio, isso é decisão estratégica — registrar em DECISIONS.md primeiro.

## Workflow de Desenvolvimento

O fluxo canônico segue os comandos do GitHub Spec Kit:

1. **`/speckit-specify <descrição>`** — gera `specs/<nome>/spec.md` com user stories priorizadas, acceptance scenarios (Given/When/Then), functional requirements e success criteria
2. **`/speckit-clarify`** (opcional) — desambigua áreas frágeis antes do planejamento
3. **`/speckit-plan`** — gera `plan.md` com stack, design técnico, estrutura
4. **`/speckit-tasks`** — gera `tasks.md` com checklist atômico e paralelizável
5. **`/speckit-analyze`** (opcional) — verifica consistência entre spec, plan e tasks
6. **`/speckit-implement`** — só executar depois que tudo acima estiver alinhado e o usuário aprovar

Em fase de discovery, paramos no passo 1 ou 2. Não avançar para `/speckit-plan` sem confirmação explícita do usuário.

## Decisões Rejeitadas (Não Revisitar)

As seguintes ideias foram descartadas durante discovery. Não propor novamente sem motivo concreto e novo:

- **Sistema de draft** de propriedades no início da partida ([D-R01](../../docs/DECISIONS.md))
- **Co-propriedade** (dois donos para uma mesma propriedade) ([D-R02](../../docs/DECISIONS.md))
- **IA / bots** — fora do escopo da v1.0
- **Modo hotseat** — fora do escopo da v1.0
- **Timer obrigatório de turno** — quebra negociações complexas

## Governance

Esta constitution **substitui** qualquer convenção informal anterior. Toda spec deve declarar conformidade com os princípios I–VII. Conflito entre uma decisão de spec e este documento se resolve em favor do constitution, salvo emenda formal registrada em DECISIONS.md.

Emendas a este documento requerem:

1. Entrada em [`docs/DECISIONS.md`](../../docs/DECISIONS.md) com justificativa
2. Atualização do campo "Last Amended" abaixo
3. Bump de versão (MAJOR para princípios novos/removidos, MINOR para revisões substantivas, PATCH para clarificações)

**Idioma:** todo conteúdo de specs, plans, tasks e documentação em **português (Brasil)**, salvo termos técnicos consagrados em inglês.

**Version**: 1.0.0 | **Ratified**: 2026-05-22 | **Last Amended**: 2026-05-22
