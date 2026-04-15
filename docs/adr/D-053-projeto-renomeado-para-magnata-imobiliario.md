# D-053 — Projeto renomeado para Magnata Imobiliário

**Data:** 2026-07-29 · **Status:** aceita

**Decisão:** o projeto deixa de se chamar **Banco Master** e passa a se chamar **Magnata Imobiliário**, em todos os lugares onde o nome antigo aparecia: SRS, `CONTEXT.md`, ADRs, specs, comentários de código, identificadores técnicos (`package.json`, título HTML, prefixos de log, salt de telemetria), UI (as duas telas de home) e o repositório no GitHub (`Nikaum-js/banco-master` → `Nikaum-js/magnata-imobiliario`).

O personagem do Speed Die **Mr. Banco Master** (SRS §13.2, FR-024) passa a se chamar **Mr. Magnata**; o discriminante interno do motor `'mr-banco'` passa a `'mr-magnata'`.

**Por quê:** pesquisa em `scratchpad/web-research-nome-banco-master-risco-juridico-sources.md` (29/07/2026) encontrou três registros vigentes de **BANCO MASTER** no INPI cobrindo exatamente o território deste produto — classe 09 (aplicativos/software), classe 41 (entretenimento) e classe 42 (desenvolvimento de software) —, todos com vigência até 2031/2032. O Art. 124, XIX da Lei 9.279/1996 veda uso de marca alheia registrada capaz de causar confusão no mesmo segmento, e os Arts. 207-210 admitem ação cível, perdas e danos e liminar de sustação. Como o produto está em lançamento público (M4, produção viva na Vercel), manter o nome era risco jurídico desnecessário e evitável — o nome nunca foi parte da regra de jogo, só da marca.

**Como aplicar:**
- Nome de exibição: **Magnata Imobiliário** (com acento, em prosa/documentação).
- Slug técnico: `magnata-imobiliario` (sem acento — `package.json`, URLs, prefixos de log/plugin, salt de build).
- Título público no navegador e metadados: **Magnata Imobiliário — Jogo de tabuleiro online**.
- Forma toda em maiúsculas (títulos ASCII, letreiro de pixel do arcade): `MAGNATA IMOBILIARIO`.
- Personagem do Speed Die: **Mr. Magnata** (prosa) / `'mr-magnata'` (literal interno).
- Tema do tabuleiro ("Cidades do Mundo") e todas as regras de jogo permanecem inalteradas — a mudança é só de nome do produto e do personagem que carregava o nome antigo.
- Registros históricos de infraestrutura (ex.: nome do projeto Supabase em `HANDOVER.md` e `specs/043-identidade-de-transporte/plan.md`, criado como `Banco master` antes desta decisão) **não são retroativamente reescritos** — são fatos de uma infraestrutura já existente, não texto de marca; renomear o projeto Supabase em si é ação de infraestrutura separada, fora do escopo deste ADR.
- As worktrees em `.claude/worktrees/` (branches de features antigas/paralelas) não foram tocadas por esta decisão — cada uma resolve a nomenclatura ao integrar ao `main`.
