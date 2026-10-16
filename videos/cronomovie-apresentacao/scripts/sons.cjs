// Gera os efeitos sonoros do vídeo por síntese (nada baixado de terceiros, sem direitos de ninguém).
// Saída: assets/sons/*.wav (48 kHz, 16 bits, estéreo).
const fs = require('fs');
const path = require('path');
const SR = 48000;
const OUT = path.join(__dirname, '..', 'assets', 'sons');
fs.mkdirSync(OUT, { recursive: true });

// ruído determinístico (sempre o mesmo som)
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };

function wav(name, L, R = L) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0.98 ? 0.98 / peak : 1;
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(path.join(OUT, name + '.wav'), buf);
  console.log(name, (n / SR).toFixed(2) + 's');
}
const arr = s => new Float64Array(Math.round(s * SR));

// filtro passa-faixa (biquad) com frequência que muda no tempo
function bandpass(x, fOf, q = 1.2) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const f = fOf(i / SR), w = 2 * Math.PI * f / SR, a = Math.sin(w) / (2 * q), c = Math.cos(w);
    const b0 = a, b2 = -a, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    const v = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function lowpass(x, f) {
  const y = new Float64Array(x.length), k = 1 - Math.exp(-2 * Math.PI * f / SR);
  let v = 0;
  for (let i = 0; i < x.length; i++) { v += k * (x[i] - v); y[i] = v; }
  return y;
}
// eco curto, para dar ar (sem exagero)
function room(x, mix = 0.18) {
  const y = Float64Array.from(x), taps = [[0.031, 0.5], [0.047, 0.38], [0.071, 0.27], [0.109, 0.18], [0.163, 0.1]];
  for (const [d, g] of taps) { const o = Math.round(d * SR); for (let i = o; i < y.length; i++) y[i] += x[i - o] * g * mix * 2; }
  return y;
}
const env = (t, a, d, total) => (t < a ? t / a : Math.max(0, 1 - (t - a) / Math.max(1e-6, total - a))) ** d;
const pan = (x, from, to) => { const L = new Float64Array(x.length), R = new Float64Array(x.length); for (let i = 0; i < x.length; i++) { const p = from + (to - from) * (i / x.length); L[i] = x[i] * Math.cos((p + 1) * Math.PI / 4); R[i] = x[i] * Math.sin((p + 1) * Math.PI / 4); } return [L, R]; };

// 1. deslize de ar (whoosh): ruído num passa-faixa que sobe ou desce
function whoosh(name, dur, f0, f1, peakAt = 0.6, gain = 0.9, p0 = -0.6, p1 = 0.6) {
  const x = arr(dur);
  for (let i = 0; i < x.length; i++) x[i] = rnd();
  const y = bandpass(x, t => f0 * Math.pow(f1 / f0, t / dur), 1.6);
  for (let i = 0; i < y.length; i++) { const t = i / SR, u = t / dur; y[i] *= gain * 3.2 * (u < peakAt ? (u / peakAt) ** 2 : (1 - (u - peakAt) / (1 - peakAt)) ** 1.6); }
  wav(name, ...pan(room(y, 0.12), p0, p1));
}
whoosh('whoosh-curto', 0.42, 500, 3200, 0.55);
whoosh('whoosh-medio', 0.7, 350, 2600, 0.6);
whoosh('whoosh-desce', 1.5, 3200, 260, 0.35, 0.8, 0.2, -0.2);
whoosh('whoosh-reverso', 0.6, 300, 4200, 0.92, 0.75, 0, 0);

// 2. o ponto acende: batida grave + brilho curto
(() => {
  const d = 0.9, x = arr(d);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = 55 + 140 * Math.exp(-t * 28);
    x[i] = Math.sin(2 * Math.PI * f * t + 2 * Math.sin(2 * Math.PI * 30 * t * Math.exp(-t * 20))) * Math.exp(-t * 6) * 0.95
      + Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 9) * 0.08 + Math.sin(2 * Math.PI * 2640 * t) * Math.exp(-t * 12) * 0.05;
  }
  for (let i = 0; i < 0.012 * SR; i++) x[i] += rnd() * 0.4 * (1 - i / (0.012 * SR));
  wav('acende', room(x, 0.2));
})();

