import type { ReactNode } from 'react'
import type { AvatarId } from './playerAvatarCatalog'

const INK = 'var(--color-ink-950)'
const BRASS = 'var(--color-brass)'

function tone(color: string, amount: number, mix: string) {
  return `color-mix(in srgb, ${color} ${amount}%, ${mix})`
}

function Shadow({ rx = 39, cy = 140 }: { rx?: number; cy?: number }) {
  return <ellipse className="avatar-shadow" cx="80" cy={cy} rx={rx} ry="7" fill="rgb(0 0 0 / 0.35)" />
}

function ClassicAlive({ color }: { color: string }) {
  return (
    <g className="avatar-classic">
      <Shadow />
      <g className="avatar-classic__body">
        <circle cx="80" cy="78" r="51" fill={color} stroke={INK} strokeWidth="6" />
        <ellipse
          cx="63"
          cy="54"
          rx="20"
          ry="12"
          fill={tone(color, 68, '#fff2c8')}
          opacity="0.58"
        />
        <g className="avatar-expressive avatar-classic__eyes">
          <ellipse cx="61" cy="77" rx="9" ry="8.5" fill="#fffdf7" />
          <ellipse cx="99" cy="77" rx="9" ry="8.5" fill="#fffdf7" />
          <g className="avatar-classic__pupils">
            <circle cx="62" cy="78" r="3.6" fill={INK} />
            <circle cx="100" cy="78" r="3.6" fill={INK} />
            <circle cx="60.8" cy="76.8" r="1" fill="#fff" />
            <circle cx="98.8" cy="76.8" r="1" fill="#fff" />
          </g>
        </g>
        <path
          className="avatar-expressive avatar-classic__mouth"
          d="M57 101 Q80 120 103 101"
          fill="none"
          stroke={INK}
          strokeWidth="5.5"
          strokeLinecap="round"
        />
      </g>
    </g>
  )
}

function OrbitalEyes({ color }: { color: string }) {
  const light = tone(color, 56, '#fff6d4')
  const dark = tone(color, 64, '#2b1805')

  return (
    <g className="avatar-orbital">
      <Shadow rx={36} cy={137} />
      <path
        className="avatar-orbital__orbit"
        d="M23 77 Q80 16 137 77 Q80 138 23 77 Z"
        fill="none"
        stroke={BRASS}
        strokeWidth="1.5"
        strokeDasharray="4 6"
        opacity="0.48"
      />
      <g className="avatar-orbital__eye avatar-orbital__eye--left">
        <circle cx="52" cy="72" r="29" fill={dark} stroke={INK} strokeWidth="5" />
        <circle cx="52" cy="72" r="24.5" fill={color} />
        <ellipse cx="43" cy="57" rx="8" ry="4" fill={light} opacity="0.62" />
        <g className="avatar-expressive avatar-orbital__expression">
          <ellipse cx="52" cy="73" rx="14" ry="17" fill="#fffdf7" />
          <circle cx="55" cy="75" r="6" fill={INK} />
          <circle cx="53" cy="72" r="1.7" fill="#fff" />
        </g>
      </g>
      <g className="avatar-orbital__eye avatar-orbital__eye--right">
        <circle cx="108" cy="72" r="29" fill={dark} stroke={INK} strokeWidth="5" />
        <circle cx="108" cy="72" r="24.5" fill={color} />
        <ellipse cx="99" cy="57" rx="8" ry="4" fill={light} opacity="0.62" />
        <g className="avatar-expressive avatar-orbital__expression">
          <ellipse cx="108" cy="73" rx="14" ry="17" fill="#fffdf7" />
          <circle cx="111" cy="75" r="6" fill={INK} />
          <circle cx="109" cy="72" r="1.7" fill="#fff" />
        </g>
      </g>
      <path
        className="avatar-expressive avatar-orbital__mouth"
        d="M67 113 Q80 123 93 113"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </g>
  )
}

function SingleLine({ color }: { color: string }) {
  const path = 'M45 121 C29 106 27 75 37 53 C48 28 78 22 101 33 C126 45 135 75 123 100 C114 120 95 132 77 129'

  return (
    <g className="avatar-single-line">
      <Shadow rx={35} />
      <g className="avatar-single-line__body">
        <path
          d={path}
          fill="none"
          stroke={INK}
          strokeWidth="17"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.84"
        />
        <path
          className="avatar-single-line__stroke"
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
        />
        <path
          d="M41 57 C52 42 66 36 82 35"
          fill="none"
          stroke={tone(color, 64, '#fff8dc')}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.68"
        />
        <g className="avatar-expressive avatar-single-line__eyes">
          <path d="M48 77 Q60 65 72 77 Q60 88 48 77 Z" fill="#fffdf7" stroke={INK} strokeWidth="2.5" />
          <path d="M88 77 Q100 65 112 77 Q100 88 88 77 Z" fill="#fffdf7" stroke={INK} strokeWidth="2.5" />
          <g className="avatar-single-line__pupils">
            <circle cx="61" cy="77" r="4" fill={INK} />
            <circle cx="101" cy="77" r="4" fill={INK} />
            <circle cx="59.8" cy="75.8" r="1" fill="#fff" />
            <circle cx="99.8" cy="75.8" r="1" fill="#fff" />
          </g>
        </g>
        <g className="avatar-expressive avatar-single-line__mouth">
          <path d="M58 102 Q80 121 103 101" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
          <path d="M59 101 Q80 116 102 100" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
    </g>
  )
}

