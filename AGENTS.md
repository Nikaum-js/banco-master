# Banco Master — Manual de bordo do Codex

> Carregado automaticamente em todo chat novo. Leia primeiro.
> Este projeto usa **GitHub Spec Kit** para Spec-Driven Development.

---

## 1. O que é o projeto

Clone web multiplayer do **Richup.io** (Monopoly online), até 8 jogadores humanos, sem IA.
Tema inicial: "Cidades do Mundo". Base extensível para outros temas no futuro.

## 2. Fase atual

**Lançamento (M4).** As specs 001–045 estão implementadas e integradas ao `main`: motor fechado, multiplayer vivo sobre o Supabase, fronteira de erro, identidade de transporte atestada pelo servidor (043), o polimento de lançamento (044 — fim de jogo com classificação, acessibilidade AA no caminho de jogo, paisagem em tablet/celular, telemetria anônima, gates de CI e deploy na Vercel) e o Ritual de Largada configurável pelo host (045).

**A operação de lançamento está concluída** (atualizada em 2026-07-28): as **cinco** migrations estão aplicadas no projeto de produção, os secrets da Vercel (`VERCEL_TOKEN`/`ORG_ID`/`PROJECT_ID`) estão no repo, e o `deploy.yml` promove produção **só** depois do CI fechar verde (D-041) — o auto-deploy nativo em `main` está desligado por `vercel.json`. O [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) continua valendo como procedimento de operação, não como pendência.

Comportamento esperado:

- **Clarificar ambiguidade nova antes de codar** — mas não travar implementação já autorizada.
- **Regra nunca nasce numa spec**: comportamento novo que contrarie ou refine o SRS exige ADR em `docs/adr/README.md` (e bump do SRS) **antes** de virar requisito. Foi assim com D-029/D-030 na 038.
- O ciclo por feature é `/speckit-specify → clarify → plan → tasks → implement` e roda **encadeado, sem pedir permissão a cada etapa** — uma vez que a feature está autorizada, siga até o fim. Pare apenas em ambiguidade que mude o resultado do trabalho (aí pergunte tudo de uma vez).

## 3. Stack

React + Vite + TypeScript + Tailwind + Zustand + Supabase (realtime + persistência).
O design técnico detalhado de cada feature vive no `plan.md` da própria spec (gerado por `/speckit-plan`).

## 4. Hierarquia de documentação

| Camada | Arquivo | O que é | Quando ler |
|---|---|---|---|
| **Princípios** | [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) | Princípios não-negociáveis do projeto (I a VII) | **Sempre, antes de qualquer spec** |
| **Verdade de negócio** | [`docs/SRS.md`](./docs/SRS.md) | Fonte de verdade absoluta das regras | **Sempre, antes de qualquer spec** (grep pela feature) |
| **Vocabulário** | [`CONTEXT.md`](./CONTEXT.md) | Glossário do domínio — só os nomes, nunca a regra | **Sempre, antes de qualquer spec** (e ao nomear qualquer coisa nova) |
| **Decisões** | [`docs/adr/`](./docs/adr/README.md) | ADR — um arquivo por decisão, id `D-0xx` estável | **Sempre, antes de qualquer spec** (verificar decisões relacionadas) |
| **Cartas** | [`docs/CARTAS.md`](./docs/CARTAS.md) | Catálogo detalhado (rascunho de discovery) | Ao mexer em cartas — migrará pra uma spec |
| **Guia Spec Kit** | [`docs/SPEC-KIT.md`](./docs/SPEC-KIT.md) | Manual de uso do Spec Kit (para o Nikolas) | Quando o usuário tiver dúvida de como usar |
| **Specs** | [`specs/<feature>/`](./specs/) | Uma pasta por feature, criada pelo Spec Kit | Ao trabalhar numa feature |

