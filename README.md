<div align="center">

<img src="public/magnata-logo.svg" alt="Magnata Imobiliário" width="96" height="96" />

# Magnata Imobiliário

**Jogo de tabuleiro imobiliário multiplayer, online, para até 8 pessoas — direto no navegador, sem instalar nada.**

Clone web do gênero Monopoly/[Richup.io](https://richup.io), tema "Cidades do Mundo".
Sem IA, sem bots: só gente.

[![CI](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/ci.yml/badge.svg)](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/ci.yml)
[![Deploy](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/deploy.yml/badge.svg)](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/deploy.yml)

</div>

---

## Índice

- [O que é](#o-que-é)
- [O que tem de diferente](#o-que-tem-de-diferente)
- [Stack](#stack)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Arquitetura](#arquitetura)
- [Multiplayer: como a partida se mantém em pé](#multiplayer-como-a-partida-se-mantém-em-pé)
- [Testes](#testes)
- [Documentação](#documentação)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)

---

## O que é

Uma partida acontece assim: alguém cria uma sala, compartilha o link, e até **8 jogadores** sentam
à mesa. O **anfitrião** roda a autoridade da partida no próprio navegador; os demais são clientes
que recebem os comandos aceitos e reproduzem o mesmo resultado. Não existe servidor de jogo — o
Supabase entra como **transporte e persistência**, não como árbitro.

O tabuleiro tem **48 casas**: 10 países com cidades, 4 aeroportos, 2 utilidades, impostos, Acaso,
Tesouro, Prisão, Férias e o espaço de Bus Ticket.

## O que tem de diferente

O Monopoly clássico tem problemas estruturais conhecidos: quem joga primeiro chega antes às
propriedades, construção exige país completo (então um jogador não-cooperativo trava todos), quem
perde os territórios fica funcionalmente eliminado mas continua na mesa, e o resultado se decide
nos primeiros 15 minutos enquanto a partida dura horas. Cada mecânica abaixo existe contra um
desses problemas — e cada uma tem uma decisão registrada dizendo por quê.

| Mecânica | O que faz |
|---|---|
| **Construção com país parcial** | Constrói com 1 cidade só; o aluguel escala pela posse (50%→100%). Ninguém trava ninguém. |
| **Loteria (Férias)** | Impostos e multas acumulam no centro. Quem para nas Férias leva o pote. |
| **Ritual de Largada** | O anfitrião escolhe: leilão secreto (que financia a Loteria) ou maior dado, rolado à vista da mesa. |
| **Empréstimos entre jogadores** | Juros de 10–50% cobrados a cada passagem pelo GO; vencem em 3 voltas. Quem empresta assume risco real. |
| **Pregão de terrenos** | Quando restam ≤3 terrenos sem dono, todos vão a leilão simultâneo — 24s por lote, cronômetro visível. Fecha o tabuleiro e acelera o fim. |
| **Espólio do falido** | O patrimônio de quem quebra vai a pregão em vez de voltar de graça ao banco. |
| **Cartas com raridade** | 39 cartas em 2 baralhos, 3 raridades. Cartas de mão são **privadas**, não-negociáveis, limite de 3. |
| **Cartas ofensivas** | Aquisição Hostil, Confisco Geral, Imposto Federal, Boicote, Permuta Forçada, Embargo de Obras — e a Diplomacia para reagir. |
| **Hangar, 2º hotel, arranha-céu** | Degraus de construção além do hotel, para o dinheiro tardio ter onde ir. |
| **Bus Tickets** | Item de mão separado das cartas: pula para outra casa do mesmo lado do tabuleiro. Negociável. |
| **Desistência** | Sai da partida por vontade própria, sem precisar estar insolvente. |
| **Dívida com devedor nomeado** | Cobrança entre jogadores nunca é truncada: o que falta fica devido, e o devedor liquida — mesmo fora da vez dele. |

E duas ausências deliberadas: **não há timer de turno** (mataria a negociação) e **desconexão não
pune** — a partida pausa e espera.

## Stack

| Camada | Escolha |
|---|---|
| UI | **React 19** + **TypeScript** (strict) |
| Build | **Vite** (multi-página: landing + app) |
| Estilo | **Tailwind CSS 4** (`@theme`), CSS custom properties |
| Estado | **Zustand** |
| Animação | **Motion**, com `prefers-reduced-motion` respeitado |
| Ícones | **Lucide** |
| Realtime + persistência | **Supabase** (Realtime broadcast, Postgres, RLS) |
| Testes | **Vitest** + Testing Library + **Playwright** |
| Monitoramento | **Sentry** (opcional) |
| Runtime/gerenciador | **Bun** |
| Hospedagem | **Vercel** |

## Rodando localmente

Requer [Bun](https://bun.sh) (versão em `.bun-version`).

```bash
git clone git@github.com:Nikaum-js/magnata-imobiliario.git
cd magnata-imobiliario
bun install
bun run dev
```

Abre em `http://localhost:5173`. As rotas:

| Rota | O que é |
|---|---|
| `/` | Landing pública (HTML estático, zero JS de aplicação) |
| `/play` | O jogo |
| `/how-to-play` | Guia de regras |
| `/faq` | Perguntas frequentes |

**Sem configurar o Supabase o jogo roda**, em modo local: `/play?local=1` entrega um cliente único
que joga por todos os assentos — é assim que se desenvolve e se testa a regra. Multiplayer de
verdade precisa das variáveis abaixo.

Atalho útil em desenvolvimento: `?players=2|3|6` escolhe a contagem de jogadores no modo local.

## Variáveis de ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Para quê |
|---|---|---|
| `VITE_SUPABASE_URL` | só p/ multiplayer | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | só p/ multiplayer | Chave **publishable/anon**. É pública por design (vai no bundle, protegida por RLS) — **nunca** use `service_role` aqui |
| `VITE_SENTRY_DSN` | não | Sem DSN, nenhum código de monitoramento roda |
| `VITE_TELEMETRY` | não | `1` liga a contagem anônima de partidas. Em desenvolvimento nunca envia |

As migrations do banco vivem em [`supabase/migrations/`](supabase/migrations/) — seis, aplicadas em
ordem. O procedimento de operação está no [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Scripts

```bash
bun run dev           # servidor de desenvolvimento
bun run build         # typecheck + build de produção
bun run preview       # serve o build (com o 404 real, igual à Vercel)

bun run lint          # ESLint
bun run typecheck     # tsc -b

bun run test          # Vitest em watch
bunx vitest run       # suíte completa, uma vez
bun run test:sim      # lotes headless de simulação (2/3/6 jogadores)
bun run test:e2e      # Playwright

bun run sim:batch     # lote de simulação com relatório
bun run sim:replay    # reproduz uma seed específica
bun run attack        # sonda de segurança contra a autoridade
```

## Arquitetura

A regra do jogo é um **motor puro**. Nenhum reducer conhece React, rede ou relógio: recebe estado
e contexto, devolve estado novo. É isso que permite rodar a mesma regra no navegador do anfitrião,
no cliente de cada jogador e em milhares de partidas simuladas — sem nenhuma cópia.

```
src/
├─ game/              O MOTOR — puro, serializável, testável em node
│  ├─ turn/           máquina de estados do turno, dados, resolução de casa
│  ├─ economy/        compra, aluguel, construção, hipoteca, leilão, troca, obrigações
│  ├─ cards/          catálogo, saque, efeitos, ofensivas, reação
│  ├─ emprestimos/    empréstimos entre jogadores
│  ├─ falencia/       dívida, falência, desistência, fim de jogo
│  ├─ balancing/      Loteria, bônus de GO
│  ├─ commands.ts     TABELA ÚNICA de despacho e de "quem é o ator de cada comando"
│  ├─ setup.ts        PONTO ÚNICO de composição (portas, resolvers, RNG, relógio)
│  ├─ theme.ts        FONTE ÚNICA dos valores econômicos
│  └─ ui/             componentes e view-models (puros, testáveis sem montar React)
├─ net/               transporte, autoridade do anfitrião, cliente, perspectiva, sala
├─ boards/            tabuleiro, tokens, bandeiras, escrituras
├─ marketing/         landing, guia, FAQ (HTML + CSS, sem JS de aplicação)
└─ lib/               dados do tabuleiro, formatação
```

Três invariantes que explicam o resto do código:

**1. Uma pergunta, uma resposta.** Quando dois lugares precisam concordar, existe uma tabela e dois
consumidores — nunca duas listas. `commands.ts` responde "quem pode fazer isto?" tanto para a
autoridade (que descarta comando de remetente ilegítimo) quanto para a interface (que só oferece o
controle a quem é o ator). Uma segunda lista sairia de sincronia no primeiro comando novo.

**2. Não-determinismo entra pela porta.** Nenhum reducer chama `Math.random()` ou `Date.now()`. RNG,
relógio e saque de carta são injetados; o anfitrião **grava** cada valor consumido e o cliente
**reproduz** os gravados. É isso que faz host e clientes convergirem byte a byte.

**3. Toda mudança de caixa tem causa registrada.** Nenhuma regra move dinheiro em silêncio. Quatro
relatos de bug financeiro do playtest tinham a mesma origem — uma cobrança correta que o jogo não
explicava — e o remédio foi tornar o silêncio impossível.

## Multiplayer: como a partida se mantém em pé

O anfitrião é a **autoridade**: valida cada comando, aplica, e difunde o comando *aceito* com o
não-determinismo gravado. Os clientes são **pessimistas** — não aplicam nada antes da confirmação,
então nunca mostram um estado que a mesa não viu.

O que isso precisou resolver, e resolve:

- **Identidade atestada pelo servidor.** Quem envia um comando é quem o Supabase diz que é, não
  quem o cliente afirma ser. Comando em nome de assento alheio é recusado no servidor.
- **Mão de cartas não trafega.** O estado é dividido em parte pública (com o comprimento certo e
  `null` no lugar de carta alheia) e parte secreta por assento. Inspecionar o próprio cliente não
  revela a carta de ninguém.
- **Durabilidade antes do avanço.** Nenhum comando aceito avança a partida sem estar gravado; se a
  gravação falhar de forma persistente, a partida **pausa** em vez de seguir sobre um estado que um
  reload faria regredir.
- **Lacuna de sequência se recupera sozinha.** O cliente que perde uma difusão detecta o buraco e
  se reconcilia pelo snapshot, com espera crescente.
- **Reentrada por código.** Cada assento tem um código curto que reanexa de qualquer aparelho —
  celular sem bateria, navegador limpo, aba anônima encerrada.
- **Desconexão pausa, não pune.** Sem timeout: a mesa espera. Quem já foi eliminado é exceção — a
  ausência dele nunca trava a partida.

## Testes

**1.211 testes** em 139 arquivos, em quatro camadas com propósitos diferentes:

```bash
bunx vitest run        # tudo
bun run test:sim       # só os lotes de simulação
bun run test:e2e       # só o smoke de navegador
```

| Camada | O que prova |
|---|---|
| **Unitários** (`tests/game`) | Cada regra do SRS, isolada. Exaustividade por tipo: um `LogKind` novo sem frase, ícone e som **não compila**. |
| **Rede** (`tests/net`) | Conformidade do transporte contra um Supabase falso, convergência, anti-spoof, reconexão, pausa, revanche, perspectiva de cartas. |
| **Simulação** (`tests/sim`) | Partidas completas de 2/3/6 jogadores, com política aleatória e seed fixa, contra sete invariantes. |
| **E2E** (`e2e/`) | Smoke real de navegador em 2/3/6 jogadores, acessibilidade e fronteira de erro. |

A simulação é o instrumento mais valioso do repositório e vale explicar. Cada despacho é verificado
contra:

| Invariante | Pergunta que responde |
|---|---|
| **Conservação** | O dinheiro fecha? Cada mecanismo é recomputado de forma independente. |
| **Narração** | Todo jogador com Δcaixa é **nomeado** por um fato do mesmo despacho? |
| **Não-truncagem** | Nenhuma obrigação a jogador foi apagada no caminho? |
| **Convergência** | Host e cliente chegam ao mesmo estado, byte a byte? |
| **Estrutura** | Ladder de construção, posse, mão e fila de obrigações bem-formadas. |
| **Ação inválida** | Comando ilegal é sempre no-op? Sondado a cada turno. |
| **Terminação** | A partida acaba? Deadlock estoura o teto e falha. |

> A lição que produziu metade desses invariantes: **conservação e explicabilidade são propriedades
> diferentes.** A suíte verificava a primeira e passava em milhares de partidas enquanto quatro bugs
> financeiros chegavam do playtest — o dinheiro fechava, e ninguém conseguia explicar por quê. Pior,
> um dos oráculos recomputava o esperado copiando a fórmula do próprio reducer, o que não é
> independência: é a mesma afirmação escrita duas vezes, e ela concorda consigo mesma para sempre.

## Documentação

O repositório é **spec-driven** ([GitHub Spec Kit](https://github.com/github/spec-kit)):
**51 specs**, **67 decisões** registradas. A hierarquia é deliberada e não tem sobreposição.

| Camada | Onde | O que é |
|---|---|---|
| **Princípios** | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Os 7 princípios não-negociáveis |
| **Regra** | [`docs/SRS.md`](docs/SRS.md) | Fonte de verdade absoluta do comportamento |
| **Vocabulário** | [`CONTEXT.md`](CONTEXT.md) | Glossário do domínio — os nomes, nunca a regra |
| **Decisões** | [`docs/adr/`](docs/adr/README.md) | Uma ADR por decisão, id `D-0xx` estável, com o custo aceito |
| **Produto** | [`docs/PRD.md`](docs/PRD.md) · [`docs/MILESTONES.md`](docs/MILESTONES.md) | Requisitos e marcos |
| **Design** | [`DESIGN.md`](DESIGN.md) | Sistema visual "Atlas da Meia-Noite" |
| **Operação** | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Migrations, secrets, deploy, incidentes |
| **Feature** | [`specs/<nome>/`](specs/) | spec, plan, tasks e contratos de cada fatia |

Não existe, de propósito, um `ARCHITECTURE.md` ou `ROADMAP.md` global: entidades, invariantes
técnicas e design detalhado vivem no `plan.md` da própria feature. **Regra nunca nasce numa spec** —
comportamento que contrarie o SRS exige ADR e bump do SRS *antes* de virar requisito.

Uma ADR aqui registra o custo, não só a escolha. Quando o pregão de terrenos foi removido, a
decisão media o preço (`+292` propriedades paradas em mesas de 3, `+768` em mesas de 6); quando foi
restaurado, a nova decisão explicou por que o remédio anterior tratava o sintoma errado. Decisão sem
custo declarado é decisão que ninguém consegue revisar depois.

## Deploy

Hospedado na **Vercel**. O auto-deploy nativo em `main` está **desligado** por
[`vercel.json`](vercel.json): produção é promovida pelo workflow
[`deploy.yml`](.github/workflows/deploy.yml) **só depois de o CI fechar verde**. Deploy que não
passou pelo gate não existe.

O CI ([`ci.yml`](.github/workflows/ci.yml)) roda em três jobs paralelos: lint + tipos + testes +
build; lote de simulação seedada; e smoke E2E de 2/3/6 jogadores.

## Contribuindo

O fluxo por feature é `/speckit-specify → clarify → plan → tasks → implement`. Antes de abrir uma
spec, a leitura obrigatória é: constitution → SRS (busca pelo termo da feature) → ADRs relacionadas
→ specs com dependência.

Convenções que a suíte e os hooks cobram:

- **Commits em inglês**, padrão emoji + conventional commits (`✨ feat(scope): …`).
- **Bun**, sempre — o `bun.lock` é o lockfile do projeto.
- Idioma do produto e da documentação: **português (Brasil)**. Rotas e commits em inglês.
- Nenhum `LogKind`, comando ou efeito de carta novo passa sem tratamento exaustivo — o TypeScript
  recusa antes do teste.

---

<div align="center">
<sub>Feito com atenção desproporcional aos detalhes.</sub>
</div>
