# Contrato do convite

```ts
interface RoomShareData {
  title: string
  text: string
  url: string
}

interface RoomQr {
  payload: string
  matrix: boolean[][]
  size: number
}

function roomShareData(link: string): RoomShareData
function roomQr(link: string): RoomQr
function whatsappShareUrl(link: string): string
function isShareCancellation(error: unknown): boolean
```

## Invariantes observáveis

- `roomShareData(roomLink(id)).url === roomLink(id)`.
- `roomQr(link).payload === link`.
- `roomQr` não executa `fetch`, cria `Image` remoto nem referencia host de QR.
- `navigator.share` recebe exatamente `roomShareData(link)`.
- `isShareCancellation(new DOMException('', 'AbortError')) === true`.
- A query `text` do WhatsApp, após uma decodificação, contém mensagem e link completos.
- Sem `navigator.share`, nenhuma ação visual sugere compartilhamento direto para Discord.