> **Nota arquitetural:** intencionalmente NÃO existe um `CORE.md`, `ROADMAP.md` ou `ARCHITECTURE.md` global. Entidades, invariantes técnicas, constantes, status e design técnico vivem nas próprias specs/feature. As únicas referências transversais são o **SRS** (a regra), o **`CONTEXT.md`** (os nomes) e os **ADRs** (as decisões) — três papéis distintos, sem sobreposição: se um termo e uma regra discordarem, o SRS ganha e o `CONTEXT.md` é corrigido.

## 5. Comandos do GitHub Spec Kit (fluxo SDD)

Os comandos abaixo estão instalados como skills em `.agents/skills/speckit-*`. **Sempre prefira invocá-los** em vez de criar arquivos manualmente.

| Comando | O que faz | Quando usar |
|---|---|---|
| `/speckit-constitution` | Atualiza `.specify/memory/constitution.md` | Quando um princípio do projeto mudar (raro) |
| `/speckit-specify <descrição>` | Cria `specs/<nome>/spec.md` com user stories, acceptance scenarios (Given/When/Then), functional requirements e success criteria | **Início de toda feature nova** |
| `/speckit-clarify` | Faz perguntas estruturadas para desambiguar a spec | Após /speckit-specify, antes de /speckit-plan |
| `/speckit-plan` | Cria `plan.md` com stack, design técnico, estrutura | **Só com confirmação do usuário** — sai da discovery |
| `/speckit-tasks` | Gera `tasks.md` com checklist atômico | Após o plan estar aprovado |
| `/speckit-analyze` | Verifica consistência entre spec, plan e tasks | Antes de implementar |
| `/speckit-checklist` | Gera checklist de qualidade da spec | Validação após o plan |
| `/speckit-implement` | Executa as tasks (gera código) | **Só com confirmação explícita** |

### Regra crítica para o Codex

> **Antes de invocar `/speckit-specify`**, leia obrigatoriamente:
> 1. `.specify/memory/constitution.md` — princípios
> 2. `docs/SRS.md` (busca por termos da feature) — regra de negócio
> 3. `docs/adr/README.md` — decisões relacionadas já tomadas
> 4. Specs existentes em `specs/` que possam ter dependência
>
> Specs nunca inventam regras — operacionalizam o SRS dentro dos princípios do constitution. Entidades, invariantes e constantes técnicas pertencem à própria spec (seção Key Entities + requisitos funcionais), não a um doc global.

### Não usar Spec Kit para:

Setup/tooling (Tailwind, ESLint), operações git (commit/push/PR), instalação de dependências, refactor interno, bug fix simples, mudança de texto/estilo, dúvidas/discussão. Pra isso, é só falar direto. Detalhes na §9 do [`docs/SPEC-KIT.md`](./docs/SPEC-KIT.md).

## 6. Princípios não-negociáveis (resumo)

Detalhe em [`.specify/memory/constitution.md`](./.specify/memory/constitution.md). Em uma linha cada:

- **I.** SRS é verdade absoluta.
- **II.** Discovery antes de código — sem implementar sem spec aprovada.
- **III.** Tesouro precisa impactar — não é "casa de troquinho".
- **IV.** Catch-up é discreto — não destacar na UI.
- **V.** Sem dependência obrigatória de cooperação.
- **VI.** Privacidade estratégica de cartas — privadas, não-negociáveis, limite 3.
- **VII.** Resiliência de sessão — desconexão não pune.

## 7. Decisões rejeitadas — não revisitar sem motivo novo

- Sistema de draft de propriedades — quebra identidade do gênero
- Co-propriedade — complexidade desproporcional
- IA/bots — fora do escopo v1.0
- Modo hotseat — fora do escopo v1.0
- Timer obrigatório de turno — quebra negociações

Detalhe em [`docs/adr/README.md`](docs/adr/README.md).

## 8. Como conversar comigo

- **Idioma:** português (Brasil) em tudo — specs, plans, tasks, discussão.
- **Respostas concisas.** Não resumir o que já está no diff.
- **Não peça permissão etapa por etapa.** Feature autorizada = rodar spec → plan → tasks → implement em sequência, reportando no fim.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
[`specs/046-avatares-finais/plan.md`](./specs/046-avatares-finais/plan.md)
<!-- SPECKIT END -->
