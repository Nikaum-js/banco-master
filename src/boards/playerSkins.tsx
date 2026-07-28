import type { SkinId } from './playerSkinCatalog'

const INK = 'var(--color-ink-950)'
const BRASS = 'var(--color-brass)'
const HAIR = '#33241a'

function tone(color: string, amount: number, mix = '#120c08') {
  return `color-mix(in srgb, ${color} ${amount}%, ${mix})`
}

function BehindSkin({ id, color }: { id: SkinId; color: string }) {
  switch (id) {
    case 'aviador':
      return (
        <g className="skin-aviator__behind">
          <path d="M37 55 Q22 72 31 104 Q46 94 48 68 Z" fill="#4a3323" stroke={INK} strokeWidth="5" />
          <path d="M123 55 Q138 72 129 104 Q114 94 112 68 Z" fill="#4a3323" stroke={INK} strokeWidth="5" />
        </g>
      )
    case 'robo':
      return (
        <g className="skin-robot__behind">
          <path d="M80 28 V9" stroke={INK} strokeWidth="7" strokeLinecap="round" />
          <circle className="skin-robot__beacon" cx="80" cy="8" r="7" fill="#ff5f8d" stroke={INK} strokeWidth="4" />
          <rect x="24" y="66" width="17" height="31" rx="7" fill={tone(color, 68)} stroke={INK} strokeWidth="5" />
          <rect x="119" y="66" width="17" height="31" rx="7" fill={tone(color, 68)} stroke={INK} strokeWidth="5" />
          <circle cx="32.5" cy="81.5" r="3.5" fill={BRASS} />
          <circle cx="127.5" cy="81.5" r="3.5" fill={BRASS} />
        </g>
      )
    case 'astronauta':
      return (
        <g className="skin-astronaut__behind">
          <circle cx="80" cy="77" r="69" fill="rgba(56, 91, 129, 0.23)" stroke={INK} strokeWidth="7" />
          <circle cx="80" cy="77" r="64" fill="rgba(147, 211, 255, 0.08)" stroke="rgba(214, 238, 255, 0.38)" strokeWidth="3" />
        </g>
      )
    default:
      return null
  }
}

