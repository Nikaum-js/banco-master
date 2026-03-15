# Research — Revanche na mesma sala

## D1 — A sala precisa de uma geração explícita

**Decision**: adicionar `matchGeneration` monotônico à `Room`, à projeção pública e à linha `public.rooms`.

**Rationale**: `Room.status` sozinho não ordena mensagens. Um `playing` atrasado pode chegar depois do novo `lobby`; a geração permite descartar qualquer sala de ciclo anterior antes de disparar resync.

**Alternatives considered**:

- Inferir pela fase do `GameState`: não distingue snapshot atrasado de revanche vigente.
- Embutir geração em `seats` ou `opening_auction`: persiste sem migration, mas coloca um fato da sala na entidade errada.
- Criar outro id de sala: quebra exatamente o valor solicitado, que é manter link e assentos.

## D2 — `seq` permanece monotônico pela vida inteira da sala

**Decision**: o primeiro snapshot de cada nova partida usa `seq + 1`; não reiniciar em zero.

**Rationale**: o cliente, o decorator `durableWrites`, o adapter local e o trigger SQL já usam `seq` como guarda contra regressão. Manter a sequência elimina a necessidade de acrescentar geração a cada `AcceptedCommand` e impede que comandos tardios da partida anterior sejam aceitos.

**Alternatives considered**:

- Reiniciar `seq` por geração: exigiria mudar todo envelope de comando, replay, resync, fila de escrita e trigger.
- Usar apenas geração: perderia a ordenação fina entre comandos da mesma partida.

## D3 — Reabrir é uma operação de persistência atômica

**Decision**: acrescentar `Transport.reopenRoom(room)` e uma RPC `reopen_room` que valida o host, grava lobby/geração/assentos e limpa `game`/`secrets` na mesma transação, preservando `seq`.

**Rationale**: `saveRoom` atual é parcial por desenho e mantém o snapshot. Se a UI publicasse lobby antes de apagar o jogo, um reload poderia ler a classificação antiga como se ainda fosse a partida vigente. Uma operação explícita mantém o módulo profundo e permite que a Promise represente a gravação real, sem passar pela fila fire-and-forget de atualizações normais.

**Alternatives considered**:

- Reusar `saveRoom`: não limpa snapshot e sua Promise embrulhada resolve no enfileiramento.
- Gravar um `GameState` vazio: inventa uma fase de motor que não existe.
- Apagar a linha e recriá-la: arrisca perder códigos, assentos e autoridade.

## D4 — Sair da classificação é local; reabrir é autoridade do host

**Decision**: `RoomSession.returnToLobby()` fecha o resumo apenas naquele cliente. Para convidado, exibe a mesma sala aguardando. Para host, executa também `Host.reopenRoom()`.

**Rationale**: um convidado não deve apagar o resumo de todos. O host já é a única autoridade e continua sendo o único que prepara a próxima partida.

**Alternatives considered**:

- Primeiro clique de qualquer jogador reabre globalmente: interrompe quem ainda lê o resultado.
- Botão somente para host: deixa convidados presos numa tela que já decidiram fechar.
- Reabrir automaticamente ao fim: elimina o fechamento oficial da D-038.

## D5 — O início da revanche substitui qualquer resumo remanescente

**Decision**: enquanto a sala está em lobby, o resumo pode continuar localmente aberto. Quando a sala passa para `bidding`, `rolling` ou publica um snapshot da nova geração, a sessão segue o fluxo vigente, mesmo que o cliente ainda mostrasse o resultado anterior.

**Rationale**: preserva o ritmo individual sem permitir que uma tela antiga deixe alguém fora da próxima partida.

## D6 — A migration é aditiva e compatível

**Decision**: `match_generation integer not null default 0`; shapes legados normalizam para zero; RPCs existentes ganham overload novo e o cliente passa a usar a assinatura com geração.

**Rationale**: salas e snapshots anteriores continuam válidos. A migration não reescreve identidade nem estado de jogo.
