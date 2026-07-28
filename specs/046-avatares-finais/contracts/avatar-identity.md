# Contract: identidade visual do avatar

## Catálogo público

- `classic-alive` — Clássico Vivo
- `orbital-eyes` — Olhos Orbitais
- `single-line` — Linha Única
- `prism-face` — Prisma
- `totem-face` — Totem

## Catálogo de skins

- `careca` — Careca
- `cavanhaque` — Cavanhaque
- `topete` — Topete
- `cartola` — Cartola
- `safari` — Safári
- `aviador` — Aviador
- `robo` — Robô
- `astronauta` — Astronauta

O contrato é cartesiano: cada item do catálogo de skins é válido com cada item do catálogo de avatares.

## Pedido de assento

```ts
type JoinRequest = {
  name: string
  color: string
  avatar: AvatarId
  skin: SkinId
}
```

O adapter Supabase envia um envelope textual versionado `{ avatar, skin }` pelo parâmetro opcional legado `piece` e o converte novamente antes de sair da fronteira. Payload legado contendo apenas um `AvatarId` normaliza para aquela forma + Careca. O transporte local usa o contrato diretamente.

## Estado de sala

```ts
type Seat = {
  playerId: string
  uid: string
  name: string
  color: string
  avatar?: AvatarId
  skin?: SkinId
  // campos existentes
}
```

`normalizeRoom` garante avatar e skin válidos em memória. `toPublicRoom`, `fromPublicRoom`, snapshot e reentrada preservam os campos como parte pública do assento.

## Formulário

```ts
onSubmit(name: string, color: string, avatar: AvatarId, skin: SkinId): void
```

Avatar e Skin têm grupos separados. Cada opção é um botão com `aria-pressed`, nome acessível e alvo mínimo de 44×44px. O preview e as miniaturas usam o `PlayerFace` canônico e preservam a escolha do outro grupo.

## Renderização

Toda superfície com `playerId` consulta `identityOf(room, playerId)` e passa `color + avatar + skin` para `PlayerFace`. Superfícies sem sala usam `fallbackIdentity`.
