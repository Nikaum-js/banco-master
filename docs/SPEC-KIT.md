# Guia do GitHub Spec Kit — para o Banco Master

> Este documento é pra você (Nikolas) aprender a usar o Spec Kit do zero, no contexto deste projeto.
> Ele não é fonte de verdade do projeto — é manual de uso.

---

## 1. O que é Spec-Driven Development (SDD) em uma analogia

Imagine que você quer construir uma casa.

- **Sem SDD ("vibe coding"):** você vai ao pedreiro e diz "faz uma casa". Ele começa a colocar tijolo. Você vai vendo, opina, ele desfaz, refaz. No final, a casa fica torta e você gastou 3x mais.

- **Com SDD:** você primeiro faz a **planta** (spec), depois o **projeto de engenharia** (plan), depois lista as **etapas de obra** (tasks), e só então o pedreiro coloca tijolo (implement). Cada etapa é discutida e aprovada antes da próxima.

A diferença é simples: **a spec é o contrato**. O código serve a spec, não o contrário. Se a spec mudar, regenera-se o resto.

---

## 2. Por que adotamos isso

Você está construindo um jogo multiplayer com **dezenas de mecânicas que se cruzam** (Speed Die afeta turno, que afeta cartas, que afetam economia, que afeta GO Progressivo...). Sem disciplina, três coisas acontecem:

1. **Inconsistência:** uma feature assume que outra funciona de um jeito, mas a outra mudou.
2. **Retrabalho:** você descobre o problema só quando o código já existe.
3. **Perda de contexto:** abre o projeto em 2 meses e não lembra por que decidiu X.

O Spec Kit não elimina nada disso, mas **te força a pensar antes de codar** — e deixa o "porquê" registrado.

---

## 3. O fluxo completo (visão geral)

```
   ┌──────────────────────┐
   │ /speckit-constitution│   ← você fez isso uma vez, não mexe mais
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  /speckit-specify    │   ← onde COMEÇA toda feature nova
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  /speckit-clarify    │   ← OPCIONAL: pra desambiguar
   └──────────┬───────────┘
              │
              ▼
        ━━━━━━━━━━━━━━━━━  ← fronteira "discovery → código"
                            ⚠️ Hoje estamos AQUI. Não passar sem decidir.
              │
              ▼
   ┌──────────────────────┐
   │   /speckit-plan      │   ← como vamos construir tecnicamente
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │ /speckit-checklist   │   ← OPCIONAL: validar qualidade da spec
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │   /speckit-tasks     │   ← quebra em tarefas atômicas
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  /speckit-analyze    │   ← OPCIONAL: verificar consistência
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │ /speckit-implement   │   ← finalmente, gera código
   └──────────────────────┘
```

**Tradução em humano:**
1. Você descreve a feature → Spec Kit transforma em spec estruturada
2. Tira dúvidas com você
3. Aprovada → Spec Kit faz o plano técnico
4. Plano aprovado → Spec Kit quebra em tarefas
5. Tarefas aprovadas → Spec Kit gera código

Cada passo você revisa e aprova. **Nenhum passo é automático.**

---

## 4. Cada comando, explicado

### 🏛️ `/speckit-constitution`

**O que faz:** atualiza o arquivo de princípios não-negociáveis do projeto em `.specify/memory/constitution.md`.

**Quando usar:** **quase nunca**. Você já fez isso uma vez. Só volta aqui se um princípio fundamental do jogo mudar (ex: decidir que cartas viram públicas — quebra o princípio VI).

**Exemplo de invocação:**
```
/speckit-constitution acrescentar princípio: toda mecânica nova deve ser playtestável em até 15 minutos de partida
```

**O que ele produz:** atualização do `.specify/memory/constitution.md` com o princípio novo numerado, data, e o número de versão bumpado.

---

### ✏️ `/speckit-specify` — **o mais importante**

