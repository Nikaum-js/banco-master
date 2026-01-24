<div align="center">

<img src="public/magnata-logo.svg" alt="Magnata Imobiliário" width="96" height="96" />

# Magnata Imobiliário

</div>

Jogo de tabuleiro imobiliário para até 8 pessoas, online, direto no navegador. Tema "Cidades do Mundo".

[![CI](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/ci.yml/badge.svg)](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/ci.yml)
[![Deploy](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/deploy.yml/badge.svg)](https://github.com/Nikaum-js/magnata-imobiliario/actions/workflows/deploy.yml)

---

## Índice

- [Como uma partida funciona](#como-uma-partida-funciona)
- [As mecânicas](#as-mecânicas)
- [Stack](#stack)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Arquitetura](#arquitetura)
- [Multiplayer](#multiplayer)
- [Testes](#testes)
- [Documentação](#documentação)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)

---

## Como uma partida funciona

Alguém cria uma sala e compartilha o link. Até oito pessoas sentam à mesa. Nada de instalar, nada
de conta.

Quem cria a sala é o **anfitrião**, e é o navegador dele que roda a autoridade da partida: valida
cada jogada, aplica, e conta aos outros o que aconteceu. Os demais são clientes que reproduzem
exatamente o mesmo resultado. Não existe servidor de jogo — o Supabase serve de transporte e de
memória, não de árbitro.

O tabuleiro tem 48 casas: dez países com suas cidades, quatro aeroportos, duas utilidades,
impostos, Acaso, Tesouro, Prisão, Férias e o espaço de Bus Ticket. São 8 jogadores humanos, sem IA
e sem bots.

## As mecânicas

Jogo de tabuleiro imobiliário tem três jeitos clássicos de dar errado, e cada mecânica daqui nasceu
contra um deles.

**O primeiro é o jogador travado.** Quem fica sem território perde o poder de negociar e vira
espectador de uma partida que ainda vai durar horas. Aqui dá para **construir com um país
incompleto** — basta ter uma cidade, e o aluguel escala conforme a posse, de 50% a 100%. Ninguém
depende da boa vontade de um adversário para evoluir. A **Loteria** acumula todo imposto e multa no
centro do tabuleiro e entrega o pote a quem parar nas Férias, o que dá a quem está atrás uma
chance real de virada. E o **Incentivo Fiscal** paga por propriedade hipotecada, ou seja: rende
justamente para quem está mal.

**O segundo é a partida que se decide cedo e não acaba.** Quando restam três terrenos sem dono ou
menos, todos vão a **pregão simultâneo** — 24 segundos por lote, cronômetro à vista. Fecha o
tabuleiro, faz o aluguel circular e apressa o fim. Quando alguém quebra, o **espólio** dele também
vai a pregão em vez de voltar de graça ao banco. E quem simplesmente não quer mais jogar pode
**desistir**, sem precisar estar insolvente para isso.

**O terceiro é a falta de coisa para fazer com dinheiro no fim.** Depois do hotel vêm o **segundo
hotel**, o **arranha-céu** e o **Hangar** nos aeroportos. **Empréstimos entre jogadores** cobram
juros de 10% a 50% a cada passagem pelo GO e vencem em três voltas — quem empresta corre risco de
verdade, com o patrimônio do devedor como garantia.

Por cima disso, 39 cartas em dois baralhos e três raridades. As de mão são **privadas** — os outros
veem só o contador —, não podem ser negociadas, e a mão tem limite de três. Entre elas as
ofensivas: Aquisição Hostil, Confisco Geral, Imposto Federal, Boicote, Permuta Forçada, Embargo de
Obras. Nenhuma pode ser recusada, exceto com uma Diplomacia na mão.

Duas ausências que também são decisões: **não existe timer de turno**, porque cronômetro mata
negociação; e **desconexão não pune** — a partida pausa e espera, sem prazo.

## Stack

| Camada | Escolha |
|---|---|
| UI | React 19 + TypeScript (strict) |
| Build | Vite, multi-página (landing separada do app) |
| Estilo | Tailwind CSS 4 (`@theme`) + CSS custom properties |
| Estado | Zustand |
| Animação | Motion, respeitando `prefers-reduced-motion` |
| Ícones | Lucide |
| Realtime e persistência | Supabase (broadcast, Postgres, RLS) |
| Testes | Vitest + Testing Library + Playwright |
| Monitoramento | Sentry (opcional) |
| Runtime | Bun |
| Hospedagem | Vercel |

## Rodando localmente

Precisa do [Bun](https://bun.sh) — a versão está em `.bun-version`.

```bash
git clone git@github.com:Nikaum-js/magnata-imobiliario.git
cd magnata-imobiliario
bun install
bun run dev
```

Sobe em `http://localhost:5173`:

| Rota | O que é |
|---|---|
| `/` | Landing pública — HTML estático, zero JS de aplicação |
| `/play` | O jogo |
| `/how-to-play` | Guia de regras |
| `/faq` | Perguntas frequentes |

**Dá para jogar sem configurar nada.** `/play?local=1` entrega um cliente único que joga por todos
os assentos — é assim que se desenvolve e se testa regra. Multiplayer de verdade precisa das
variáveis abaixo. Em desenvolvimento, `?players=2|3|6` escolhe quantos jogadores entram no modo
local.

## Variáveis de ambiente

```bash
cp .env.example .env
```

| Variável | Obrigatória | Para quê |
|---|---|---|
| `VITE_SUPABASE_URL` | só p/ multiplayer | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | só p/ multiplayer | Chave publishable/anon. É pública por design — vai no bundle e é protegida por RLS. Nunca use `service_role` aqui |
| `VITE_SENTRY_DSN` | não | Sem DSN, nenhum código de monitoramento roda |
| `VITE_TELEMETRY` | não | `1` liga a contagem anônima de partidas. Em desenvolvimento nunca envia |

As migrations ficam em [`supabase/migrations/`](supabase/migrations/) — seis, aplicadas em ordem. O
procedimento de operação está no [runbook](docs/RUNBOOK.md).

## Scripts

```bash
bun run dev           # desenvolvimento
bun run build         # typecheck + build de produção
bun run preview       # serve o build, com o 404 real (igual à Vercel)

bun run lint          # ESLint
bun run typecheck     # tsc -b

bun run test          # Vitest em watch
bunx vitest run       # suíte completa, uma vez
bun run test:sim      # lotes headless de simulação
bun run test:e2e      # Playwright

bun run sim:batch     # lote de simulação com relatório
bun run sim:replay    # reproduz uma seed específica
bun run attack        # sonda de segurança contra a autoridade
```

## Arquitetura

A regra do jogo é um motor puro. Nenhum reducer conhece React, rede ou relógio: recebe estado e
contexto, devolve estado novo. É isso que permite rodar a mesma regra no navegador do anfitrião, no
cliente de cada jogador e em milhares de partidas simuladas, sem nenhuma cópia.

```
src/
├─ game/              o motor — puro, serializável, roda em node
│  ├─ turn/           máquina de estados do turno, dados, resolução de casa
│  ├─ economy/        compra, aluguel, construção, hipoteca, leilão, troca, obrigações
│  ├─ cards/          catálogo, saque, efeitos, ofensivas, reação
│  ├─ emprestimos/    empréstimos entre jogadores
│  ├─ falencia/       dívida, falência, desistência, fim de jogo
│  ├─ balancing/      Loteria, bônus de GO
│  ├─ commands.ts     tabela única de despacho e de quem é o ator de cada comando
│  ├─ setup.ts        ponto único de composição (portas, resolvers, RNG, relógio)
│  ├─ theme.ts        fonte única dos valores econômicos
│  └─ ui/             componentes e view-models
├─ net/               transporte, autoridade, cliente, perspectiva, sala
├─ boards/            tabuleiro, tokens, bandeiras, escrituras
├─ marketing/         landing, guia, FAQ (HTML + CSS, sem JS de aplicação)
└─ lib/               dados do tabuleiro, formatação
```

Três regras explicam o resto do código.

**Uma pergunta, uma resposta.** Quando dois lugares precisam concordar, existe uma tabela e dois
consumidores — nunca duas listas. `commands.ts` responde "quem pode fazer isto?" tanto para a
autoridade, que descarta comando de remetente ilegítimo, quanto para a interface, que só oferece o
controle a quem é o ator. Uma segunda lista sairia de sincronia no primeiro comando novo.

**Não-determinismo entra pela porta.** Nenhum reducer chama `Math.random()` ou `Date.now()`. RNG,
relógio e saque de carta são injetados; o anfitrião grava cada valor consumido e o cliente
reproduz os gravados. É o que faz os dois lados convergirem byte a byte.

**Toda mudança de caixa tem causa registrada.** Nenhuma regra move dinheiro em silêncio. Quatro
relatos de bug financeiro do playtest tinham a mesma origem — uma cobrança correta que o jogo não
explicava — e a correção foi tornar o silêncio impossível.

## Multiplayer

O anfitrião valida, aplica e difunde o comando aceito junto com o não-determinismo gravado. Os
clientes são pessimistas: não aplicam nada antes da confirmação, então nunca mostram um estado que
a mesa não viu.

O que isso precisou resolver:

- **Identidade vem do servidor.** Quem envia um comando é quem o Supabase diz que é, não quem o
  cliente afirma ser. Comando em nome de assento alheio é recusado no servidor.
- **Mão de cartas não trafega.** O estado se divide em parte pública, com o comprimento certo e
  `null` no lugar de carta alheia, e parte secreta por assento. Abrir o próprio cliente não revela
  a carta de ninguém.
- **Nada avança sem estar gravado.** Se a gravação falhar de forma persistente, a partida pausa em
  vez de seguir sobre um estado que um reload faria regredir.
- **Lacuna de sequência se resolve sozinha.** Quem perde uma difusão detecta o buraco e se
  reconcilia pelo snapshot, com espera crescente.
- **Reentrada por código.** Cada assento tem um código curto que reanexa de qualquer aparelho:
  celular sem bateria, navegador limpo, aba anônima fechada.
- **Desconexão pausa, não pune.** Sem timeout — a mesa espera. Quem já foi eliminado é exceção: a
  ausência dele nunca trava a partida.

## Testes

São 1.211 testes em 139 arquivos, em quatro camadas com propósitos diferentes.

Os **unitários** (`tests/game`) cobrem cada regra do SRS isolada, e a exaustividade é imposta pelo
tipo: um evento de log novo sem frase, ícone e som não compila. Os de **rede** (`tests/net`)
verificam o transporte contra um Supabase falso — convergência, anti-spoof, reconexão, pausa,
revanche, privacidade de cartas. O **E2E** (`e2e/`) roda navegador de verdade com 2, 3 e 6
jogadores, mais acessibilidade e fronteira de erro.

A camada mais valiosa é a **simulação** (`tests/sim`): partidas completas com política aleatória e
seed fixa, e cada despacho passa por sete invariantes. Conservação pergunta se o dinheiro fecha, e
recomputa cada mecanismo de forma independente. Narração pergunta se todo jogador com mudança de
caixa foi nomeado por algum fato daquele mesmo despacho. Não-truncagem verifica que nenhuma
obrigação entre jogadores foi apagada no caminho. Convergência aplica o comando pelos dois lados,
anfitrião e cliente, e compara. Os outros três olham estrutura, ação inválida e terminação — se a
partida travar, o teto estoura e o teste falha.

Vale registrar a lição que produziu metade desses invariantes: **conservação e explicabilidade são
propriedades diferentes.** A suíte verificava a primeira e passava em milhares de partidas enquanto
quatro bugs financeiros chegavam do playtest. O dinheiro fechava; ninguém conseguia explicar por
quê. Pior: um dos oráculos calculava o valor esperado copiando a fórmula do próprio reducer, o que
não é independência — é a mesma afirmação escrita duas vezes, e ela concorda consigo mesma para
sempre.

```bash
bunx vitest run        # tudo
bun run test:sim       # só a simulação
bun run test:e2e       # só o navegador
```

## Documentação

O repositório é spec-driven, com [GitHub Spec Kit](https://github.com/github/spec-kit): 51 specs e
67 decisões registradas. Cada camada tem um papel, sem sobreposição.

| Camada | Onde | O que é |
|---|---|---|
| Princípios | [`constitution.md`](.specify/memory/constitution.md) | Os sete princípios não-negociáveis |
| Regra | [`docs/SRS.md`](docs/SRS.md) | Fonte de verdade do comportamento |
| Vocabulário | [`CONTEXT.md`](CONTEXT.md) | Glossário do domínio: os nomes, nunca a regra |
| Decisões | [`docs/adr/`](docs/adr/README.md) | Uma por decisão, id estável, com o custo aceito |
| Produto | [`PRD`](docs/PRD.md) · [`marcos`](docs/MILESTONES.md) | Requisitos e planejamento |
| Design | [`DESIGN.md`](DESIGN.md) | O sistema visual "Atlas da Meia-Noite" |
| Operação | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Migrations, secrets, deploy, incidentes |
| Feature | [`specs/`](specs/) | Spec, plan, tasks e contratos de cada fatia |

Não existe um `ARCHITECTURE.md` global, e isso é de propósito: entidades, invariantes técnicas e
design detalhado vivem no `plan.md` da própria feature. Regra nunca nasce numa spec — comportamento
que contrarie o SRS exige uma decisão registrada e bump do SRS antes de virar requisito.

As decisões registram o custo, não só a escolha. Quando o pregão de terrenos foi removido, a
decisão media o preço: 292 propriedades a mais paradas com o banco em mesas de três, 768 em mesas
de seis. Quando ele voltou, a decisão nova explicou por que o remédio anterior tratava o sintoma
errado. Decisão sem custo declarado é decisão que ninguém consegue revisar depois.

## Deploy

Roda na Vercel, e o auto-deploy nativo em `main` está **desligado** por
[`vercel.json`](vercel.json). Produção é promovida pelo workflow
[`deploy.yml`](.github/workflows/deploy.yml), e só depois de o CI fechar verde.

O [CI](.github/workflows/ci.yml) roda em jobs paralelos: lint, tipos, testes e build; lote de
simulação seedada; smoke de navegador com 2, 3 e 6 jogadores; acessibilidade sobre o build; e uma
partida semeada até o fim de jogo.

## Contribuindo

O fluxo por feature é `/speckit-specify → clarify → plan → tasks → implement`. Antes de abrir uma
spec, a leitura obrigatória é: constitution, SRS (busca pelo termo da feature), decisões
relacionadas e specs com dependência.

- Commits em inglês, emoji + conventional commits (`✨ feat(scope): …`).
- Bun sempre — `bun.lock` é o lockfile do projeto.
- Produto e documentação em português. Rotas e commits em inglês.
- Evento de log, comando ou efeito de carta novo não passa sem tratamento exaustivo. O TypeScript
  recusa antes do teste.
