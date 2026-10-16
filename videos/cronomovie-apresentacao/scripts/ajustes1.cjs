// Ajustes depois da primeira revisão dos quadros de prova.
const fs = require('fs');
const f = require('path').join(__dirname, '..', 'index.html');
let s = fs.readFileSync(f, 'utf8');
let falhas = 0;
const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) { console.log((n ? 'REPETIDO ' : 'NAO ACHEI ') + a.slice(0, 90)); falhas++; return; } s = s.replace(a, () => b); };

// cartazes sem o nome embaixo (o cartaz já traz o título)
rep("it.innerHTML = `<img src=\"assets/coluna/${FILES[i]}.jpg\" alt=\"\"><div class=\"t\">${title}</div>`;", "it.innerHTML = `<img src=\"assets/coluna/${FILES[i]}.jpg\" alt=\"${title}\">`;");
// fundo do título de cima mais firme
rep("#scrim { left: 0; top: 0; width: 1080px; height: 640px; background: linear-gradient(180deg, #0b0b0c 0%, rgba(11, 11, 12, 0.92) 46%, rgba(11, 11, 12, 0) 100%); }",
  "#scrim { left: 0; top: 0; width: 1080px; height: 720px; background: linear-gradient(180deg, #0b0b0c 0%, #0b0b0c 58%, rgba(11, 11, 12, 0) 100%); }");
// títulos: invisíveis fora da sua janela (nada aparece pela borda da máscara)
rep(`            gsap.set(span, { yPercent: 105 });
            tl.to(span, { yPercent: 0, duration: 0.6, ease: 'expo.out' }, tin)
              .to(span, { yPercent: -105, duration: 0.4, ease: 'power3.in' }, tout - 0.4);`,
`            gsap.set(span, { yPercent: 105 });
            gsap.set(sel, { opacity: 0 });
            tl.set(sel, { opacity: 1 }, tin)
              .to(span, { yPercent: 0, duration: 0.6, ease: 'expo.out' }, tin)
              .to(span, { yPercent: -105, duration: 0.4, ease: 'power3.in' }, tout - 0.4)
              .set(sel, { opacity: 0 }, tout + 0.02);`);
// contagem, fecho e nome da marca: só aparecem quando entram
rep("gsap.set(['#daysS', '#daysS2'], { opacity: 0, y: 24 });", "gsap.set(['#daysS', '#daysS2'], { opacity: 0, y: 24 });\n          gsap.set('#days', { opacity: 0 });\n          tl.set('#days', { opacity: 1 }, 32.9);");
rep("gsap.set('#cta', { top: 1050 });", "gsap.set('#cta', { top: 1050, opacity: 0 });\n          tl.set('#cta', { opacity: 1 }, 36.9);");
rep("gsap.set('#word', { left: 0, top: 6 });", "gsap.set('#word', { left: 0, top: 6 });\n          gsap.set('#wordWrap', { opacity: 0 });\n          tl.set('#wordWrap', { opacity: 1 }, 2.4).set('#wordWrap', { opacity: 0 }, 4.55).set('#wordWrap', { opacity: 1 }, 36.5);");

if (falhas) { console.log('NADA GRAVADO'); process.exit(1); }
fs.writeFileSync(f, s);
console.log('ok');