**O que faz:** cria uma **spec** completa de uma feature em `specs/<nome-curto>/spec.md`.

**Quando usar:** **sempre que for desenhar uma feature nova**. É a porta de entrada do fluxo.

**Exemplo de invocação:**
```
/speckit-specify Speed Die — terceiro dado especial que ativa depois que o jogador completa a primeira volta. Tem faces 1/2/3 que somam ao movimento, face Mr. Banco Master (avança até próxima propriedade disponível), e face Ônibus (escolhe mover só um dos dois dados normais ou a soma). Triple (três dados iguais) move pra qualquer casa.
```

**O que ele produz:** um arquivo `specs/speed-die/spec.md` contendo:

- **User Stories priorizadas:** P1 (essencial), P2 (importante), P3 (nice-to-have)
- **Acceptance Scenarios:** "Dado X, Quando Y, Então Z" — testes em linguagem natural
- **Functional Requirements (FR-001, FR-002...):** o que o sistema **deve** fazer
- **Key Entities:** quais conceitos novos a feature traz
- **Success Criteria (SC-001, SC-002...):** como medir se deu certo
- **Assumptions:** o que está sendo assumido como verdade

**Dica de ouro:** quanto mais contexto você der no comando, melhor a spec. Mas pode dar pouco também — ele vai te perguntar.

---

### ❓ `/speckit-clarify`

**O que faz:** lê a spec atual e te faz perguntas estruturadas pra resolver ambiguidades.

**Quando usar:** logo depois de criar a spec, especialmente se a feature for complexa ou se você não tinha certeza de tudo quando descreveu.

**Exemplo de invocação:**
```
/speckit-clarify
```
(não precisa de argumento — ele já sabe qual spec é a atual)

**O que ele produz:** uma sessão de perguntas estilo:

> ❓ **Q1:** Quando o jogador tira a face Mr. Banco Master, ele compra a propriedade automaticamente ou tem opção de recusar (e ir a leilão)?
>
> ❓ **Q2:** Se o jogador está preso, o Speed Die é rolado mesmo assim?

E atualiza a spec com suas respostas.

**Por que importa:** ambiguidades não-resolvidas viram bugs depois. Melhor descobrir agora que o jogo não decide direito o que fazer com X.

---

### 📐 `/speckit-plan`

**O que faz:** transforma a spec aprovada num **plano técnico** em `specs/<feature>/plan.md`.

**Quando usar:** **só quando você decidiu sair de discovery e partir pro código.** Hoje estamos parados ANTES dessa linha.

**Exemplo de invocação:**
```
/speckit-plan
```

**O que ele produz:** um arquivo `plan.md` com:

- Tecnologias específicas a usar (React component X, store Zustand Y, tabela Supabase Z)
- Estrutura de arquivos a criar
- Modelos de dados
- Sequência de execução técnica

**Importante:** o plan é onde se decide **como**, não **o que**. Se durante o plan você descobre que falta algo no "o que", **volte pra spec**.

---

### ✅ `/speckit-checklist`

**O que faz:** gera um checklist pra validar se a spec/plan está completa o suficiente pra implementação.

**Quando usar:** opcional, depois do plan. Útil quando a feature é grande.

**Exemplo:**
```
/speckit-checklist
```

**O que ele produz:** uma lista do tipo:

> - [ ] Spec define todos os edge cases?
> - [ ] Plan especifica tecnologias concretas (não "alguma biblioteca de drag&drop")?
> - [ ] Todas as user stories têm acceptance scenarios?

---

### 📋 `/speckit-tasks`

**O que faz:** quebra o plan em **tarefas atômicas e paralelizáveis** em `specs/<feature>/tasks.md`.

**Quando usar:** depois do plan aprovado, antes de implementar.

**Exemplo:**
```
/speckit-tasks
```

**O que ele produz:** uma lista numerada tipo:

