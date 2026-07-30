# D-062 — Propriedade hipotecada pode voltar ao banco

**Data:** 2026-07-29 · **Status:** aceita · **Refina:** [D-049](D-049-construcao-deve-ser-vendida-antes-da-hipoteca.md) (§6.1), [D-058](D-058-troca-e-livre-ate-o-esvaziamento.md) (§8.5)

**Decisão:** o dono de uma propriedade **hipotecada** pode devolvê-la ao banco, na própria vez, e **não recebe nada por ela**. A propriedade volta a ser **terreno livre** (§7.2) — sem hipoteca, sem Hangar, sem construção —, disponível pelo fluxo normal de cair-e-comprar e contando de novo para a escassez de terrenos (§7.5, [D-060](D-060-leilao-de-escassez-restaurado-com-janela-legivel.md)).

**Só a hipotecada.** Propriedade livre de hipoteca não tem venda ao banco, e a razão é que ela já tem: **hipotecar É a venda ao banco**, por metade do preço, com opção de recompra. O que faltava era a saída do estado *seguinte* — depois de hipotecada, o único caminho de volta era pagar metade + 10% para reaver um título que talvez o jogador não queira mais. Este é o buraco que a decisão fecha, e ele não existe fora dele.

**Zero, e por quê:** a metade do preço já foi paga ao dono no ato da hipoteca (§6.1). Devolver o título ao banco liquida essa dívida — o banco fica com o que financiou. Pagar qualquer coisa a mais seria criar dinheiro para quem já recebeu adiantado pelo mesmo ativo; cobrar qualquer coisa a mais seria punir duas vezes. Zero é o único número que conserva.

**Então o que o jogador ganha?** Duas coisas concretas, e nenhuma delas é caixa:

- **Destrava o país.** Pelo §6.1 não se constrói em nenhuma propriedade de um grupo que contenha propriedade hipotecada. Uma cidade hipotecada que o dono não consegue resgatar congela o grupo inteiro — inclusive as cidades quitadas ao lado dela. Devolvê-la ao banco é a única forma de voltar a construir sem pagar o resgate.
- **Livra do peso morto.** Hipotecada não cobra aluguel (§6.1) e continua entrando no patrimônio para efeito de Auditoria Fiscal e Crise Imobiliária. É um ativo que só custa.

**Travas, e o que cada uma existe para impedir:**

1. **Só na própria vez, com a partida em andamento e sem pausa** — é uma decisão de gestão de portfólio, não uma reação.
2. **Bloqueada com dívida pendente** (§9.1). Sem esta trava a decisão viraria a porta dos fundos da falência: o devedor derrubaria o próprio `liquidationValue` devolvendo títulos ao banco até ficar "insolvente" e declararia falência com o credor recebendo menos do que os ativos valiam. É a mesma proteção de credor que a §8.5/[D-058](D-058-troca-e-livre-ate-o-esvaziamento.md) aplica à troca, pelo mesmo motivo, e não é uma restrição incidental: é o que separa esta decisão de um exploit.
3. **A trava de esvaziamento (§8.5) não se aplica**, e isto é deliberado. Ela existe para impedir **doação** entre jogadores — transferir patrimônio a um aliado por nada. Devolver ao banco não beneficia jogador nenhum: o título vira terreno livre que **qualquer um** pode comprar caindo nele, inclusive quem devolveu. Não há donatário, então não há doação.

**Custo aceito:** a contagem de terrenos livres passa a poder **subir** por ação voluntária de um jogador, o que re-arma o episódio de escassez (§7.5) e pode adiar um pregão que estava a um terreno de disparar. É o mesmo efeito que a desistência (§9.6) já tem, tratado pelo mesmo caminho — `sell-to-bank` entra na tabela de comandos que reavaliam a contagem. Um jogador poderia, em teoria, devolver terrenos só para postergar o pregão; o preço disso é abrir mão de metade do valor de um ativo por rodada de adiamento, e ninguém paga isso duas vezes.

**Como aplicar:** SRS ganha a **§6.4 "Devolução de Propriedade Hipotecada ao Banco"** e a §6.1 passa a apontar para ela como saída alternativa ao resgate; §9.1 registra a trava de dívida pendente. SRS v1.25. Motor — `sellMortgagedToBank` em `economy/mortgage.ts` (guarda `canSellMortgagedToBank`: própria, hipotecada, jogador da vez, sem dívida pendente), comando `sell-to-bank` em `commands.ts` com ator `'active'`, entrada em `LAND_TRIGGERING`, e o título volta ao estado de terreno livre pela MESMA limpeza que a desistência usa (`mortgaged`/`hangar`/construção zerados). Log — evento `sell-to-bank` (§12.3), com `amount: 0` explícito: um valor zero registrado é diferente de um fato não registrado ([D-063](D-063-toda-mutacao-de-caixa-tem-causa-registrada.md)).
