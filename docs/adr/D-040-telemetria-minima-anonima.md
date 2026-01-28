# D-040 — Telemetria mínima anônima: contagem no Supabase, exceção no Sentry

**Data:** 2026-07-26 · **Status:** aceita

**Decisão:** a v1 passa a registrar **telemetria mínima**, dividida em dois destinos com contratos diferentes:

- **Eventos de produto → tabela própria no Supabase do projeto.** Sala criada, partida iniciada, partida finalizada (com nº de jogadores, rodadas e duração) e partida pausada por causa (§11.3/§11.4). Insert-only, sem leitura pelo cliente. É a resposta para a única pergunta que o lançamento precisa fazer: **as partidas terminam?**
- **Exceções → Sentry.** As falhas que a spec 042 já contém e registra localmente passam a ter destino remoto, carregando o **identificador de ocorrência** que a D-035 criou. É o que transforma "um jogador disse que deu erro" em um stack trace com contexto.

Quatro invariantes acompanham a decisão:

1. **Anônimo por construção.** Nenhum nome de jogador, nenhuma mão de cartas, nenhum token de sessão, nenhum código de reentrada (princípio VI, D-033, D-037). O **id da sala nunca é enviado em claro** — ele é a credencial de acesso (D-019, D-036); o que trafega é um identificador derivado, irreversível, que só serve para correlacionar eventos da mesma partida.
2. **Telemetria não influencia a partida.** Falha de envio não pausa, não bloqueia comando, não repete ação e não vira causa de pausa (a D-034 é sobre o snapshot da partida, não sobre métrica). Perder um evento é perder um evento.
3. **Desligável.** Sem chave configurada no ambiente, o app funciona inteiro e não envia nada. Desenvolvimento não emite.
4. **Contagem, não comportamento.** Os eventos medem partidas, não pessoas: não há perfil, funil por jogador, nem rastreio entre salas.

**Por quê:** o M4 lista "telemetria mínima (partidas iniciadas/finalizadas/erros)" desde o começo, e a 042 deixou explícito o que faltava: ela registra a falha **localmente** e marcou "telemetria de erros em serviço externo" como fora de escopo, por ser decisão de produto e privacidade que ninguém havia tomado. Esta é a decisão.

A divisão em dois destinos é deliberada. Contagem de partidas é dado do produto, mora onde a partida já mora e não justifica um terceiro: a tabela custa uma migration, herda a infra que já existe e mantém o dado do jogador dentro do mesmo perímetro que ele já aceitou ao entrar na sala. Diagnóstico de exceção é outra coisa — precisa de stack, agrupamento por assinatura, alerta e histórico, tudo que uma tabela `insert` não faz e que não vale a pena construir.

A regra do id de sala é a que mais importa. Neste projeto, **o link é a credencial** (D-019) e o servidor autoriza por ele (D-036). Um id de sala num evento de telemetria é uma chave de acesso vazando por um canal que ninguém trata como sensível. O identificador derivado preserva a única propriedade útil — dois eventos da mesma partida se reconhecem — sem carregar a credencial.

**Alternativa descartada — PostHog (produto + erros num serviço só):** menos peças, mais poder analítico. Custa mandar dado de jogador para um terceiro que a arquitetura não precisa ter, ampliar o bundle e criar a tentação exata que a invariante 4 recusa — funil por pessoa. O produto ainda não tem pergunta que exija isso.

**Alternativa descartada — só registro local, sem envio:** custo zero e valor quase zero. Não responde "as partidas terminam" e não sobrevive à aba fechando.

**Alternativa descartada — eventos por comando (todo comando aceito vira evento):** transformaria a telemetria em segundo log de partida, com volume proporcional à mesa e sem pergunta que justifique. O que se quer saber é se a partida chega ao fim, não como cada uma foi jogada.

**Como aplicar:** a spec 044 operacionaliza. O SRS ganha a seção **§12.7 (Telemetria mínima)** e vai a v1.9. O envio acontece atrás de uma porta própria, com adaptador nulo por padrão — a mesma forma da porta `Transport` (D-020) e pelo mesmo motivo: o motor e a sessão não podem saber que telemetria existe. A tabela nasce com RLS de insert anônimo, sem select, no mesmo arquivo de migration que o lançamento aplica.