function FrontSkin({ id, color }: { id: SkinId; color: string }) {
  switch (id) {
    case 'cavanhaque':
      return (
        <g className="skin-goatee">
          <path
            d="M53 99 Q66 91 80 100 Q94 91 107 99 Q95 111 80 103 Q65 111 53 99 Z"
            fill={HAIR}
            stroke={INK}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M62 107 Q61 132 80 140 Q99 132 98 107 Q91 122 80 123 Q69 122 62 107 Z"
            fill={HAIR}
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M69 111 Q80 120 91 111" fill="none" stroke="#f5dfc5" strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'topete':
      return (
        <g className="skin-pompadour">
          <path
            d="M34 57 Q39 27 67 23 Q93 18 119 34 Q128 42 123 57 Q104 43 82 45 Q57 44 42 62 Z"
            fill={HAIR}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M80 28 Q105 2 128 23 Q134 32 126 45 Q122 21 91 38 Z"
            fill={HAIR}
            stroke={INK}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path d="M49 43 Q69 28 94 30" fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="5" strokeLinecap="round" />
        </g>
      )
    case 'cartola':
      return (
        <g className="skin-top-hat">
          <path d="M53 43 L50 2 Q80 -5 110 2 L107 43 Z" fill="#17120f" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          <path d="M52 27 H108 L108 40 H52 Z" fill={color} />
          <ellipse cx="80" cy="43" rx="57" ry="11" fill="#17120f" stroke={INK} strokeWidth="5" />
          <path d="M59 8 Q57 16 58 23" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="5" strokeLinecap="round" />
          <path
            d="M80 100 Q68 91 56 98 Q64 110 80 103 Q96 110 104 98 Q92 91 80 100 Z"
            fill={HAIR}
            stroke={INK}
            strokeWidth="2.5"
          />
          <circle cx="104" cy="76" r="17" fill="rgba(255,255,255,0.08)" stroke={INK} strokeWidth="8" />
          <circle cx="104" cy="76" r="17" fill="none" stroke={BRASS} strokeWidth="4" />
          <path d="M117 88 Q127 104 120 124" fill="none" stroke={BRASS} strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'safari':
      return (
        <g className="skin-safari">
          <path d="M38 45 Q41 7 80 6 Q119 7 122 45 Z" fill="#c9b58a" stroke={INK} strokeWidth="5" />
          <path d="M40 31 Q80 22 120 31 L122 45 Q80 36 38 45 Z" fill={color} />
          <ellipse cx="80" cy="46" rx="59" ry="10" fill="#b8a478" stroke={INK} strokeWidth="5" />
          <path d="M54 18 Q69 7 89 11" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="104" cy="31" r="6" fill={BRASS} stroke={INK} strokeWidth="3" />
        </g>
      )
    case 'aviador':
      return (
        <g className="skin-aviator">
          <path
            d="M34 62 Q31 34 48 23 Q80 8 112 23 Q129 34 126 62 Q103 47 80 48 Q57 47 34 62 Z"
            fill="#5c4029"
            stroke={INK}
            strokeWidth="5"
          />
          <path d="M39 43 Q80 25 121 43" fill="none" stroke="#2e2016" strokeWidth="8" strokeLinecap="round" />
          <g className="skin-aviator__goggles">
            <circle cx="58" cy="37" r="15" fill="#7cc3e2" stroke="#2e2016" strokeWidth="6" />
            <circle cx="102" cy="37" r="15" fill="#7cc3e2" stroke="#2e2016" strokeWidth="6" />
            <path d="M73 37 H87" stroke="#2e2016" strokeWidth="7" strokeLinecap="round" />
            <path d="M50 31 Q55 25 62 27" fill="none" stroke="#fff" strokeWidth="4" opacity="0.78" strokeLinecap="round" />
            <path d="M94 31 Q99 25 106 27" fill="none" stroke="#fff" strokeWidth="4" opacity="0.78" strokeLinecap="round" />
          </g>
        </g>
      )
    case 'robo':
      return (
        <g className="skin-robot">
          <path d="M52 43 L63 31 H97 L108 43" fill="none" stroke={tone(color, 64)} strokeWidth="9" strokeLinejoin="round" />
          <rect x="68" y="29" width="24" height="13" rx="4" fill="#101820" stroke={INK} strokeWidth="4" />
          <circle cx="75" cy="35.5" r="2.5" fill="#7ef0ff" />
          <circle cx="85" cy="35.5" r="2.5" fill="#ff5f8d" />
          <path d="M42 91 H51 L57 98" fill="none" stroke={BRASS} strokeWidth="4" strokeLinecap="round" />
          <path d="M118 91 H109 L103 98" fill="none" stroke={BRASS} strokeWidth="4" strokeLinecap="round" />
          <circle cx="42" cy="91" r="4" fill="#7ef0ff" stroke={INK} strokeWidth="2" />
          <circle cx="118" cy="91" r="4" fill="#7ef0ff" stroke={INK} strokeWidth="2" />
          <rect x="66" y="124" width="28" height="12" rx="4" fill="#101820" stroke={INK} strokeWidth="3" />
          <path d="M73 127 V133 M80 127 V133 M87 127 V133" stroke="#6c7a87" strokeWidth="3" />
        </g>
      )
    case 'astronauta':
      return (
        <g className="skin-astronaut">
          <circle cx="80" cy="77" r="66" fill="none" stroke="rgba(226,240,255,0.64)" strokeWidth="4" />
          <path
            className="skin-astronaut__shine"
            d="M38 66 Q45 29 73 18"
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path d="M119 38 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z" fill="#fff" opacity="0.82" />
          <path d="M129 72 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5 Z" fill="#fff" opacity="0.58" />
          <path d="M33 130 Q80 155 127 130 L119 149 Q80 160 41 149 Z" fill={tone(color, 58)} stroke={INK} strokeWidth="6" />
          <path d="M45 134 Q80 148 115 134" fill="none" stroke={BRASS} strokeWidth="7" strokeLinecap="round" />
        </g>
      )
    default:
      return null
  }
}

export function PlayerSkinArtwork({
  id,
  color,
  layer,
}: {
  id: SkinId
  color: string
  layer: 'behind' | 'front'
}) {
  return layer === 'behind'
    ? <BehindSkin id={id} color={color} />
    : <FrontSkin id={id} color={color} />
}