> - [ ] T-001: Criar tipo `SpeedDieFace` em `src/types/dice.ts`
> - [ ] T-002: Adicionar `hasCompletedLap` no store de Player
> - [ ] T-003: Componente `SpeedDieDisplay.tsx` com 6 faces
> - [ ] T-004: Lógica de "Mr. Banco Master" — função `findNextAvailableProperty()`

Cada tarefa é pequena, testável, e pode ser feita independente das outras (quando possível).

---

### 🔍 `/speckit-analyze`

**O que faz:** lê spec + plan + tasks e verifica se estão **consistentes** entre si.

**Quando usar:** antes de invocar `/speckit-implement`, especialmente se você passou tempo entre os passos.

**Exemplo:**
```
/speckit-analyze
```

**O que ele produz:** um relatório do tipo:

> ⚠️ **Inconsistência:** FR-007 da spec menciona "leilão de Hangar" mas o plan não cobre essa lógica. Tasks também não inclui.

Ou:

> ✅ Tudo coerente. Pronto pra implementar.

---

### 🚀 `/speckit-implement`

**O que faz:** o agente **executa as tarefas** uma a uma, escrevendo código de verdade.

**Quando usar:** **só depois que tudo acima estiver aprovado por você.**

**Exemplo:**
```
/speckit-implement
```

**O que ele produz:** arquivos `.ts`, `.tsx`, etc., conforme as tasks.

**⚠️ Cuidado:** este é o único comando que altera código de produção. Não invoque por engano.

---

### 📤 `/speckit-taskstoissues`

**O que faz:** converte o `tasks.md` em **issues do GitHub** (uma issue por task).

**Quando usar:** se você quiser rastrear o trabalho em board do GitHub. Opcional. Como você está sozinho no projeto, provavelmente vai ignorar esse.

---

## 5. Onde estamos AGORA no fluxo

```
✅ Constitution criado e populado (princípios I a VII)
❌ Nenhuma spec criada ainda
⏸️ Tudo depois disso (plan/tasks/implement) está esperando
```

**Fase atual: discovery.** A regra é:

> Você pode usar `/speckit-specify` e `/speckit-clarify` à vontade.
> **NÃO usar** `/speckit-plan`, `/speckit-tasks`, `/speckit-implement` sem decisão explícita de sair da fase de design.

---

## 6. Anatomia de uma spec — o que esperar ver

Quando você invocar `/speckit-specify`, o arquivo gerado terá esta estrutura:

```markdown
# Feature Specification: <Nome>

**Status:** Draft
**Created:** 2026-05-22

## User Scenarios & Testing

### User Story 1 — <Título> (Priority: P1)
[descrição]
**Acceptance Scenarios:**
1. Given <estado inicial>, When <ação>, Then <resultado>

### User Story 2 — ... (Priority: P2)
...

### Edge Cases
- O que acontece se X?
- E se Y der errado?

## Requirements

### Functional Requirements
- **FR-001:** O sistema DEVE permitir...
- **FR-002:** Jogadores DEVEM poder...

### Key Entities
- **SpeedDie:** dado especial com 6 faces...

## Success Criteria
- **SC-001:** Mr. Banco Master é acionado em pelo menos 30% das rolagens pós-1ª volta
- **SC-002:** Tempo de decisão na face Ônibus < 5 segundos

## Assumptions
- O Speed Die não é usado na rolagem de ordem inicial
- ...
```

### Decifrando os códigos

| Sigla | Significado | Exemplo |
|---|---|---|
| **P1, P2, P3** | Prioridade — P1 é essencial pra ter MVP | "Speed Die rolando" é P1, "Triple = pular pra qualquer casa" pode ser P3 |
| **FR-NNN** | Functional Requirement — o que o sistema **deve** fazer | FR-003: Sistema DEVE somar o valor do Speed Die ao movimento |
| **SC-NNN** | Success Criterion — métrica mensurável de sucesso | SC-001: 0 partidas crasham por erro de cálculo do Speed Die |
| **Given/When/Then** | Formato BDD — descreve cenário sem ambiguidade | "Given jogador completou 1ª volta, When ele rola dados, Then Speed Die também é rolado" |

