import { isFlagCode, type FlagCode } from './countries'

/**
 * Bandeiras dos dez países do tema, desenhadas LOCALMENTE.
 *
 * Antes disto, oito pontos da interface buscavam `https://flagcdn.com/<iso>.svg` em runtime. Três
 * problemas, e nenhum deles é estético:
 *
 *   1. **Rede no caminho de render.** Uma bandeira que não chega deixa um buraco na escritura no
 *      meio de uma decisão de leilão — e a decisão tem cronômetro.
 *   2. **CSP e offline.** Host externo num app que roda sobre Supabase e Vercel é uma origem a
 *      mais para liberar, para sempre, por um ativo de 40px.
 *   3. **Privacidade.** Cada render contava a um terceiro quais cidades estavam em jogo.
 *
 * São **dez** países (AE BR CN DE EG ES FR IT JP US) — o conjunto fechado do tema "Cidades do
 * Mundo". Dez SVGs à mão custam menos que uma dependência, e o resultado é ~2 kB no bundle.
 *
 * **Emblemas são deliberadamente omitidos.** O brasão da Espanha, a águia do Egito, as 27
 * estrelas do Brasil e as 50 dos EUA não sobrevivem a 34px — viram um borrão que suja a cor. O
 * que identifica uma bandeira nesse tamanho é a **composição**: quantas faixas, em que direção,
 * em que cores, com que emblema geométrico. É isso que está desenhado aqui, com as proporções
 * 3:2 corretas. A alternativa honesta seria não mostrar bandeira nenhuma.
 */

// Uma estrela de cinco pontas, em `r` de raio, centrada em (cx, cy). Usada pela China.
function star(cx: number, cy: number, r: number, rotation = -90): string {
  const pts: string[] = []
  for (let i = 0; i < 5; i++) {
    const outer = ((rotation + i * 72) * Math.PI) / 180
    const inner = ((rotation + 36 + i * 72) * Math.PI) / 180
    pts.push(`${cx + r * Math.cos(outer)},${cy + r * Math.sin(outer)}`)
    pts.push(`${cx + r * 0.382 * Math.cos(inner)},${cy + r * 0.382 * Math.sin(inner)}`)
  }
  return pts.join(' ')
}

// Cada bandeira desenha num viewBox 60×40 (3:2). Quem consome recorta em disco.
const FLAGS: Record<FlagCode, React.ReactNode> = {
  // Emirados: barra vermelha à esquerda (1/4) + verde/branco/negro na horizontal.
  AE: (
    <>
      <rect width="60" height="13.34" fill="#00732f" />
      <rect y="13.34" width="60" height="13.33" fill="#fff" />
      <rect y="26.67" width="60" height="13.33" fill="#000" />
      <rect width="15" height="40" fill="#ff0000" />
    </>
  ),
  // Brasil: campo verde, losango amarelo, disco azul. As 27 estrelas somem por tamanho;
  // a faixa branca fica, porque é ela que impede o disco de virar "bola azul".
  BR: (
    <>
      <rect width="60" height="40" fill="#009b3a" />
      <polygon points="30,4 55,20 30,36 5,20" fill="#fedf00" />
      <circle cx="30" cy="20" r="9" fill="#002776" />
      <path d="M21.6 17.2a9 9 0 0 0 16.8 5.6" stroke="#fff" strokeWidth="2.2" fill="none" />
    </>
  ),
  // China: campo vermelho, estrela grande + quatro pequenas em arco.
  CN: (
    <>
      <rect width="60" height="40" fill="#de2910" />
      <polygon points={star(11, 11, 7)} fill="#ffde00" />
      <polygon points={star(21, 5, 2.4)} fill="#ffde00" />
      <polygon points={star(25.5, 9.5, 2.4)} fill="#ffde00" />
      <polygon points={star(25.5, 15.5, 2.4)} fill="#ffde00" />
      <polygon points={star(21, 19.5, 2.4)} fill="#ffde00" />
    </>
  ),
  DE: (
    <>
      <rect width="60" height="13.34" fill="#000" />
      <rect y="13.34" width="60" height="13.33" fill="#dd0000" />
      <rect y="26.67" width="60" height="13.33" fill="#ffce00" />
    </>
  ),
  // Egito: vermelho/branco/negro. A águia de Saladino é substituída por um disco de latão —
  // presença de emblema sem o borrão de um brasão em 34px.
  EG: (
    <>
      <rect width="60" height="13.34" fill="#ce1126" />
      <rect y="13.34" width="60" height="13.33" fill="#fff" />
      <rect y="26.67" width="60" height="13.33" fill="#000" />
      <circle cx="30" cy="20" r="3.6" fill="#c09300" />
    </>
  ),
  // Espanha: vermelho/amarelo(dobro)/vermelho. Brasão omitido.
  ES: (
    <>
      <rect width="60" height="40" fill="#aa151b" />
      <rect y="10" width="60" height="20" fill="#f1bf00" />
    </>
  ),
  FR: (
    <>
      <rect width="20" height="40" fill="#002395" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ed2939" />
    </>
  ),
  IT: (
    <>
      <rect width="20" height="40" fill="#008c45" />
      <rect x="20" width="20" height="40" fill="#f4f5f0" />
      <rect x="40" width="20" height="40" fill="#cd212a" />
    </>
  ),
  JP: (
    <>
      <rect width="60" height="40" fill="#fff" />
      <circle cx="30" cy="20" r="12" fill="#bc002d" />
    </>
  ),
  // EUA: 13 faixas + cantão azul. As 50 estrelas viram uma grade de pontos — em 34px é
  // exatamente o que o olho lê de uma bandeira americana.
  US: (
    <>
      <rect width="60" height="40" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 40) / 13} width="60" height={40 / 13} fill="#b22234" />
      ))}
      <rect width="26" height={(7 * 40) / 13} fill="#3c3b6e" />
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <circle key={`${row}-${col}`} cx={3.4 + col * 5.1} cy={3 + row * 4.6} r="1.1" fill="#fff" />
        )),
      )}
    </>
  ),
}

