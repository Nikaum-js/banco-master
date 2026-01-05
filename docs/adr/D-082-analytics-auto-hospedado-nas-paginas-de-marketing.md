# D-082 — A auditoria de marketing mede código do app, não a contagem de scripts

**Data:** 2026-08-01 · **Status:** aceita · **Refina o gate de:** [spec 051](../../specs/051-landing-page-publica/spec.md) (FR-006/SC-003)

**Decisão:** as páginas de marketing (`index`, `how-to-play`, `faq`, `404`) passam a poder referenciar **um** `<script src>`, e só se ele vier do host do Plausible auto-hospedado. Qualquer outro script externo continua reprovando o `audit:bundle`, e mesmo o de analytics reprova se aparecer duas vezes.

O que **não** muda: FR-006 intacta — nenhum import de `src/game`, `src/net`, stores ou `motion` chega ao visitante de marketing. SC-003 intacta — o manifest continua provando ausência de Supabase/engine nos chunks. `play.html` segue fora da auditoria de marketing, com o grafo do jogo inteiro pendurado nele.

**`play.html` não recebe o script**, e isso é decisão, não esquecimento. O gate Lighthouse da 044 mede `/play` — a página mais pesada do projeto (~1,2 MB de JS) e a única com orçamento de performance. Medido no CI, incluir o Plausible ali levou o **TBT de 129ms para 201ms** (orçamento: 200ms), com as três amostras acima do baseline limpo. O app já tem telemetria anônima própria (044, `src/telemetry`); gastar 70ms do orçamento da tela de jogo para duplicar isso seria pagar caro por informação que já temos. Analytics de web serve às páginas de aquisição — que é onde ele ficou.

## Por quê

O requisito e o gate nunca disseram a mesma coisa.

- **FR-006** proíbe *"nenhum import de `src/game`, `src/net`, stores ou `motion`"*.
- **SC-003** exige *"ausência de Supabase/engine nos chunks de marketing"*.
- O `audit-marketing-bundle.ts` implementou isso como **`scriptRefs.length === 0`**.

"Zero script" era um **proxy** da regra, não a regra. E era um bom proxy: enquanto o único JS possível naquelas páginas fosse o nosso, contar scripts e proibir código do app davam exatamente o mesmo veredito, com uma checagem muito mais simples de escrever.

O proxy quebrou quando apareceu o primeiro `<script src>` legítimo: o Plausible auto-hospedado. Ele não importa nada de `src/`, não carrega Supabase, não puxa o motor — pesa ~1KB e não tem relação alguma com o que FR-006 protege. Mantido o proxy, o gate reprovaria justamente o que o requisito permite.

Sair disso pelo proxy custava caro dos dois lados:

- **Analytics só em `play.html`** deixaria a landing, o FAQ e o how-to-play sem medição — as páginas de aquisição e de SEO, que são a razão de a 051 existir. Mediríamos só quem já entrou.
- **Reimplementar o tracking inline** passaria no gate por tecnicalidade e nos daria código próprio pra manter, sem os extras do script oficial, para continuar mandando o mesmo evento pro mesmo servidor. Contornar a métrica em vez de corrigir a métrica.

Então o gate passou a medir o alvo: **procedência do script**, não quantidade. Um allowlist de um host só, com teto de um script por página.

## O que isso custa

O allowlist é por **host**, e o host hoje é um IP (`147.15.89.222`) — a instância do Plausible não tem domínio. Isso deixa o valor duplicado em dois lugares: a constante no script de auditoria e o `<head>` das quatro páginas. Quando a instância ganhar um domínio, os dois mudam juntos; nenhum terceiro lugar depende disso.

Ficamos com a garantia que importa — nenhum código do app vaza para o marketing — e perdemos a garantia acessória de que aquelas páginas não fazem **nenhuma** requisição de JS. É uma troca consciente: a primeira é a que a 051 se propôs a defender, a segunda era efeito colateral de como a medimos.