---

## 7. Onde vivem os arquivos

```
banco-master/
│
├── .specify/                          ← internos do Spec Kit
│   ├── memory/constitution.md         ← princípios (você já viu)
│   ├── templates/                     ← templates dos comandos
│   └── scripts/, workflows/, ...      ← bastidores, ignore
│
├── .claude/skills/speckit-*/          ← as skills que rodam os comandos
│
├── specs/                             ← CADA FEATURE VIRA UMA PASTA AQUI
│   ├── speed-die/
│   │   ├── spec.md                    ← /speckit-specify cria
│   │   ├── plan.md                    ← /speckit-plan cria
│   │   └── tasks.md                   ← /speckit-tasks cria
│   ├── sistema-cartas/
│   │   └── spec.md
│   └── ...
│
├── docs/                              ← documentação humana (sua)
│   ├── SRS.md                         ← regras do jogo (verdade absoluta)
│   ├── DECISIONS.md                   ← log de decisões (ADR)
│   ├── CARTAS.md                      ← rascunho de discovery, vira spec depois
│   └── SPEC-KIT.md                    ← este arquivo
│
└── CLAUDE.md                          ← manual de bordo do Claude
```

> **Nota:** intencionalmente NÃO existe `CORE.md`, `ROADMAP.md` ou `ARCHITECTURE.md` global. Entidades, invariantes, constantes técnicas, status e design técnico vivem nas próprias specs (seção `Key Entities`, header `Status:`, e o `plan.md` quando existir). O SRS é a única referência transversal.

---

## 8. Seu dia-a-dia típico (cenários reais)

### Cenário A: "Quero desenhar uma nova mecânica"

```
1. Você invoca: /speckit-specify <descrição da mecânica>
2. Lê a spec gerada, vê o que faz sentido
3. (opcional) /speckit-clarify pra resolver dúvidas
4. Quando estiver feliz, marca status como Approved manualmente
5. PARA — está em discovery
```

### Cenário B: "Mudei de ideia sobre algo numa spec aprovada"

```
1. Edita a spec diretamente (é só um .md)
2. Se a mudança for grande: registra em docs/DECISIONS.md o porquê
3. Se a mudança afeta princípio do projeto: /speckit-constitution
```

### Cenário C: "Quero codar de verdade uma feature"

```
1. Confirma que a spec está aprovada e clara
2. /speckit-plan
3. Revisa o plan
4. /speckit-tasks
5. Revisa as tasks
6. /speckit-analyze (opcional, recomendado)
7. /speckit-implement
```

### Cenário D: "Tenho uma dúvida sobre o que já decidi"

Não use Spec Kit pra isso. Apenas:
- Abra `docs/DECISIONS.md` — decisões registradas
- Abra `.specify/memory/constitution.md` — princípios
- Abra `docs/SRS.md` — regras

---

## 9. Quando NÃO usar o Spec Kit

**Spec Kit é pra mudança de comportamento do jogo que o jogador final vai ver.** Pra tudo o resto, fala direto comigo.

### A pergunta de 1 segundo pra decidir

> 🧠 **"Isso muda o que o jogador vê, sente ou pode fazer dentro de uma partida?"**

- **Sim** → use Spec Kit (`/speckit-specify ...`)
- **Não** → fala direto comigo, sem Spec Kit

### Matriz de exemplos concretos

Pra ficar 100% claro, olha cada categoria abaixo:

#### ❌ NÃO usa Spec Kit — fala direto comigo

