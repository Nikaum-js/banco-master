# Implementation Plan: Convite por QR Code e compartilhamento

**Branch**: `main` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/052-convite-qr-compartilhamento/spec.md`

## Summary

Adicionar ao bloco de convite existente um diálogo acessível com QR Code gerado localmente, compartilhamento pelo Web Share API e fallback de cópia/WhatsApp. `roomLink()` continua sendo a fonte única da URL. A matriz QR será produzida por `uqr`, biblioteca ESM pequena, tipada e sem dependências de runtime; a interface desenha o SVG no próprio React e nunca envia o link para fora.

## Technical Context

**Language/Version**: TypeScript 6, React 19, HTML/CSS

**Primary Dependencies**: Vite 8, `motion`, componentes `Overlay`/`ModalShell`/`ModalHeader`, `uqr`

**Storage**: Nenhum armazenamento novo; clipboard e share sheet são capacidades efêmeras do navegador

**Testing**: Vitest 4 + Testing Library + Playwright 1.62 + axe

**Target Platform**: Navegadores desktop/mobile modernos; mínimo visual do jogo em 740×360 paisagem

**Project Type**: SPA web multipágina (entrada do jogo em `/play`)

**Performance Goals**: QR renderizado instantaneamente para links curtos; nenhum request externo; dependência carregada somente com a superfície do jogo

**Constraints**: preservar link, lobby, autenticação e segurança; manter teclado/AA; não criar integração Discord; não redesenhar a tela

**Scale/Scope**: um diálogo, uma matriz QR e duas estratégias de compartilhamento por sala

## Constitution Check

*GATE antes e depois do design: aprovado.*

- **I — SRS absoluto**: nenhuma regra de jogo muda; o convite continua a credencial de entrada do §11.2.
- **II — Discovery antes do código**: spec aprovada e clarificada; este plano precede implementação.
- **III–VI**: Tesouro, catch-up, cooperação e cartas não são tocados.
- **VII — Resiliência**: falha/cancelamento de share ou clipboard não afeta sessão nem estado da sala.
- **Privacidade**: o QR é local e contém somente o mesmo link já exibido; zero serviço externo.
- **Acessibilidade**: reutiliza o único trap/foco/restauração de diálogo do projeto.

Rechecagem pós-design: os contratos não introduzem exceção constitucional.

## Project Structure

### Documentation (this feature)

```text
specs/052-convite-qr-compartilhamento/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── invite-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/net/
├── invite.ts
└── ui/
    ├── LobbyScreen.tsx
    └── RoomInviteDialog.tsx

tests/
├── net/invite.test.ts
├── ui/roomInviteDialog.test.tsx
└── e2e/room-invite.spec.ts

src/index.css
package.json
bun.lock
```

**Structure Decision**: regras puras de payload/capacidade ficam em `src/net/invite.ts`; o componente isolado concentra o diálogo; `LobbyScreen` apenas mantém a ação existente e abre a nova superfície.

## Design

1. `roomShareData(link)` retorna título, texto e URL; o componente passa o objeto sem remontar a URL.
2. `roomQr(link)` chama o encoder local com correção M e devolve payload/matriz. O SVG usa retângulos React e quiet zone de quatro módulos.
3. `isShareCancellation(error)` classifica `AbortError`; demais erros alimentam um `role="status"`/`role="alert"` discreto.
4. `whatsappShareUrl(link)` cria `https://wa.me/?text=` com uma única chamada a `encodeURIComponent`.
5. `RoomInviteDialog` usa `Overlay dismissible`, herdando foco inicial, trap, `Escape`, restauração e reduced motion.
6. O botão existente continua copiando; a nova ação abre o diálogo. Ações dentro dele compartilham o mesmo helper de clipboard e feedback.

## Complexity Tracking

Nenhuma violação constitucional ou camada arquitetural adicional.
