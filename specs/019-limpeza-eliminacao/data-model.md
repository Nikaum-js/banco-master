# Data Model: Limpeza na eliminação (§9.4)

## Immunity (estendido — `economy/types.ts`)

```ts
export interface Immunity {
  beneficiaryId: string
  pos: number
  lapsRemaining: number | null
  granterId?: string // quem concedeu (setado no executeTrade) — §9.4
}
```

## Mutações (declareBankruptcy — após eliminar)

```text
s.immunities = filtra fora { granterId === eliminado OU beneficiaryId === eliminado }
s.tempEffects = filtra fora { ownerId === eliminado }
```

(loans já filtrados no 008/010.)

## Invariantes

- Imunidades concedidas/recebidas pelo eliminado: removidas.
- tempEffects originados pelo eliminado: removidos (sem relógio órfão).
- Imunidades/efeitos de terceiros: intactos.
- `granterId` é opcional e só nasce no `executeTrade`; estado serializável.
