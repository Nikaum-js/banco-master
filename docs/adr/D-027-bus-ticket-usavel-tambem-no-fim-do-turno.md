# D-027 — Bus Ticket usável também no fim do turno

**Data:** 2026-05-27 · **Status:** aceita
**Decisão:** O Bus Ticket guardado, que só podia ser usado **antes de rolar**, passa a poder ser usado **também no fim do turno** (depois de resolver a casa onde caiu): rolar → comprar → usar o ticket → cair noutra casa do mesmo lado → comprar. Mantém o uso pré-rolagem. Regras do salto inalteradas (mesmo lado, **não** cruza o GO, gasta 1 ticket, sem nova rolagem).
**Por quê:** dá agência tática — o jogador aproveita a jogada normal **e** o salto no mesmo turno, em vez de escolher um ou outro antes de rolar.
**Como aplicar:** `turnMachine.ts` (`useBusTicket` aceita `'aguardando-finalizacao'`), UI (pílula do HUD + `showBusArmed` no `ModalLayer` nesse estado). SRS §10.7 atualizado. Spec 034.