function PrismFace({ color }: { color: string }) {
  const light = tone(color, 68, '#fff5c6')
  const mid = tone(color, 75, '#6f4510')
  const dark = tone(color, 52, '#1c1420')

  return (
    <g className="avatar-prism">
      <Shadow rx={38} />
      <g className="avatar-prism__body">
        <polygon
          points="80,22 123,49 119,103 80,136 41,108 34,55"
          fill={color}
          stroke={INK}
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <polygon points="80,22 80,77 34,55" fill={light} opacity="0.75" />
        <polygon points="80,22 123,49 80,77" fill={mid} opacity="0.68" />
        <polygon points="34,55 80,77 41,108" fill={tone(color, 72, '#96712b')} opacity="0.74" />
        <polygon points="123,49 119,103 80,77" fill={dark} opacity="0.45" />
        <polygon points="41,108 80,77 80,136" fill={tone(color, 62, '#46341b')} opacity="0.45" />
        <polygon points="80,77 119,103 80,136" fill={mid} opacity="0.62" />
        <polygon
          className="avatar-prism__glint"
          points="53,39 78,29 68,51 46,60"
          fill="#fffbe7"
          opacity="0.38"
        />
        <g className="avatar-expressive avatar-prism__eyes">
          <polygon points="45,74 59,64 74,74 59,84" fill="#fffdf7" stroke={INK} strokeWidth="2.3" />
          <polygon points="86,74 101,64 116,74 101,84" fill="#fffdf7" stroke={INK} strokeWidth="2.3" />
          <g className="avatar-prism__pupils">
            <circle cx="60" cy="74" r="4" fill={INK} />
            <circle cx="102" cy="74" r="4" fill={INK} />
            <circle cx="58.8" cy="72.8" r="1" fill="#fff" />
            <circle cx="100.8" cy="72.8" r="1" fill="#fff" />
          </g>
        </g>
        <path
          className="avatar-expressive avatar-prism__mouth"
          d="M55 101 L69 112 L80 106 L91 112 L105 100"
          fill="none"
          stroke={INK}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  )
}

function TotemFace({ color }: { color: string }) {
  const light = tone(color, 70, '#fff2bd')
  const dark = tone(color, 58, '#291800')

  return (
    <g className="avatar-totem">
      <Shadow rx={36} cy={143} />
      <g className="avatar-totem__top">
        <path
          d="M52 31 L108 31 L120 47 L111 59 L49 59 L40 47 Z"
          fill={dark}
          stroke={INK}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M57 37 H103 L109 45 H51 Z" fill={light} opacity="0.62" />
      </g>
      <g className="avatar-totem__middle">
        <path
          d="M34 62 Q34 55 42 55 H118 Q126 55 126 63 V98 Q126 105 118 105 H42 Q34 105 34 97 Z"
          fill={color}
          stroke={INK}
          strokeWidth="5.5"
        />
        <g className="avatar-expressive avatar-totem__eyes">
          <rect x="43" y="67" width="30" height="26" rx="7" fill="#fffdf7" stroke={INK} strokeWidth="2.3" />
          <rect x="87" y="67" width="30" height="26" rx="7" fill="#fffdf7" stroke={INK} strokeWidth="2.3" />
          <g className="avatar-totem__pupils">
            <rect x="55" y="73" width="8" height="14" rx="4" fill={INK} />
            <rect x="99" y="73" width="8" height="14" rx="4" fill={INK} />
            <circle cx="57" cy="76" r="1.3" fill="#fff" />
            <circle cx="101" cy="76" r="1.3" fill="#fff" />
          </g>
        </g>
      </g>
      <g className="avatar-totem__bottom">
        <path
          d="M48 109 H112 L119 124 L108 138 H52 L41 124 Z"
          fill={dark}
          stroke={INK}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <g className="avatar-expressive avatar-totem__mouth">
          {[0, 1, 2, 3, 4].map((bar) => (
            <rect
              key={bar}
              className={`avatar-totem__bar avatar-totem__bar--${bar + 1}`}
              x={59 + bar * 10}
              y="119"
              width="5"
              height="9"
              rx="2.5"
              fill={bar === 2 ? '#fffdf7' : color}
            />
          ))}
        </g>
      </g>
    </g>
  )
}

function AsleepExpression() {
  return (
    <g className="avatar-asleep-face">
      <path d="M47 76 Q58 84 69 76" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M91 76 Q102 84 113 76" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M68 109 H92" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  )
}

const ARTWORK: Record<AvatarId, (color: string) => ReactNode> = {
  'classic-alive': (color) => <ClassicAlive color={color} />,
  'orbital-eyes': (color) => <OrbitalEyes color={color} />,
  'single-line': (color) => <SingleLine color={color} />,
  'prism-face': (color) => <PrismFace color={color} />,
  'totem-face': (color) => <TotemFace color={color} />,
}

export function AvatarArtwork({
  id,
  color,
  asleep = false,
}: {
  id: AvatarId
  color: string
  asleep?: boolean
}) {
  return (
    <>
      {ARTWORK[id](color)}
      {asleep && <AsleepExpression />}
    </>
  )
}
