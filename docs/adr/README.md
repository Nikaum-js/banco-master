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
- [D-006](D-006-free-parking-com-premio-acumulado.md) — Free Parking acumula prêmio; semente/reabastecimento atuais de $750 (D-076)
- [D-007](D-007-go-progressivo.md) — GO fixo: $250 ao passar e $500 ao parar exatamente (regra fixa da revisão pós-playtest; valores da D-076)
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
- [D-023](D-023-leilao-de-escassez-de-terrenos-pregao-simultaneo.md) — Leilão de escassez de terrenos (pregão simultâneo, fim de jogo) — revertida pela D-059 e **restaurada pela D-060**, agora com janela de 24s e contagem regressiva visível
- [D-024](D-024-economia-recalibrada-tiers-de-casa-aluguel-por-grupo.md) — Economia recalibrada: tiers de casa + aluguel por grupo (sweet spots; laranja→3)
- [D-025](D-025-distrito-super-luxo-alta-roda.md) — Distrito super-luxo dos Emirados (Abu Dhabi/Dubai; 10º grupo, armadilha de prestígio)
- [D-026](D-026-construcao-com-pais-parcial-aluguel-escalonado-por-posse.md) — Construção com país parcial: constrói com 1+ cidade, aluguel escala por posse (revisa D-004)
- [D-027](D-027-bus-ticket-usavel-tambem-no-fim-do-turno.md) — Bus Ticket usável também no fim do turno (não só antes de rolar)
- [D-028](D-028-bus-tickets-negociaveis.md) — Bus Tickets negociáveis em propostas de troca (revisa §8.2/§10.7 do SRS)
- [D-029](D-029-desconexao-de-jogador-eliminado-nao-pausa-a-partida.md) — Desconexão de jogador eliminado NÃO pausa a partida (refina §11.3)
- [D-030](D-030-privacidade-de-cartas-e-garantia-de-apresentacao-no-v1.md) — ~~Privacidade de cartas é garantia de apresentação no v1~~ **revogada** pela D-037
- [D-031](D-031-espolio-do-falido-vai-a-pregao-simultaneo.md) — Espólio do falido-ao-banco vai a pregão simultâneo (implementa §9.2; herdou o formato da D-023, e volta a compartilhá-lo com a escassez desde a D-060)
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
- [D-047](D-047-avatares-escolhiveis-e-persistentes.md) — Cinco avatares e oito skins combináveis persistem do lobby à partida (revoga parcialmente D-044; refina D-045)
- [D-048](D-048-propostas-de-negociacao-simultaneas.md) — Propostas de negociação simultâneas, identificadas e apresentadas por rota
- [D-049](D-049-construcao-deve-ser-vendida-antes-da-hipoteca.md) — Toda construção deve ser vendida antes da hipoteca, inclusive Hangar
- [D-050](D-050-limite-de-construcao-por-posse.md) — País incompleto limita o nível de construção pela quantidade de cidades possuídas (refina D-026)
- [D-051](D-051-maior-dado-e-rolado-por-cada-jogador.md) — Maior dado é rolado por cada jogador, em sequência e à vista da mesa (refina D-046)
- [D-052](D-052-revanche-reabre-a-mesma-sala.md) — Revanche reabre a mesma sala e preserva assentos entre partidas (revoga parcialmente D-038)
- [D-053](D-053-projeto-renomeado-para-magnata-imobiliario.md) — Projeto renomeado de Banco Master para Magnata Imobiliário (risco de marca registrada no INPI)
- [D-054](D-054-emprestimo-vence-em-tres-voltas.md) — Empréstimo vence em três voltas, com cobrança automática do principal (revoga parcialmente D-009)
- [D-055](D-055-troca-exige-contrapartida-minima.md) — ~~Troca exige contrapartida mínima de metade do valor entregue em ativos~~ **revogada** (substituída pela D-058)
- [D-056](D-056-cobranca-de-divida-sai-do-centro-da-tela.md) — Cobrança de dívida sai do centro da tela e vira faixa ancorada que encolhe o tabuleiro (refina D-039; a faixa é substituída pelo miolo na D-066, o motivo continua valendo)
- [D-057](D-057-desistencia-voluntaria-encerra-a-participacao.md) — Desistir encerra a participação sem exigir insolvência; sem empréstimo ativo os bens voltam livres ao banco, sem pregão (novo §9.6)
- [D-058](D-058-troca-e-livre-ate-o-esvaziamento.md) — Troca é livre em qualquer proporção; só doação pura e esvaziamento (reduzir o patrimônio a menos de um terço) são recusados (substitui D-055, §8.5)
- [D-059](D-059-leilao-de-escassez-de-terrenos-revertido.md) — ~~Leilão de escassez de terrenos revertido~~ **revogada** (revertida pela D-060, que restaura a D-023)
- [D-060](D-060-leilao-de-escassez-restaurado-com-janela-legivel.md) — Leilão de escassez restaurado, com janela de 24s e contagem regressiva visível (revoga D-059, restaura D-023, §7.3/§7.5)
- [D-061](D-061-obrigacao-a-outro-jogador-nao-e-truncada.md) — Obrigação a outro jogador não é truncada: pagamento parcial deixa o restante devido e abre dívida pendente, inclusive fora da vez (§9.1)
- [D-062](D-062-hipotecada-pode-voltar-ao-banco.md) — Propriedade hipotecada pode voltar ao banco por zero e vira terreno livre; bloqueada com dívida pendente (novo §6.4)
- [D-063](D-063-toda-mutacao-de-caixa-tem-causa-registrada.md) — Toda mutação de caixa passa por uma função e registra motivo; o Fiscal e mais cinco regras deixam de mover dinheiro em silêncio (refina D-032)
- [D-065](D-065-fiscal-sai-do-jogo.md) — O Fiscal sai do jogo: token invisível que cobrava fora da vez, causa raiz de quatro relatos de bug financeiro (revoga §13.8; revoga parcialmente D-063)
- [D-066](D-066-cobranca-de-divida-vai-para-o-miolo-do-tabuleiro.md) — Cobrança de dívida vai para o miolo do tabuleiro: não cobre casa, não reposiciona a mesa e continua sem ser modal (refina D-056, que acertou o motivo e errou o lugar)
- [D-067](D-067-retencao-leve-fica-na-sala-privada.md) — Retenção leve fica na sala privada: até 10 resumos, estatísticas derivadas e presets sem regra nova (refina D-019/D-038/D-046/D-052)
- [D-064](D-064-rebalanceamento-do-catalogo-de-cartas.md) — Rebalanceamento do catálogo de cartas: Acaso 21 / Tesouro 18, lendárias reforçadas (Confisco Geral, Aquisição a ½ preço, Imposto Federal 25%), Greve unificada, Imunidade total de 1 volta, 8 cartas novas e Refinanciamento removido (SRS §10, v1.26)
- [D-069](D-069-segundo-mapa-jogavel-cidade-da-fuligem.md) — Segundo mapa jogável selecionado por sala: Cidade da Fuligem (`fuligem`); mapa é conteúdo + apresentação sobre o mesmo motor, gravado na sala e imutável; fallback `atlas`; conceito Fliperama Neon removido (revisa SRS §16; *D-068 reservada pela worktree da 054*)
- [D-070](D-070-fuligem-tem-topologia-e-regras-proprias.md) — Cidade da Fuligem usa tabuleiro próprio de 40 casas, 8 bairros e Desvio pela Ferrovia; a Taxa de Fumaça foi revogada pela D-072 (refina D-017/D-069)
- [D-071](D-071-minas-sao-ativos-passivos-sem-aluguel.md) — Minas são títulos passivos sem aluguel: Ferro −25% em construção, Carvão +50% em Ferrovias, Estanho −15% em impostos/aluguéis pagos e Cobre +25% em propriedades construídas
- [D-072](D-072-taxa-de-fumaca-sai-da-fuligem.md) — Taxa de Fumaça removida: construções da Fuligem pagam somente o custo normal; Desvio pela Ferrovia e demais regras permanecem (revoga parcialmente D-070)
- [D-073](D-073-desvio-pela-ferrovia-uma-vez-por-turno.md) — Desvio pela Ferrovia pode ser usado no máximo uma vez por turno, encerrando o ciclo gratuito entre estações (refina D-070)
- [D-074](D-074-raridade-de-carta-nao-inverte-probabilidade.md) — No vocabulário de três níveis da época, lendárias e raras ficam em 1 cópia e o excedente dos baralhos 21/18 vai para comuns (refina D-064; nomenclatura e pesos refinados pela D-075)
- [D-075](D-075-quarto-nivel-de-raridade-epica.md) — Quarto nível de raridade **Épica** (roxo), inserido no meio: ex-rara→épica, ex-comum de 1 cópia→rara, comum passa a ser só o que tem 2 cópias; pesos 90/104/107/109 sobem a épica e cedem em rara e comum (refina D-074, SRS §10.2/§10.4–10.5 v1.35)
- [D-076](D-076-rebalanceamento-economico-para-mesas-de-3-e-4.md) — Rebalanceamento econômico para mesas de 3–4: caixa inicial $3.000, GO $250/$500, Loteria $750, impostos $250/$150, aeroportos 30/60/125/250; Fuligem reprecificada dentro do tier de cada `GroupKey` (a curva dela estava invertida) e marrom do Atlas corrigido (refina D-017/D-024/D-070, SRS v1.36)
- [D-077](D-077-mapa-da-sala-e-trocavel-no-lobby.md) — O mapa da sala deixa de ser imutável: o host pode trocá-lo **enquanto a sala está em lobby** (inclusive no lobby de revanche); do Ritual de Largada em diante, não (refina D-069, SRS §2.1/§11.1/§16 v1.37)
- [D-079](D-079-retrato-de-celular-e-orientacao-servida.md) — **Retrato de celular é orientação servida**: o aviso "gire o aparelho" sai do caminho de jogo e retrato ganha layout próprio — tabuleiro herói na largura inteira, painéis viram gaveta com abas abaixo dele, cockpit fixo com caixa e vez. Revoga a cláusula **Orientação** da D-039 (o AA e o gate dela continuam); limiar retrato ≤820px; paisagem intocada (SRS §12.6 v1.39)
- [D-078](D-078-pregao-de-escassez-abre-com-seis-terrenos.md) — O **Pregão de escassez** passa a abrir a **≤6** terrenos livres (era ≤3): a 3 o evento chegava com o tabuleiro já decidido. Com 1 a 6 livres todos entram de uma vez; janela de 24s, solvência, procedências e re-arme intactos. A interface ganha grade de até 3 colunas e, em paisagem baixa, faixa de seleção mais painel (refina D-060, SRS §7.1/§7.5/§12.3 v1.38)
- [D-080](D-080-estatizacao-dura-uma-volta.md) — A **Estatização** dura **1 volta completa**, não 2: é o único efeito board-wide que desliga a economia inteira, e duas voltas de mesa cheia viravam um intervalo de jogo. Refina a D-064 **só na duração** — aluguéis seguem indo à Loteria, raridade Épica, 1 cópia no Acaso, imediata, elegibilidade e destino do dinheiro intactos (SRS §10.6 v1.40)

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