// 3. toque na tela (tap): estalo curto e seco
function tap(name, f = 2200, g = 0.7) {
  const d = 0.12, x = arr(d);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (rnd() * 0.6 * Math.exp(-t * 180) + Math.sin(2 * Math.PI * f * t) * 0.5 * Math.exp(-t * 60)) * g; }
  wav(name, lowpass(x, 9000));
}
tap('toque', 2200, 0.8);
tap('interruptor', 1300, 0.9);

// 4. sucesso (✓): duas notas subindo
function chime(name, notes, step = 0.075, dec = 7, g = 0.45) {
  const d = step * notes.length + 0.9, x = arr(d);
  notes.forEach((f, k) => {
    const s0 = Math.round(k * step * SR);
    for (let i = s0; i < x.length; i++) { const t = (i - s0) / SR; x[i] += (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 6)) * Math.exp(-t * dec) * g; }
  });
  wav(name, room(x, 0.22));
}
chime('check', [987.8, 1318.5]);
chime('notificacao', [1318.5, 1760], 0.11, 5, 0.4);
chime('assinatura', [440, 554.4, 659.3, 880], 0.06, 2.6, 0.32);

// 5. estalo de bolha (fotos, coração)
function pop(name, f0, f1, d = 0.11, g = 0.75) {
  const x = arr(d + 0.1);
  for (let i = 0; i < x.length; i++) { const t = i / SR, f = f0 + (f1 - f0) * Math.min(1, t / d); x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 26) * g; }
  wav(name, room(x, 0.1));
}
pop('pop', 380, 980);
pop('pop-grave', 220, 520, 0.13, 0.8);

// 6. tique de contador: uma sequência de tiques que acompanha a contagem (ease power2.out)
function ticks(name, total, dur, steps, g = 0.38) {
  const x = arr(dur + 0.15), ease = u => 1 - (1 - u) ** 2;
  let last = -1;
  for (let i = 0; i < Math.round(dur * SR); i++) {
    const v = Math.floor(ease(i / (dur * SR)) * steps);
    if (v !== last) {
      last = v;
      for (let j = 0; j < 0.02 * SR && i + j < x.length; j++) { const t = j / SR; x[i + j] += (Math.sin(2 * Math.PI * 3400 * t) * Math.exp(-t * 400) + rnd() * 0.3 * Math.exp(-t * 900)) * g; }
    }
  }
  wav(name, x);
}
ticks('contador-84', 84, 1.25, 28);
ticks('contador-progresso', 40, 1.0, 16);
ticks('contador-amigos', 76, 0.95, 14);

// 7. subida antes da contagem final e o impacto
(() => {
  const d = 1.3, x = arr(d);
  for (let i = 0; i < x.length; i++) x[i] = rnd();
  const y = bandpass(x, t => 300 * Math.pow(12, t / d), 2.2);
  for (let i = 0; i < y.length; i++) { const t = i / SR, u = t / d; y[i] = y[i] * 2.4 * u ** 2.2 + Math.sin(2 * Math.PI * (160 + 520 * u ** 2) * t) * 0.22 * u ** 1.5; }
  wav('subida', room(y, 0.1));
})();
(() => {
  const d = 2.2, x = arr(d);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = 46 + 60 * Math.exp(-t * 14);
    x[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 2.2) * 1.0 + Math.sin(2 * Math.PI * 92 * t) * Math.exp(-t * 5) * 0.3;
  }
  const n = arr(d);
  for (let i = 0; i < n.length; i++) n[i] = rnd() * Math.exp(-(i / SR) * 14) * 0.7;
  const nl = lowpass(n, 1800);
  for (let i = 0; i < x.length; i++) x[i] += nl[i];
  wav('impacto', room(x, 0.3));
})();
