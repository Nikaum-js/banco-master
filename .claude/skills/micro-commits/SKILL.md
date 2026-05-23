---
name: "micro-commits"
description: "Transforma o estado atual de um projeto em uma série de micro-commits backdatados com datas aleatórias num intervalo (default: últimos 6 meses), mensagens em inglês com padrão emoji + conventional commits, na identidade do Nikolas. Executa tudo automaticamente — git init se preciso, commits, e oferece push no final."
argument-hint: "Opcionalmente: nome do remote SSH (ex: git@github.com:Nikaum-js/projeto.git) ou ajustes no range de datas"
user-invocable: true
disable-model-invocation: false
---

# /micro-commits — Backdated micro-commits no estilo do Nikolas

Você está sendo invocado para transformar o estado atual de um projeto em uma sequência de **micro-commits** distribuídos no tempo. Siga este fluxo **sem pular passos**.

---

## Identidade obrigatória (não-negociável)

Toda execução desta skill usa **EXATAMENTE** estes valores no `git config` do repo local:

```
user.name  = "Nikolas Santana"
user.email = "nikolasdssantana@gmail.com"
```

Setar **antes** do primeiro commit. Se o repo já tinha outra identidade local, sobrescrever sem perguntar. **Nunca** usar `--global` — só config local do repo.

GitHub username de referência: `Nikaum-js` (use pra montar URL do remote quando o usuário não fornecer).

---

## Regras absolutas dos commits

1. **Mensagens em inglês.** Mesmo que o projeto inteiro seja em português, os commits são em inglês.
2. **Padrão:** `<emoji> <type>(<scope opcional>): <description in English>`
3. **Sem co-author.** **NUNCA** adicionar `Co-Authored-By: Claude` ou qualquer trailer.
4. **Sem `--no-verify`** nem `--no-gpg-sign` — não burlar hooks.
5. **Datas backdatadas** via `GIT_AUTHOR_DATE` e `GIT_COMMITTER_DATE` (ambas obrigatórias, formato ISO com timezone `-03:00`).
6. **Horas variadas e aleatórias** entre 09:00 e 23:30 — não usar horas redondas como 10:00 ou 14:00 (parece artificial). Misturar segundos diferentes (`10:42:11`, `16:18:47`, `21:05:33`).
7. **Nomes próprios do projeto** (ex: "Surpresa", "Tesouro", "Banco Master") **podem** ficar em pt-BR pois são nomes próprios. Resto da frase em inglês.

### Mapa de emojis (gitmoji-style)

| Emoji | Type | Quando |
|---|---|---|
| 🎉 | chore | Initial setup / scaffold |
| 🔧 | chore | Tooling / config (ESLint, TS, Vite, etc.) |
| 🎨 | feat | UI / structural scaffold |
| ✨ | feat | New functionality |
| 📝 | docs | Documentation |
| 📎 | docs | Binary attachment (e.g. .docx, .pdf) |
| ♻️ | refactor | Refactor without behavior change |
| 🐛 | fix | Bug fix |
| 🚀 | perf / deploy | Performance / deploy |
| 🤖 | chore | AI / Claude-related |
| 🔒 | chore | Permissions / security |
| 🗑️ | chore | Removal / cleanup |
| ✅ | test | Tests |

---

## Fluxo de execução

### Passo 1 — Verificar argumentos e estado do repo

Pegue o argumento `$ARGUMENTS` (pode ser o SSH do remote ou ajustes de range).

```bash
pwd
ls -la
git status 2>/dev/null || echo "Não é repo git ainda"
```

Decida:
- **Se NÃO é repo git** → vai criar com `git init` no Passo 3.
- **Se JÁ é repo git mas vazio (`git log` falha)** → segue normal, é só popular.
- **Se JÁ é repo git COM commits** → **PARE** e pergunte ao usuário:
  - "Detectei que esse repo já tem N commits. Você quer: (a) **adicionar** novos commits ao histórico existente (sem mexer no passado), (b) **apagar tudo** (`rm -rf .git`) e refazer do zero, ou (c) cancelar?"
  - Não prosseguir sem decisão explícita.

### Passo 2 — Decidir range de datas

**Default:** dos últimos 6 meses até hoje. Calcular dinâmicamente baseado na data atual.

Se o usuário informou range no argumento (ex: "últimos 3 meses", "de janeiro até hoje"), respeite. Caso contrário, use o default.

**Distribuição:** mais commits agrupados nas datas recentes (últimas 2 semanas) e distribuídos esparsamente nas anteriores. Isso reflete padrão natural: você lembra do que fez recentemente e codou agora; coisas antigas estão espalhadas.

### Passo 3 — Setup do git (se necessário)

```bash
# Apenas se não for repo
git init
git branch -M main

# SEMPRE — identidade local
git config user.name "Nikolas Santana"
git config user.email "nikolasdssantana@gmail.com"

# Remote — só se o usuário forneceu OU se já existe arquivo .git/config sem remote
git remote add origin <SSH_URL>   # se informado
```

### Passo 4 — Mapear arquivos em grupos lógicos

Liste arquivos não-rastreados:

```bash
git status -uall --porcelain
```

**Agrupe por contexto lógico**, exemplos canônicos (adapte ao projeto real):

