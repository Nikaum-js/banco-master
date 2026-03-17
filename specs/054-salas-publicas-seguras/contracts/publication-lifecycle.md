# Contract: Ciclo da publicação

## Transições confiáveis

| Evento | Publicação | Visibilidade | Sala |
|---|---|---|---|
| Sala criada | privada | ausente | inalterada |
| Host publica lobby com vaga | vigente | visível | inalterada |
| Host publica lobby cheio | vigente | oculta | inalterada |
| Última vaga ocupada | vigente | oculta em até 5 s | assentos normais |
| Vaga liberada no lobby | vigente | visível em até 5 s | assentos normais |
| Heartbeat vence 60 s | vigente | oculta até o teto de 90 s | inalterada |
| Heartbeat retorna | vigente | visível se elegível | inalterada |
| Host despublica | encerrada | ausente em até 5 s | inalterada |
| Estado deixa `lobby` | encerrada | ausente em até 5 s | fluxo normal |
| Revanche volta a `lobby` | encerrada | ausente | fluxo normal |
| Host publica revanche | nova publicação | visível se elegível | inalterada |

## Trigger

Toda atualização de `public.rooms` para `status <> 'lobby'` encerra a publicação associada.
Atualização futura para `lobby` não a recria. O trigger não lança erro sobre o fluxo privado
e não depende de existir listing.

## Polling

- consulta inicial ao abrir o diretório;
- novas consultas a cada 5,2 segundos enquanto aberto;
- botão de atualizar respeita o mesmo cooldown;
- filtros não consultam o servidor;
- heartbeat do host a cada 30 segundos enquanto o controle de lobby estiver montado.

Os intervalos são detalhes de cliente; os limites permanecem obrigatórios no servidor.
