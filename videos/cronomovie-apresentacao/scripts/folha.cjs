// Folha de conferência: as imagens de uma pasta lado a lado, num PNG só (para revisar rápido).
// Uso: node scripts/folha.cjs <pasta> <saida.png> [colunas] [largura]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const [dir, out, cols = '6', w = '220'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
const W = Number(w), H = Math.round(W * 2.2), C = Number(cols), R = Math.ceil(files.length / C);
const args = ['-v', 'error', '-y'];
files.forEach(f => args.push('-i', path.join(dir, f)));
const parts = files.map((_, i) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:0:0:0x222222[v${i}]`);
const layout = files.map((_, i) => `${(i % C) * (W + 4)}_${Math.floor(i / C) * (H + 4)}`).join('|');
const filter = parts.join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=${layout}:fill=0x111111`;
args.push('-filter_complex', filter, '-frames:v', '1', out);
execFileSync('ffmpeg', args);
console.log(files.map((f, i) => `${i + 1}. ${f}`).join('\n'));
