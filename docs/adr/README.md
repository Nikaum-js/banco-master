# ADR — Log de decisões

> Registro append-only de decisões de produto e design. Um arquivo por decisão, id `D-0xx` estável (referenciado em ~459 pontos do repo, incluindo comentários em `src/`).
> Nunca apagar — só adicionar nova entrada que invalide uma anterior (e referenciar a invalidada).
>
> **Status possíveis:** `aceita` · `rejeitada` · `revogada` (substituída por nova decisão)

---

## Índice


### Aceitas
- [D-001](D-001-multiplayer-online-exclusivo.md) — Multiplayer online exclusivo, sem IA, sem hotseat
- [D-002](D-002-ate-8-jogadores-por-sala.md) — Até 8 jogadores humanos por sala
- [D-003](D-003-speed-die-apos-1a-volta.md) — Speed Die ativado após 1ª volta
- [D-004](D-004-construcao-com-grupo-parcial.md) — Construção com grupo parcial permitida (70% / 150%)
- [D-005](D-005-propriedade-coringa.md) — ~~2 propriedades coringa no tabuleiro~~ **revogada** (funcionalidade removida)
- [D-006](D-006-free-parking-com-premio-acumulado.md) — Free Parking acumula prêmio (inicial $500)
- [D-007](D-007-go-progressivo.md) — GO Progressivo ($100 a $400 por ranking)
- [D-008](D-008-segundo-hotel-por-propriedade.md) — Segundo hotel permitido (cobra mais aluguel; revista pela D-022)
- [D-009](D-009-emprestimos-entre-jogadores.md) — Empréstimos entre jogadores (10–50%, cobra por GO)
- [D-010](D-010-imunidade-de-aluguel-negociavel.md) — Imunidade de aluguel negociável
- [D-011](D-011-cartas-em-mao-privadas-e-nao-negociaveis.md) — Cartas em mão privadas e não-negociáveis (limite 3)
- [D-012](D-012-bus-tickets-como-item-separado.md) — Bus Tickets como item de mão separado das cartas
- [D-013](D-013-cartas-ofensivas-nao-recusaveis-exceto-via-reacao.md) — Cartas ofensivas não recusáveis exceto via reação
- [D-014](D-014-tesouro-precisa-impactar.md) — Princípio: Tesouro precisa ser impactante (não "casa de troquinho")
- [D-015](D-015-sem-timer-de-turno.md) — Sem timer de turno; jogador controla finalização
- [D-016](D-016-desconexao-pausa-a-partida.md) — Desconexão pausa a partida, sem perda de propriedades
- [D-017](D-017-tabuleiro-de-48-casas.md) — Tabuleiro expandido para 48 casas (inspirado no Mega Edition)
- [D-018](D-018-termo-canonico-acaso-antes-surpresa.md) — Termo canônico "Acaso" (antes "Surpresa")
- [D-019](D-019-autenticacao-anonima-por-link-sem-contas-no-v1.md) — Autenticação anônima por link (sem contas no v1)
- [D-020](D-020-modelo-de-autoridade-sincronizacao-host-autoritativo-realtim.md) — Modelo de autoridade & sync: host-autoritativo + Realtime + snapshot
- [D-021](D-021-espaco-bus-ticket-uso-imediato-ao-parar-revisa-27107.md) — Espaço Bus Ticket: uso imediato ao parar (revisa §2.7/§10.7) — **revertida (2026-05-27): volta a guardar o ticket**
- [D-022](D-022-escassez-de-construcao-removida-construcao-ilimitada.md) — Escassez de construção removida (construção ilimitada; remove leilão de casas)
- [D-023](D-023-leilao-de-escassez-de-terrenos-pregao-simultaneo.md) — Leilão de escassez de terrenos (pregão simultâneo, fim de jogo)
- [D-024](D-024-economia-recalibrada-tiers-de-casa-aluguel-por-grupo.md) — Economia recalibrada: tiers de casa + aluguel por grupo (sweet spots; laranja→3)
- [D-025](D-025-distrito-super-luxo-alta-roda.md) — Distrito super-luxo dos Emirados (Abu Dhabi/Dubai; 10º grupo, armadilha de prestígio)
- [D-026](D-026-construcao-com-pais-parcial-aluguel-escalonado-por-posse.md) — Construção com país parcial: constrói com 1+ cidade, aluguel escala por posse (revisa D-004)
- [D-027](D-027-bus-ticket-usavel-tambem-no-fim-do-turno.md) — Bus Ticket usável também no fim do turno (não só antes de rolar)
- [D-028](D-028-bus-tickets-negociaveis.md) — Bus Tickets negociáveis em propostas de troca (revisa §8.2/§10.7 do SRS)
- [D-029](D-029-desconexao-de-jogador-eliminado-nao-pausa-a-partida.md) — Desconexão de jogador eliminado NÃO pausa a partida (refina §11.3)
- [D-030](D-030-privacidade-de-cartas-e-garantia-de-apresentacao-no-v1.md) — ~~Privacidade de cartas é garantia de apresentação no v1~~ **revogada** pela D-037
- [D-031](D-031-espolio-do-falido-vai-a-pregao-simultaneo.md) — Espólio do falido-ao-banco vai a pregão simultâneo, reusando a D-023 (implementa §9.2)
- [D-032](D-032-log-de-eventos-tipado-narrativa-e-da-ui.md) — Log de eventos tipado: o motor emite fatos, a narrativa (e a identidade) é da UI
- [D-033](D-033-codigo-de-reentrada-por-assento.md) — Código de reentrada por assento: reconexão de outro dispositivo (refina §11.3/§11.4 e D-019)
- [D-034](D-034-persistencia-indisponivel-pausa-a-partida.md) — Persistência indisponível pausa a partida (refina §11.4; pausa ganha causa explícita)
- [D-035](D-035-falha-de-interface-nao-derruba-a-partida.md) — Falha de interface não derruba a partida: fronteira abaixo da sessão, sem causa de pausa nova (refina §11.4 e o princípio VII)
- [D-036](D-036-acesso-a-sala-autorizado-no-servidor.md) — Acesso à sala autorizado no servidor; o link entra, não lê (refina D-019)
- [D-037](D-037-estado-por-perspectiva-a-mao-nao-trafega.md) — Estado por perspectiva: a mão não trafega para quem não é o dono (revoga D-030; refina §10.3)
- [D-038](D-038-fim-de-jogo-tem-classificacao-e-resumo.md) — Fim de jogo tem classificação e resumo: ordem inversa de eliminação, patrimônio e duração no estado (refina §9.5/§12.2)
- [D-039](D-039-acessibilidade-aa-no-caminho-de-jogo.md) — Acessibilidade AA no caminho de jogo, com gate no CI; paisagem é a orientação de jogo (novo §12.6)
- [D-040](D-040-telemetria-minima-anonima.md) — Telemetria mínima anônima: contagem no Supabase, exceção no Sentry; id de sala nunca em claro (novo §12.7)
- [D-041](D-041-publicacao-em-vercel-com-gate-verde.md) — Publicação na Vercel: preview por PR, produção promovida só com gate verde (decisão técnica)
- [D-042](D-042-identidade-de-transporte-atestada-pelo-servidor.md) — Identidade de transporte atestada pelo servidor (sessão anônima; refina D-019/D-020/D-033)
- [D-043](D-043-o-codigo-de-reentrada-e-imutavel-e-a-autoridade-o-le.md) — O código de reentrada é imutável, e a autoridade o lê (refina D-033/D-036/D-037)
- [D-044](D-044-remocao-da-peca-do-jogador.md) — Remoção da peça do jogador: identidade na mesa é nome + cor (revoga FR-022/023 da 038)
- [D-045](D-045-paleta-de-assentos-derivada-em-oklch.md) — Paleta de assentos derivada em OKLCH, verificada sob dicromacia (refina D-044)
- [D-046](D-046-leilao-da-largada-financia-a-loteria.md) — Host escolhe o Ritual de Largada: Leilão secreto financia a Loteria; Maior dado é gratuito (refina D-006 e a ordem inicial da 038)