/**
 * Bandeira do país, em SVG local. `size` é a LARGURA; a altura sai da proporção 3:2.
 *
 * Decorativa por padrão (`aria-hidden`): quem consome sempre mostra o nome do país ou da cidade
 * ao lado, e uma segunda leitura do mesmo fato só atrapalha quem usa leitor de tela. Passe
 * `title` quando a bandeira for a única identificação presente.
 */
export function CountryFlag({
  code,
  size = 24,
  title,
  fill = false,
  className,
  style,
}: {
  code: string
  size?: number
  title?: string
  /**
   * Preenche o contêiner recortando o excesso — o equivalente exato de
   * `<img class="w-full h-full object-cover">`, que é como as cinco molduras existentes
   * consumiam a bandeira remota. `preserveAspectRatio="…slice"` é o `object-cover` do SVG.
   */
  fill?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const upper = code.toUpperCase()
  if (!isFlagCode(upper)) return null
  return (
    <svg
      viewBox="0 0 60 40"
      width={fill ? '100%' : size}
      height={fill ? '100%' : (size * 2) / 3}
      preserveAspectRatio={fill ? 'xMidYMid slice' : undefined}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={className}
      style={{ display: 'block', ...style }}
    >
      {title && <title>{title}</title>}
      {FLAGS[upper]}
    </svg>
  )
}

/**
 * Bandeira recortada em DISCO, com a moldura de tinta que a escritura usa. É a forma que
 * aparece na maioria das superfícies (leilão, troca, popover de propriedade), e ela existia
 * copiada em cinco lugares — cada cópia com uma borda ligeiramente diferente.
 *
 * O SVG é escalado a 1,5× dentro do disco: uma bandeira 3:2 recortada em círculo perde as
 * pontas, e sem o zoom o corte come faixa demais nas verticais (França, Itália).
 */
export function CountryFlagDisc({ code, size = 40, title }: { code: string; size?: number; title?: string }) {
  const upper = code.toUpperCase()
  if (!isFlagCode(upper)) return null
  return (
    <span
      className="rounded-full bg-ink-900 border-2 border-ink-950 overflow-hidden shrink-0 shadow-[var(--shadow-card)] grid place-items-center"
      style={{ width: size, height: size }}
    >
      <CountryFlag code={upper} size={size * 1.5} title={title} />
    </span>
  )
}