| Categoria | Exemplos de pedido |
|---|---|
| **Setup / Tooling** | "instala o Tailwind e configura", "configura ESLint com regras X", "adiciona Prettier", "configura Storybook" |
| **Stack / Infra** | "ajusta o vite.config.ts pra usar alias @/", "atualiza Node pra v22", "configura o Supabase local" |
| **Dependências** | "atualiza o React pra última versão", "remove a lib X que não usa", "adiciona Zustand" |
| **Git / GitHub** | "commita o que eu fiz", "abre uma PR", "cria uma issue", "merge na main" |
| **Devops / CI** | "configura GitHub Actions pra rodar testes", "adiciona deploy automático no Vercel" |
| **Refactor interno** | "renomeia essa variável", "extrai esse trecho pra uma função", "move esse componente pra outra pasta" |
| **Bug fix simples** | "tá dando erro na linha 47", "esse botão não tá clicável", "o cálculo do aluguel tá errado em X" |
| **Texto / Estilo** | "muda o título pra Y", "ajusta a cor desse botão", "adiciona um espaçamento aqui" |
| **Conteúdo de dados** | "ajusta o preço da propriedade X pra $250", "muda o nome da carta Y" (a não ser que seja regra nova) |
| **Documentação** | "atualiza o README", "documenta essa função", "adiciona JSDoc" |
| **Performance** | "essa tela tá lenta, otimiza", "adiciona memoização aqui" |
| **Dúvidas / Discussão** | "o que acha de X?", "qual a melhor forma de Y?", "explica isso aqui pra mim" |

#### ✅ USA Spec Kit — `/speckit-specify <descrição>`

| Categoria | Exemplos de pedido |
|---|---|
| **Mecânica nova de jogo** | "Speed Die", "Bus Tickets", "Hangar nos aeroportos", "Tax Man" |
| **Sistema novo** | "sistema de cartas", "sistema de empréstimos entre jogadores", "sistema de leilão" |
| **Regra nova de partida** | "regras de prisão", "construção em grupo parcial", "GO Progressivo" |
| **Fluxo de UX importante** | "fluxo de negociação entre jogadores", "lobby da sala", "fluxo de falência" |
| **Capacidade nova do produto** | "reconexão de jogador desconectado", "histórico de partidas", "salvar partida" |
| **Persistência de estado** | "como o jogo se recupera de queda do servidor" |

### Casos cinzentos (dúvidas comuns)

| Pedido | Spec Kit? | Por quê |
|---|---|---|
| "ajusta o aluguel da Avenida X pra $250" | ❌ Não | Mudança de **dado**, não de **regra**. Só editar o arquivo de tema |
| "muda o aluguel pra calcular como 5% do patrimônio total" | ✅ Sim | Mudança de **regra de cálculo** — afeta o jogador |
| "renomeia 'Tesouro' pra 'Baú Comunitário' na UI" | ❌ Não | Só texto, sem mudar comportamento |
| "Tesouro vira público em vez de privado" | ✅ Sim | Mudança de regra fundamental |
| "adiciona animação quando o dado rola" | ❌ Não (na maioria dos casos) | É polimento visual. Mas se virar mecânica de UX importante (ex: animação que comunica resultado de Speed Die de forma diferente), aí sim |
| "implementa a tela do tabuleiro" | ✅ Sim (uma vez) | Capacidade nova grande. A primeira versão merece spec. Ajustes depois não |
| "primeiro setup do projeto React+Vite" | ❌ Não | Setup. Não é regra de jogo |

### Resumo em uma frase

> **Se vai entrar no SRS, vai pra Spec Kit. Se é meio pra chegar lá, fala direto.**

Tailwind, commits, configs, deps, refactors — tudo isso é **meio**. O **fim** (jogo funcionando com tal mecânica) é Spec Kit.

### Como pedir tarefas operacionais (sem Spec Kit)

Não precisa de formato especial. Pede como pediria pra um colega:

