# Método de motion do Cronomovie

Aprendido em 14/10/2026 no Prompt Motion (prompt-motion.com), uma galeria de 233 vídeos de motion feitos com o Claude, cada um com o prompt que o gerou, e nos cinco artigos do blog deles. Vale para todo vídeo do Cronomovie feito em código (HyperFrames). Junto com `frame.md` (marca), é o ponto de partida de qualquer peça.

## O que a galeria ensina

O mesmo prompt de 26 palavras foi usado por 33 pessoas, e os resultados foram de 0 a 17 mil curtidas. Prompt curto deixa tudo ao acaso. Os vídeos mais bem recebidos vieram de pedidos que tomam cinco decisões antes de o Claude começar:

1. **Um conceito só.** Exemplo: "uma forma só, sem corte; cada estado é o mesmo elemento se transformando". Sem conceito, sai um passeio de efeitos.
2. **Uma lista do que é proibido**, dizendo o que fazer no lugar.
3. **Tempo amarrado a uma batida**: andamento (BPM), número de compassos e "algo acontece em cada batida", em vez de "dinâmico".
4. **Como construir e renderizar**: cada quadro calculado a partir do tempo (sem animação que roda sozinha), capturado quadro a quadro e com desfoque de movimento nos movimentos rápidos.
5. **Uma revisão antes do render final**: renderizar um quadro por batida, olhar e corrigir o que estiver apertado, fora do tempo, sobreposto ou difícil de ler.

Mais três lições:

- **Explicativo bom mostra um processo com começo e fim** ("do copo vazio ao drinque pronto"). Tema solto ("a história da IA") vira genérico. Se o assunto não é um processo, ache a sequência dentro dele: uma linha do tempo com paradas contadas, um número mudando a cada passo.
- **Ninguém pede para conferir os fatos.** Para o Cronomovie isso é obrigatório: datas, títulos e números da Marvel conferidos antes, nunca inventados.
- **Formato desde o primeiro quadro.** Quase todos fizeram horizontal sem pedir. Para Reels e TikTok, pedir 9:16 em 1080x1920 já no prompt.

## O que entrega um vídeo "com cara de IA" (proibido)

Brilhos e neon decorativos, explosões de partículas, flares, tremor de câmera, separação de cores (RGB split), transição em dissolve, gradiente genérico, molejo exagerado nas animações, textinhos e marcadores nos cantos da tela, imagens e ícones de banco, quadro parado sem motivo (mais de meio segundo sem nada para ler) e qualquer coisa com cara de modelo pronto.

A regra que resume tudo: **nenhum movimento que não saia de um elemento que já está na tela.** Se algo explode, tem que vir de algum lugar e ir para algum lugar.

No Cronomovie, brilho só quando faz parte da ideia, como o reflexo que corre dentro das letras na abertura aprovada. Nunca de enfeite.

## O conceito-mãe do Cronomovie

A logo já é o conceito: **uma linha do tempo, pontos claros no caminho e o ponto vermelho da estreia no fim.** Em todo vídeo, o ponto vermelho amarra as cenas. Ele sai da logo, vira a parada de um filme na linha, vira o ponto de um "i", desenha um gráfico, cresce até ocupar a tela e volta para a logo no fim. As transições nascem dele, nunca de um dissolve.

## Modelo de pedido para um vídeo do Cronomovie

Copiar, preencher os campos entre colchetes e usar junto com as skills `hyperframes` e `motionmaxxing`.

```
<entradas>
Antes de começar, me pergunte: o assunto e a promessa em uma linha, de 3 a 6 momentos para mostrar em ordem,
os títulos e datas exatos (vou conferir), o texto final, e se tem narração (VoiceStudio) ou só música.
</entradas>

<direção>
Motion 2D em 9:16, 1080x1920, para Reels e TikTok, no visual de videos/marca/frame.md: fundo quase preto liso,
texto claro, um único vermelho (#E5484D). Logo Cronomovie em Big Shoulders Display; o resto em Inter.
Conceito: o ponto vermelho da logo conecta todas as cenas [descrever o caminho dele].
Público: [quem é], em português do Brasil, tom profissional, sem gírias.
Cada cena nasce da anterior; sem cortes secos sem motivo e sem dissolve.
Proibido: brilho de enfeite, partículas, flares, tremor, RGB split, dissolve, gradiente genérico, molejo exagerado,
texto nos cantos, ícone de banco, quadro parado sem nada para ler, qualquer coisa com cara de modelo pronto.
Deixe 250 px livres em cima e embaixo (área do Instagram).
</direção>

<estrutura>
[duração] segundos, [BPM] BPM, algo muda em cada batida.
Gancho no primeiro compasso. Um momento por compasso, em ordem: [lista].
Último compasso: o momento mais forte. Fim: a logo e cronomovie.com.
</estrutura>

<construção>
Projeto HyperFrames, linha do tempo GSAP pausada (cada quadro depende só do tempo, sem nada aleatório).
Molas e easing exponencial como funções do tempo; desfoque de movimento nos movimentos rápidos.
Fatos: só os que eu passei ou que você conferiu; nunca invente datas, números ou títulos.
</construção>

<revisão>
Antes do render final, renderize um quadro por batida e confira: nada apertado, sobreposto,
fora do tempo, ilegível ou dentro das faixas do Instagram. Corrija e só então renderize em alta qualidade.
</revisão>

<começo>
Me mostre o conceito em uma linha, o mapa de batidas e 4 quadros de prova antes de construir o vídeo inteiro.
</começo>
```

## Ferramentas (o que o Prompt Motion comparou)

- **HTML puro capturado quadro a quadro**: o mais usado na galeria, mas o pedido precisa explicar como montar.
- **HyperFrames** (o nosso): renderizador feito para agentes de IA, HTML com GSAP, código aberto. Já está instalado e foi com ele que fizemos a revelação da logo.
- **Remotion**: React; licença paga para algumas empresas. Não precisamos.
- **Three.js**: só para 3D de verdade. **Manim**: explicação de matemática.

Seja qual for, o pedido precisa dizer como construir; sem isso, cada vez sai de um jeito.

## Animação ao vivo no site (aprendido em 14/10/2026)

A primeira versão da abertura nova "travou" no celular e no computador. Motivo: a linha e as bolinhas eram SVG animado (traço e posição dentro do desenho), e isso roda no mesmo processador que está montando a página por baixo. Regras para qualquer animação do site:

- Só animar **posição, tamanho e opacidade** (`transform` e `opacity`) de **blocos HTML**. Isso a placa de vídeo faz sozinha e não trava mesmo com a página carregando. Nada de animar SVG, traço (`stroke-dashoffset`), cores, sombras, desfoque ou posição de fundo.
- Desenhar grande e só diminuir (fica nítido); `will-change: transform` nos blocos que se mexem.
- Não pesar a página enquanto a animação toca: o que puder esperar espera (`introDone()` em `src/intro.ts`), e desfoque de fundo (`backdrop-filter`) fica desligado embaixo da abertura.
- Reservar o espaço da barra de rolagem (`scrollbar-gutter: stable`), para a página não pular quando a animação termina.
