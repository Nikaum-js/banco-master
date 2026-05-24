// Ícones de propriedade do mapa Cidade da Fuligem (055/D-069) — o disco que ocupa, nas
// propriedades SEM bandeira, o lugar que o `FlagAvatar` ocupa no mapa Cidades do Mundo.
// Traço simples em `currentColor` sobre placa de ferro: fábrica, chaminé, trem, engrenagem,
// lâmpada, prédio… nada decorativo além do símbolo (FR-006).
import type { PropertyIconId } from '@/lib/boardData'

// ViewBox 24×24, stroke 1.8, formas fechadas simples — legíveis a 20px.
const ICON_PATHS: Record<PropertyIconId, React.ReactNode> = {
  chimney: (
    <>
      <path d="M9 20V8h2.5V5h3v15" />
      <path d="M6 20h12" />
      <path d="M12.5 3.2c1.4-.9 2.6.4 4 .1" opacity="0.7" />
    </>
  ),
  factory: (
    <>
      <path d="M4 20V10l5 3v-3l5 3v-3l6 3.6V20Z" />
      <path d="M6 10V5h2.6v6.6" />
    </>
  ),
  // BIGORNA — a assimetria É o ícone. A versão anterior era simétrica (bloco largo afunilando
  // num pé), e por isso lia como CÁLICE ou troféu: sem o CHIFRE de um lado, nada distingue uma
  // bigorna de uma taça. Agora são três marcas — bloco com chifre à esquerda, cintura estreita,
  // pé alargado — e a silhueta fecha o reconhecimento sozinha.
  anvil: (
    <>
      <path d="M19.6 7.4H6.6L2 10l4.6 2.6h13z" />
      <path d="M11.4 12.6h4.2v2.2l2.9 3.4H8.5l2.9-3.4z" />
      <path d="M6.4 19.8h11.2" />
    </>
  ),
  crane: (
    <>
      <path d="M5 20V7l12-3" />
      <path d="M5 11l9-2.6" />
      <path d="M17 4v5.4" />
      <path d="M17 9.4v3.2m0 0a1.6 1.6 0 1 0 .01 0Z" />
      <path d="M3 20h6" />
    </>
  ),
  house: (
    <>
      <path d="M4.5 11.5 12 5l7.5 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
      <path d="M10.3 19v-4.6h3.4V19" />
    </>
  ),
  // ENGRENAGEM — DENTES, não raios. A versão anterior tinha um aro fino com oito linhas
  // radiando para fora, e isso é a receita de um SOL: raio aponta para longe do centro,
  // dente é um bloco curto colado no aro. Trocar linha por tacão resolve sem mudar o
  // referente. Cubo vazado no meio, que nenhum sol tem.
  gear: (
    <>
      <circle cx="12" cy="12" r="6.4" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3.4v2.4M12 18.2v2.4M3.4 12h2.4M18.2 12h2.4" strokeWidth="2.8" />
      <path d="m6.1 6.1 1.7 1.7m8.4 8.4 1.7 1.7m0-11.8-1.7 1.7M7.8 16.2l-1.7 1.7" strokeWidth="2.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="11" r="6.5" />
      <path d="M12 7.4V11l2.6 1.8" />
      <path d="M9 20h6M10.2 17.4 9 20m4.8-2.6L15 20" />
    </>
  ),
  train: (
    <>
      <rect x="5.5" y="5" width="13" height="10.5" rx="2" />
      <path d="M5.5 11h13" />
      <circle cx="9" cy="18.4" r="1.3" />
      <circle cx="15" cy="18.4" r="1.3" />
      <path d="M8 8h3" />
    </>
  ),
  lamp: (
    <>
      <path d="M8.6 9.4a3.4 3.4 0 1 1 6.8 0c0 2-1.6 2.6-1.6 4.2h-3.6c0-1.6-1.6-2.2-1.6-4.2Z" />
      <path d="M10.4 16h3.2M11 18.4h2" />
    </>
  ),
  building: (
    <>
      <rect x="7" y="4.5" width="10" height="15.5" />
      <path d="M9.6 8h1.6M12.8 8h1.6M9.6 11.4h1.6M12.8 11.4h1.6M9.6 14.8h1.6M12.8 14.8h1.6" />
      <path d="M10.8 20v-2.6h2.4V20" />
    </>
  ),
  bank: (
    <>
      <path d="M4.5 9.5 12 5l7.5 4.5" />
      <path d="M6.5 10.5V17M10.2 10.5V17M13.8 10.5V17M17.5 10.5V17" />
      <path d="M5 19.5h14" />
    </>
  ),
  mansion: (
    <>
      <path d="M5 20v-8l3-2.6V20M19 20v-8l-3-2.6V20" />
      <path d="M8 9l4-3.6L16 9" />
      <path d="M10.5 20v-3.4h3V20" />
      <path d="M4 20h16" />
    </>
  ),
  // FORNO DE OLARIA — a fornalha abobadada de tijolo, com a boca de fogo e a fumaça
  // saindo pelo topo. Diz "olaria", que `chimney` (só a chaminé) não dizia.
  kiln: (
    <>
      <path d="M6 20v-6.5a6 6 0 0 1 12 0V20Z" />
      <path d="M4.5 20h15" />
      <path d="M10 20v-3.2a2 2 0 0 1 4 0V20" />
      <path d="M12 7.5V5" />
      <path d="M9.6 4.2c1-.8 1.8.5 2.8-.2M14.4 4.6c-.9-.7-1.7.4-2.6-.2" opacity="0.7" />
    </>
  ),
  // CARRETEL DE LINHA — a tecelagem da Vila Bonfim. Substitui o desenho de TEAR, que era a
  // máquina certa e o ícone errado: a armação com os fios da urdidura lia como CERCA ou ábaco,
  // porque a 20px uma grade de linhas paralelas é só uma grade. O carretel ganha por SILHUETA —
  // os dois flanges e a cintura fazem um contorno que nenhum outro objeto do conjunto tem, e
  // silhueta sobrevive ao tamanho que o detalhe interno não sobrevive.
  loom: (
    <>
      <path d="M6.4 4.2h11.2v3.2H6.4z" />
      <path d="M6.4 16.6h11.2v3.2H6.4z" />
      <path d="M9.6 7.4h4.8v9.2H9.6z" />
      <path d="M9.6 10.6h4.8M9.6 13.6h4.8" opacity="0.55" />
    </>
  ),
  // DESVIO (chave/agulha) — o trilho que se BIFURCA. Três marcas só: a linha que passa,
  // a que se desgarra e um trio de dormentes para dizer "ferrovia" em vez de "seta".
  // A versão anterior tinha oito marcas em 24px (trilho + 4 dormentes + diagonal + haste
  // + bola da alavanca) e a 20px virava rabisco. Menos marca lê mais.
  switch: (
    <>
      <path d="M2.5 17.5h19" />
      <path d="M9 17.5c4 0 6-4.4 11.5-9" />
      <path d="M4.5 20.4v-4M8 20.4v-4M11.5 20.4v-4" opacity="0.6" />
    </>
  ),
  // MONTANHA — o "ALTO" do Alto do Desvio. Duas marcas: a silhueta de picos gêmeos e a calota
  // de neve. Substitui o `switch` (a agulha ferroviária) no bairro: a agulha era precisa como
  // ofício, mas a 20px lia como rabisco, e o nome do bairro já anuncia altura. Ícone que não
  // se reconhece não informa nada — precisão que não sobrevive ao tamanho é desperdício.
  mountain: (
    <>
      <path d="M1.8 19.6 9.4 5.6l5.2 7.9 3.1-4.4 4.7 10.5Z" />
      <path d="M6.6 13.6 9.4 9.4l2.8 4.2" />
    </>
  ),
  // USINA / LUZ ELÉTRICA — a LÂMPADA incandescente, com rosca e raios. Terceira tentativa neste
  // slot, e as duas anteriores ensinaram a mesma coisa: silhueta manda mais que referente. O
  // galpão-com-turbina lia como "caixa com antenas"; a torre de transmissão, com pernas
  // convergindo e travessas horizontais, lia como CONE DE TRÂNSITO; o raio sobre a água era
  // abstrato demais a 19px. A lâmpada é o símbolo de eletricidade que ninguém precisa decifrar,
  // e é da época certa (Edison, 1879, dentro da janela do mapa). `lamp` continua sendo o
  // lampião a GÁS — a tecnologia que este bairro substituiu; são objetos diferentes de propósito.
  powerhouse: (
    <>
      <path d="M8.4 10.4a3.6 3.6 0 1 1 7.2 0c0 1.9-1.4 2.7-1.6 4.2h-4c-.2-1.5-1.6-2.3-1.6-4.2Z" />
      <path d="M10.1 16.6h3.8M10.7 18.8h2.6" />
      <path d="M12 3.4V2M5.9 6.1 4.9 5.1M18.1 6.1l1-1" opacity="0.7" />
    </>
  ),
}

/** Só a arte do ícone (sem disco) — para caber dentro de círculos que já existem,
 * como o avatar da casa e o cabeçalho da escritura. */
export function PropertyIconArt({ icon, size = 20 }: { icon: PropertyIconId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[icon]}
    </svg>
  )
}

/** Disco de ícone — mesma pegada visual do `FlagAvatar` (32px cravado na borda interna). */
export function PropertyIconDisc({ icon, className }: { icon: PropertyIconId; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 32,
        height: 32,
        borderRadius: '9999px',
        background: 'color-mix(in srgb, var(--color-ink-abyss) 88%, var(--color-brass))',
        border: '1px solid color-mix(in srgb, var(--color-brass) 55%, transparent)',
        boxShadow: 'var(--shadow-card)',
        color: 'var(--color-brass)',
      }}
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[icon]}
      </svg>
    </span>
  )
}