> ℹ️ **Renumeração na integração da 043** (a colisão que este arquivo avisava): a worktree da 043
> tinha escrito a identidade de transporte como `D-035` e o código de reentrada como `D-038`, e
> os dois ids já estavam ocupados no `main` — `D-035` pela 042 (falha de interface) e `D-038`
> pela 044 (fim de jogo). Como o `main` já publicou os dele, quem renumerou foi a 043:
> `D-035 → D-042` e `D-038 → D-043`. `D-036`/`D-037` estavam reservadas para ela e ficaram como
> estavam. Um id duplicado é pior que um id renumerado antes de existir em qualquer lugar — e
> nenhuma das duas ADRs da 043 tinha saído da worktree.

### Rejeitadas
- [D-R01](D-R01-sistema-de-draft-rejeitada.md) — Sistema de draft de propriedades no início
- [D-R02](D-R02-co-propriedade-rejeitada.md) — Co-propriedade (dois donos de uma mesma propriedade)

---

## Como adicionar uma nova decisão

1. Pegue o próximo ID (`D-XYZ` para aceita, `D-RNN` para rejeitada). **Nunca reutilizar nem renumerar** — o id é citado em ~459 pontos do repo, inclusive em comentários de `src/`.
2. Crie o arquivo `D-XYZ-slug-do-titulo.md` nesta pasta, com `# D-XYZ — Título` na primeira linha.
3. Preencha data, status, decisão, "por quê" e (se aceita) "como aplicar".
4. Inclua a entrada no Índice acima, linkando o arquivo novo.
5. Se a decisão **revoga** uma anterior:
   - Mude o status da antiga para `revogada`.
   - Adicione no topo da antiga: `**Revogada por:** D-XYZ`.
   - Na nova, referencie a antiga em "Por quê".
6. Se a decisão altera um princípio do projeto, atualize [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) no mesmo passo.
