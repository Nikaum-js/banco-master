# Quickstart: Uso de Bus Tickets & espaço Bus Ticket

## Verificar

```bash
npx vitest run tests/game/busticket   # testes desta feature
npx vitest run tests/game             # suíte completa do motor (não pode regredir)
npm run build                         # tsc -b + vite, exit 0
npm run dev                           # HUD: "Usar Bus Ticket (N)" quando elegível
```

## Fluxo de uso (motor)

```ts
// jogador da vez, em aguardando-rolagem, fora de canto, com busTickets >= 1
let g = useBusTicket(state, dest, ctx) // dest = casa do mesmo lado, != pos
// → player.pos === dest, busTickets -= 1, turno em 'casa-a-resolver'
g = resolvePending(g, ctx)            // resolve a casa de destino (compra/aluguel/carta/...)
g = finalizeTurn(g, ctx)              // passa a vez (sem re-rolagem)
```

## Cenários-chave (mapeiam SC-001..005)

- **Uso válido**: pos no lado, ticket ≥ 1, dest válido → token em dest, contador −1, `casa-a-resolver`. (SC-001)
- **Inválidos** (estado inalterado): sem ticket; fora da vez; estado ≠ `aguardando-rolagem`; sobre canto (pos ∈ {0,12,24,36}); dest fora do lado ou = pos. (SC-002)
- **Destino resolve normal**: dest = propriedade livre → abre `purchase`; dest = espaço Bus Ticket → +1 ticket. (SC-003)
- **GO ao cruzar**: pos 45 (lado 37–47), dest 38 → avança horário cruzando o GO, credita `onPassGo`. 
- **Sem re-rolagem**: após resolver, `finalizeTurn` passa a vez (não volta para `aguardando-rolagem`). (SC-005)
- **Espaço Bus Ticket**: parar em pos 10 → `busTickets += 1`; apenas passar não credita. (SC-004)

## Arquivos tocados

- `src/game/turn/turnMachine.ts` — `sideOf` + `useBusTicket`
- `src/game/turn/resolution.ts` — handler `'bus-ticket'` (+1 ticket)
- `src/game/store.ts` — comando `useBusTicket(dest)`
- `src/game/ui/GameHUD.tsx` — controle "Usar Bus Ticket"
- `tests/game/busticket/busticket.test.ts` — testes
