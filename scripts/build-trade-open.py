#!/usr/bin/env python3
"""Sintetiza o cue `trade-open` (spec 058/US8) — OBRA PRÓPRIA, sem fonte de terceiro.

Por que sintetizar em vez de baixar: os 40 cues existentes vêm de packs royalty-free
(Kenney CC0, Mixkit, Freesound CC0) e cada um está mapeado em `src/assets/sfx/README.md`.
Um cue novo exigiria escolher, baixar e auditar mais uma fonte. Gerando aqui, a origem é o
próprio repositório e a licença é a do projeto — verificável por construção, e reproduzível
por qualquer pessoa que rode este arquivo.

DIREÇÃO SONORA (o briefing): "contrato/papel sendo manuseado + clique sutil de ficha,
caneta ou carimbo". Divertido, de mesa de jogo, sem beep eletrônico, e que NÃO se confunda
com compra (registradora), leilão (martelo) ou pagamento (moedas).

    0–210ms   folha de papel: ruído em banda 1,8–7 kHz com micro-crepitações — o
              atrito de fibra que faz "papel" ser papel, e não "vento".
    165ms     carimbo: batida curta com corpo grave (~150 Hz) e estalo de madeira.
    195ms     ficha de baquelite: dois parciais agudos decaindo rápido, o "toc" seco
              que o jogador já associa a peça de tabuleiro.

Material = domínio, como manda `SOUND-DESIGN.md`: papel é o material de DOCUMENTO (mesma
família de mortgage/unmortgage/cartas), e a negociação é exatamente um documento sendo
posto na mesa. É por isso que ele não colide com nenhum cue de dinheiro.

Uso:  python3 scripts/build-trade-open.py [saida.wav]
Depois:  oggenc -q 5 saida.wav -o src/assets/sfx/trade-open.ogg
"""

import math
import random
import struct
import sys
import wave

SAMPLE_RATE = 44_100
DURATION = 0.42
SEED = 20_580_801  # fixo: o mesmo arquivo, byte a byte, em qualquer máquina
PEAK_TARGET = 0.50  # ≈ −6 dBFS. Cue frequente e discreto — não compete com os dados.


def envelope(t: float, attack: float, decay: float) -> float:
    """Envelope percussivo simples: ataque linear curto, decaimento exponencial."""
    if t < 0:
        return 0.0
    if t < attack:
        return t / attack
    return math.exp(-(t - attack) / decay)


def build() -> list[float]:
    rng = random.Random(SEED)
    n = int(SAMPLE_RATE * DURATION)
    out = [0.0] * n

    # ---- 1. Folha de papel -------------------------------------------------
    # Ruído branco passado por um band-pass de 2 polos (biquad simplificado por
    # diferença de dois one-pole), depois modulado por crepitações aleatórias.
    lo_state = 0.0
    hi_state = 0.0
    # coeficientes de one-pole: alpha = dt / (RC + dt)
    a_lo = 1.0 - math.exp(-2.0 * math.pi * 7000.0 / SAMPLE_RATE)
    a_hi = 1.0 - math.exp(-2.0 * math.pi * 1800.0 / SAMPLE_RATE)

    crackle = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        white = rng.uniform(-1.0, 1.0)
        lo_state += a_lo * (white - lo_state)   # tira o brilho acima de 7k
        hi_state += a_hi * (lo_state - hi_state)  # tira o corpo abaixo de 1,8k
        band = lo_state - hi_state

        # Crepitação: picos curtos e esparsos sobre o leito de ruído. É o que
        # separa "papel" de "chiado" — fibra que solta, não ar que passa.
        if rng.random() < 0.004:
            crackle = rng.uniform(0.6, 1.0)
        crackle *= 0.994

        # Duas passadas de mão: a folha é pega (0ms) e assentada (110ms).
        gesto = envelope(t, 0.012, 0.075) * 0.85 + envelope(t - 0.11, 0.02, 0.055) * 0.6
        out[i] += band * (0.55 + 0.9 * crackle) * gesto

    # ---- 2. Carimbo --------------------------------------------------------
    # Corpo grave curto + estalo de madeira. O grave dá PESO (o gesto de bater),
    # o estalo dá a superfície (madeira da mesa, não plástico).
    for i in range(n):
        t = i / SAMPLE_RATE - 0.165
        if t < 0:
            continue
        corpo = math.sin(2 * math.pi * 152.0 * t) * envelope(t, 0.002, 0.030) * 0.55
        estalo = math.sin(2 * math.pi * 1180.0 * t) * envelope(t, 0.0006, 0.012) * 0.30
        out[i] += corpo + estalo

    # ---- 3. Ficha ----------------------------------------------------------
    # Dois parciais inarmônicos, decaimento rápido: o "toc" seco de peça de
    # tabuleiro sendo pousada. Sutil de propósito — é o acento, não o evento.
    for i in range(n):
        t = i / SAMPLE_RATE - 0.196
        if t < 0:
            continue
        env = envelope(t, 0.0008, 0.018)
        out[i] += (
            math.sin(2 * math.pi * 2_140.0 * t) * env * 0.22
            + math.sin(2 * math.pi * 3_260.0 * t) * env * 0.12
        )

    # ---- 4. Acabamento -----------------------------------------------------
    # Fade de saída (anti-click) e normalização de pico.
    fade = int(SAMPLE_RATE * 0.035)
    for i in range(fade):
        out[n - 1 - i] *= i / fade
    for i in range(int(SAMPLE_RATE * 0.003)):
        out[i] *= i / (SAMPLE_RATE * 0.003)

    peak = max(abs(v) for v in out) or 1.0
    scale = PEAK_TARGET / peak
    return [v * scale for v in out]


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else 'trade-open.wav'
    samples = build()
    rms = math.sqrt(sum(v * v for v in samples) / len(samples))
    with wave.open(path, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, v)) * 32_767)) for v in samples))
    print(f'{path}: {len(samples)} amostras, {DURATION:.2f}s, '
          f'pico {20 * math.log10(PEAK_TARGET):.1f} dBFS, RMS {20 * math.log10(rms):.1f} dBFS')


if __name__ == '__main__':
    main()