- ✅ "instala e configura o Tailwind v4 com plugin de typography"
- ✅ "commita o que eu mexi com mensagem 'adiciona constitution e estrutura Spec Kit'"
- ✅ "atualiza o React pra a última versão e roda os testes"
- ✅ "olha esse erro aqui ó: \[paste do erro]"

Eu faço direto, te mostro o resultado, e a gente segue.

---

## 10. FAQ

### "E se eu quiser pular o /speckit-clarify?"
Pode pular. É opcional. Mas pra features complexas como Speed Die, vale.

### "Posso editar a spec.md à mão depois de gerada?"
**Sim.** É só markdown. Edite à vontade. O Spec Kit não trava nada.

### "E se eu invocar /speckit-specify pra algo que já tem spec?"
Ele te pergunta se quer atualizar a existente ou criar nova. Sem perigo de sobrescrever sem aviso.

### "Onde vejo o status das specs?"
No header de cada `spec.md` (campo `Status: Draft | Approved | ...`). Pra overview, `ls specs/` + abrir cada arquivo, ou pedir pro Claude listar.

### "Tem que rodar /speckit-plan pra toda spec?"
Não. Só quando for codar essa feature. Specs podem ficar em discovery por semanas sem plan.

### "E se o Claude esquecer do constitution numa sessão nova?"
Não esquece — o `CLAUDE.md` aponta pra ele e é carregado em todo chat novo. Se desconfiar, é só perguntar "leu o constitution?".

### "Posso ter duas specs trabalhando o mesmo arquivo de código?"
Em princípio sim, mas vira difícil de coordenar. Melhor que cada feature seja independente. Se duas dependem uma da outra, registra a dependência na spec ("Depende de: speed-die").

### "Como sei que uma spec está 'aprovada'?"
Não tem botão. Você edita o campo `Status: Draft` → `Status: Approved` no topo do `spec.md`. Convenção sua.

---

## 11. Glossário rápido

| Termo | Tradução prática |
|---|---|
| **SDD** | Spec-Driven Development = "spec primeiro, código depois" |
| **Spec** | Documento que descreve **o que** a feature faz |
| **Plan** | Documento que descreve **como** construir tecnicamente |
| **Tasks** | Lista atômica do que codar, em ordem |
| **Constitution** | Princípios do projeto que não podem ser quebrados |
| **SRS** (nosso) | Regras de negócio completas — fonte absoluta |
| **ADR** | Architecture Decision Record — registro de "por que decidimos X" (nosso DECISIONS.md) |
| **User Story** | Frase no formato "Como X, eu quero Y, para Z" |
| **Acceptance Scenario** | "Dado X, Quando Y, Então Z" — teste em linguagem natural |
| **MVP** | Minimum Viable Product — o menor pedaço que entrega valor |

---

## 12. Próximos passos sugeridos

1. **Leia o constitution** (`.specify/memory/constitution.md`) — só pra ver os princípios I a VII no original.
2. **Escolha uma feature pequena pra primeira spec.** Sugestões boas pra estrear:
   - `/speckit-specify Sistema de prisão — regras de quando o jogador é preso, opções de saída (pagar fiança, rolar dupla, usar carta), efeitos no turno`
   - `/speckit-specify Free Parking com prêmio acumulado — centro que junta impostos, multas e multa de prisão, redistribuído quando alguém para na casa`
3. **Após gerar:** abre o `specs/<nome>/spec.md` e lê. Não precisa entender tudo de primeira — só passa o olho na estrutura.
4. **(opcional) `/speckit-clarify`** pra ver como ele te ajuda a resolver pontas soltas.
5. **Para por aí.** Não vá pro plan ainda.

---

## 13. Quando tiver dúvida

Em qualquer chat novo, é só perguntar. Exemplos:
- "como funciona o /speckit-tasks de novo?"
- "essa spec aqui está aprovada ou ainda em draft?"
- "eu posso pular o /speckit-plan?"

O Claude tem o `CLAUDE.md` carregado e a memória do projeto, então responde com contexto.
