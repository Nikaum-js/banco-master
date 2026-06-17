---
name: spec-prompt
description: Monta o prompt estruturado de criação de spec do GitHub Spec Kit para o Magnata Imobiliário a partir de uma descrição de feature — descobre o próximo número de spec, aponta a leitura obrigatória dos docs canônicos (constitution, SRS por §, DECISIONS, PRD, HANDOVER), deriva escopo / fora do escopo / restrições inegociáveis / entregáveis, e opcionalmente já executa o /speckit-specify. Usar quando o usuário quiser abrir uma spec nova (ex.: "monta o prompt da spec de X", "quero abrir a spec do multiplayer", "prepara o /speckit-specify de Y") e precisar do prompt pronto pra colar noutro modelo, ou pra rodar direto.
argument-hint: "[--run] <descrição da feature em uma frase>"
---

# spec-prompt — gerador de prompt de spec (Spec Kit)

Monta um prompt de `/speckit-specify` com a mesma estrutura toda vez: leitura obrigatória → comando →
escopo → fora do escopo → restrições inegociáveis → entregáveis. Assim o usuário não precisa descrever
tudo em prosa nem colar de uma conversa pra outra.

## Modos

- **Padrão** (`/spec-prompt <descrição>`): monta e **imprime** o bloco de prompt pronto pra copiar/colar
  em outra sessão (ex.: um modelo mais barato como Fable). NÃO executa nada além de ler docs.
- **`--run`** (`/spec-prompt --run <descrição>`): monta o mesmo contexto e **executa `/speckit-specify`
  nesta sessão** (sem copiar/colar). Termina em `/speckit-clarify` se houver ambiguidade. Não avança
  pra `/speckit-plan`/`implement`.

## Quando NÃO gerar spec (checar ANTES de tudo)

Spec Kit é só pra **feature** (comportamento novo que operacionaliza o SRS). Se a descrição for
**refactor interno, remoção de dead code, tooling/setup, git, deps, bug fix simples, mudança de
texto/estilo ou dúvida/discussão** (lista "Não usar Spec Kit para" do `AGENTS.md` §5), **NÃO gerar
prompt**: avisar que isso é tarefa direta (apontar o item da auditoria se houver) e oferecer fazer
sem SDD. Só seguir os passos abaixo quando for feature de verdade.

## Passos

Copie e siga:

- [ ] **0. É feature?** Se cair na lista acima, parar e avisar. Caso contrário, seguir.
- [ ] **1. Próximo número de spec.** Rodar `ls specs/` e pegar `max(NNN) + 1` (3 dígitos, ex.: `037`).
- [ ] **2. Docs relevantes.** Sempre: `.specify/memory/constitution.md`, `docs/PRD.md`, `HANDOVER.md`.
      Além desses, achar o que a feature toca:
  - `grep -in "<termos da feature>" docs/SRS.md` → listar os **§ específicos** que a spec operacionaliza.
  - `grep -in "<termos>" ../../../docs/adr/README.md` → listar as **Ds relacionadas** (aceitas E rejeitadas).
  - `ls specs/` → specs existentes com dependência.
- [ ] **3. Derivar escopo e restrições** da feature + docs acima (não inventar — ver Regras fixas).
- [ ] **4. Preencher o template** abaixo, substituindo tudo entre `«»`.
- [ ] **5. Entregar:** modo padrão → imprimir o bloco; `--run` → executar `/speckit-specify «descrição»`
      com esse contexto já lido, depois `/speckit-clarify`.

## Regras fixas (entram em TODA spec deste projeto)

Embutir na seção "Restrições inegociáveis" do template, sempre:

- Idioma **PT-BR**; parar em `/speckit-specify` (+ `/speckit-clarify`), **nunca** avançar pra plan/implement.
- **Não inventar regra de jogo** — o SRS é a verdade absoluta (princípio I); a spec **operacionaliza**,
  não cria. Regra nova exige ADR em `../../../docs/adr/README.md` primeiro.
- Respeitar os **princípios I–VII** do constitution (esp. III tesouro impacta, IV catch-up discreto,
  VI privacidade de cartas, VII resiliência de sessão).
- Entidades/invariantes/constantes vivem **na própria spec** (não há doc global de arquitetura).

## Template

````
Você vai criar a spec «NNN» do Magnata Imobiliário usando GitHub Spec Kit.
Idioma: PT-BR. NÃO escreva código — pare em /speckit-specify (+ /speckit-clarify se houver ambiguidade).

## Leia OBRIGATORIAMENTE antes de specificar (nesta ordem)
1. `.specify/memory/constitution.md` — princípios I–VII «(destacar os que a feature mais toca)».
2. `docs/SRS.md` «§X, §Y — títulos» — regra de negócio que esta spec operacionaliza.
3. `../../../docs/adr/README.md` — «D-0NN (título) …» relacionadas «(incluir rejeitadas a não revisitar)».
4. `docs/PRD.md` «§ relevante» — enquadramento de produto e faseamento.
5. `HANDOVER.md` — estado atual do engine/UI.
«6. specs/0NN-* — dependências, se houver.»

## Comando
Rode: /speckit-specify «descrição da feature em uma frase»

## Escopo desta spec («NNN»)
«Bullets do que ESTÁ dentro — valor testável de ponta a ponta.»

## Fora do escopo (viram specs futuras)
«Bullets do que fica de fora; se crescer demais, PROPOR a fatia mínima e registrar o resto como dependência.»

## Restrições inegociáveis
- «Restrições específicas da feature, derivadas do SRS/DECISIONS.»
- Não inventar regra — o engine não muda de regra; SRS é a verdade (princípio I). Operacionalizar, não criar.
- Respeitar princípios I–VII «(citar os aplicáveis)».
- «Constantes/knobs relevantes (ex.: theme.ts) — fonte única, não duplicar.»

## Entregáveis
`specs/«NNN»-*/spec.md` com: user stories priorizadas, acceptance scenarios (Given/When/Then «cobrindo
os casos críticos da feature»), functional requirements, key entities «(listar as prováveis)» e success
criteria mensuráveis. Depois /speckit-clarify. PARE aí.
````

## Exemplo de preenchimento (multiplayer)

Para "fundação do multiplayer host-autoritativo", a §2 vira `SRS §11 (sala/sessão/resiliência), §12.3/§12.5,
§16 (escopo v1)`; a §3 vira `D-019 (auth anônima por link), D-020 com o Refinamento de 2026-07-24`; as
restrições específicas incluem `frontend-first (só cliente + Supabase BaaS), host-autoritativo, difusão POR
COMANDO (não snapshot), reducer puro preservado, identidade nos comandos (fecha store.ts:262)`.
