# Pesquisa: convite por QR Code e compartilhamento

## Decisões

### Encoder QR

**Decisão:** usar `uqr` e seu `encode()` para obter a matriz, desenhada como SVG pelo React.

**Por quê:** pacote ESM, TypeScript, sem dependências de runtime e com API de matriz que evita `dangerouslySetInnerHTML`, canvas e serviço externo. Mantém o payload inspecionável em teste.

**Alternativas consideradas:**

- API externa de QR: rejeitada porque expõe a credencial da sala.
- Implementar QR do zero: rejeitada; correção de erro, máscaras e codificação não são domínio do produto.
- Pacote orientado somente a canvas/data URL: rejeitado porque dificulta teste sem trazer benefício visual.

### Compartilhamento

**Decisão:** feature detection em `navigator.share`, sem detecção de dispositivo. Título, texto e URL vão em campos separados.

**Por quê:** o share sheet é quem enumera destinos instalados. O produto não precisa conhecer WhatsApp/Discord no caminho nativo.

### Fallback

**Decisão:** clipboard + `https://wa.me/?text=<mensagem codificada>` e orientação textual para Discord.

**Por quê:** WhatsApp documenta um fluxo web de texto; Discord não oferece URL universal para preencher uma mensagem em canal escolhido.

### Modal e acessibilidade

**Decisão:** `Overlay dismissible` + `ModalShell` + `ModalHeader`.

**Por quê:** essa composição já é a fonte única de `role="dialog"`, nome acessível, foco inicial, trap, `Escape`, retorno ao gatilho e reduced motion.

## Riscos mitigados

- O link nunca é concatenado fora de `roomLink()`.
- Cancelamento não vira erro.
- O QR inclui quiet zone e contraste preto/branco independente do tema.
- O SVG não tem nós por pixel: um retângulo por módulo escuro é suficiente para o tamanho do payload.
- Falha de clipboard mantém o link selecionável/visível.
