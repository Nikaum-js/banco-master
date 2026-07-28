# Data Model: Avatares finais

## Avatar

Identificador público e fechado da forma visual do jogador.

```text
AvatarId =
  classic-alive
  orbital-eyes
  single-line
  prism-face
  totem-face
```

### Regras

- `classic-alive` é o default e fallback.
- Qualquer valor desconhecido normaliza para `classic-alive`.
- O catálogo é global e não tem disponibilidade por sala.
- `liquid-form` não é valor válido.

## Skin

Identificador público e fechado da camada visual aplicada ao Avatar.

```text
SkinId =
  careca
  cavanhaque
  topete
  cartola
  safari
  aviador
  robo
  astronauta
```

### Regras

- `careca` é o default e fallback sem camada adicional.
- Qualquer valor desconhecido normaliza para `careca`.
- Toda Skin é compatível com todo Avatar; não existe tabela de disponibilidade.
- A Skin complementa a forma e nunca substitui o `PlayerFace`.

## Assento

Adiciona:

```text
avatar?: AvatarId
skin?: SkinId
```

O campo permanece opcional no type persistido para absorver salas legadas; após `normalizeRoom`, toda leitura interna recebe um `AvatarId` válido.

### Validação

- Pedido novo com ids válidos preserva os valores.
- Pedido novo com id inválido recebe o fallback daquela dimensão; não cria erro de entrada.
- Dois assentos podem compartilhar o mesmo avatar, a mesma skin ou a mesma combinação.
- Cor continua validada pela paleta fechada e exclusiva.

### Ciclo de vida

```text
escolha no formulário
  → pedido de assento
  → validação/normalização pela autoridade
  → Seat persistido
  → PublicSeat difundido
  → identidade de exibição
  → PlayerFace
```

Reload, reassunção, snapshot e reentrada carregam o mesmo `Seat.avatar` e `Seat.skin`.

## Identidade de exibição

Adiciona `avatar: AvatarId` e `skin: SkinId` à projeção existente `playerId + name + color`. Sem sala ou sem assento, o fallback determinístico usa Clássico Vivo + Careca.