| Grupo | Arquivos típicos |
|---|---|
| Scaffold inicial | README.md, .gitignore, package.json, lockfile, index.html |
| TypeScript configs | tsconfig*.json |
| Build/lint configs | vite.config.*, eslint.config.*, prettier, etc. |
| UI scaffold | src/, public/ |
| Docs gerais | docs/*.md |
| Docs específicas | docs/X/, arquivos individuais |
| Spec Kit | .specify/, .claude/skills/speckit-* |
| Claude config | CLAUDE.md, .claude/ (exceto skills do Spec Kit) |
| Binários | *.docx, *.pdf, *.png em raiz |

**Verificar gitignore antes de cada `git add`** — se um arquivo está ignorado, NÃO inclui ele e **avisa** no resumo final.

**Quantidade ideal:** 12-25 commits. Se houver muito conteúdo, divida grupos em sub-grupos. Se houver pouco, agrupe.

### Passo 5 — Distribuir datas

Para cada grupo, atribua **uma data + hora** dentro do range:

- Use ordem cronológica que faça sentido lógico: scaffold antes de docs, docs antes de adoção de tooling avançado (Spec Kit).
- **Horas variadas:** 09:47:38, 13:08:51, 18:04:19, 22:48:09, 23:09:12 — não use 10:00:00.
- **Distribuição mais densa** nas últimas 2 semanas; mais esparsa antes.

### Passo 6 — Apresentar plano antes de executar

**Pause e mostre ao usuário** uma tabela com:
- # do commit
- Data atribuída
- Arquivos incluídos
- Mensagem proposta

Pergunte: "Aprova esse plano? (sim / ajustes)". **Não execute sem aprovação.**

### Passo 7 — Executar os commits

Para cada grupo, **na ordem cronológica**:

```bash
git add <arquivos específicos do grupo>
GIT_AUTHOR_DATE="<ISO date -03:00>" GIT_COMMITTER_DATE="<ISO date -03:00>" \
  git commit -m "<emoji> <type>(<scope?>): <description in English>"
```

**Use `&&` entre todos os comandos** para parar no primeiro erro.

**Se um arquivo falhar** (ignorado pelo gitignore, não existe mais, etc.):
- **Não use `-f`** pra forçar — respeitar o gitignore é correto.
- Pular esse arquivo no grupo e logar o motivo.
- Se o grupo inteiro virou vazio (todos arquivos ignorados/faltando), pular o grupo.

### Passo 8 — Sanity check

```bash
git status                # deve dizer "nothing to commit, working tree clean"
git log --pretty=format:"%h  %ad  %an <%ae>  %s" --date=short
```

Verifique:
- Todos commits têm autor `Nikolas Santana <nikolasdssantana@gmail.com>`.
- Datas em ordem cronológica crescente.
- Working tree limpo (ou só arquivos ignorados/faltantes).

### Passo 9 — Push

**Não execute push automaticamente.** Pergunte ao usuário:

> "Quer fazer o push agora? (sim / não)"

Se sim:
```bash
git push -u origin main 2>&1
```

Se falhar (SSH não configurado, repo remoto não existe, etc.):
- Mostrar o erro completo.
- Sugerir próximos passos (configurar SSH, criar repo no GitHub primeiro, etc.).
- **Não tentar workaround.** Reportar e parar.

---

## Resumo final ao usuário

Reporte em formato curto:

```
✅ N commits criados de DATA_INICIO a DATA_FIM
✅ Identidade: Nikolas Santana <nikolasdssantana@gmail.com>
✅ Push: feito | não solicitado | falhou (motivo)

Pulados:
- arquivo X (motivo)
- arquivo Y (motivo)
```

---

## Erros comuns a evitar

| Erro | Como evitar |
|---|---|
| Esquecer de setar `user.email` antes do primeiro commit | Setar imediatamente após `git init` (Passo 3) |
| Usar `--global` ao invés de local | NUNCA usar `--global` nesta skill |
| Adicionar `Co-Authored-By: Claude` | NUNCA. Mensagem termina na descrição |
| Hora redonda (10:00:00) | Sempre usar segundos diferentes (`10:42:11`) |
| Mensagem em português | Sempre em inglês — projeto pode ser pt-BR, commit não é |
| Force-add arquivo ignorado pelo gitignore | Não usar `-f`. Pular e reportar |
| Executar push sem perguntar | Passo 9 sempre pergunta antes |
| Skip do passo "apresentar plano" | Passo 6 é obrigatório — aprovação humana antes de criar commits |

---

## Argumentos suportados

- `<SSH_URL>` — URL do remote SSH (ex: `git@github.com:Nikaum-js/projeto.git`). Se omitido e o repo não tem remote, perguntar.
- `--months N` — usar N meses como range (default 6).
- `--from YYYY-MM-DD` / `--to YYYY-MM-DD` — range explícito.
- `--count N` — alvo de N commits.
- `--no-push` — pular o Passo 9 (não perguntar sobre push).

Exemplos:
- `/micro-commits` — usa defaults
- `/micro-commits git@github.com:Nikaum-js/banco-master.git`
- `/micro-commits --months 3 --count 12`
- `/micro-commits --from 2026-01-01 --no-push`
