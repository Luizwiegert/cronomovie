---
name: Cronomovie
colors:
  bg: "#0B0B0C"
  surface: "#141416"
  ink: "#F2F1EE"
  accent: "#E5484D"
  accent-hi: "#FFB3B5"
  label: "rgba(242, 241, 238, 0.72)"
  track: "rgba(242, 241, 238, 0.42)"
typography:
  display:
    family: "Big Shoulders Display"
    weights: [700, 900]
    use: "nome da marca, anos, números grandes, títulos de impacto"
  body:
    family: "Inter"
    weights: [400, 600, 700]
    use: "frases de apoio, legendas e números (desde 14/10/2026 o site usa a letra do sistema da Apple, com Inter fora da Apple); a display fica para a logo e os rótulos"
  label:
    family: "Big Shoulders Display"
    weight: 700
    letter-spacing: "0.24em a 0.3em"
    case: "MAIÚSCULAS"
spacing:
  title-safe: "80px no 16:9; 60px nas laterais e 250px em cima e embaixo no 9:16 (área segura do Instagram)"
  logo:
    mark: "1,36 x 0,68 do tamanho do nome"
    gap: "0,2 do tamanho do nome"
components:
  logo-mark: "viewBox 0 0 64 32: linha de (8,16) a (48,16), traço 2; pontos claros r=4 em x=8 e x=24; ponto vermelho r=11 em x=48"
  wordmark: "Crono em tinta + movie em vermelho, Big Shoulders Display 900, sem espaço entre as duas partes"
---

# Cronomovie, marca em vídeo

## Visão geral

Sala de cinema escura. O fundo é quase preto, os cartazes são as únicas cores fortes e o vermelho aparece pouco: no "movie", no ponto da estreia e em linhas finas. O tom é de produto sério feito por quem gosta de cinema, não de fã-clube.

## O quadro

- Fundo sempre `bg`. Nada de fundo chapado sem tratamento: use vinheta, granulado leve e um brilho vermelho suave atrás do elemento principal.
- A ideia que amarra tudo é a **linha do tempo que chega na estreia**: uma linha, pontos claros pelo caminho e um ponto vermelho no fim. Ela é o símbolo da logo e pode voltar como motivo gráfico (trilhos, réguas de anos).
- Texto de impacto ocupa de 60% a 80% da largura. Rótulos pequenos em maiúsculas com espaçamento largo.

## Movimento

- **Rico e cinematográfico, mas só com a marca.** Na abertura não entram cartazes da Marvel nem frase: é só a revelação da logo. Uma vinheta parada, com a logo pequena num fundo vazio, foi reprovada; um corredor de cartazes também. O que foi aprovado como caminho: a câmera colada nas letras gigantes do nome, inclinadas em 3D, com um brilho metálico e vermelho correndo por dentro, recuando até a logo de frente.
- Entradas com `expo.out` ou `back.out`; movimentos de câmera com `power3.inOut`. Varie durações; nada de tudo em 0,4 s.
- O ponto vermelho da estreia é o clímax: surge com um anel que se expande, um clarão horizontal e o brilho de fundo.
- **Imagem sempre nítida.** No site a abertura é desenhada ao vivo pelo navegador (`src/intro.ts`), não em vídeo comprimido. Vídeo pra postar sai em 1080p com qualidade alta (`-q high`), sem recomprimir.

## Método

Antes de fazer qualquer vídeo, leia `metodo-motion.md` (o que funciona e o que dá cara de IA, com o modelo de pedido).

## Peças prontas pra reaproveitar

- `../cronomovie-abertura/index.html` (16:9) e `../cronomovie-abertura-vertical/index.html` (9:16): a revelação da logo, 4,2 s. Serve de abertura ou de fecho de qualquer vídeo.
- Originais em alta: `../cronomovie-abertura/renders/cronomovie-logo-16x9.mp4` e `../cronomovie-abertura-vertical/renders/cronomovie-logo-9x16.mp4`.

## Instagram

- Reels e Stories: 1080x1920, 30 fps. Deixe 250 px livres em cima e embaixo (nome do perfil, legenda e botões cobrem essas faixas).
- Feed: 1080x1350 (4:5).
- Posts de Instagram são um plano futuro. A abertura do site não foi feita pra lá; decidir o formato das peças quando o trabalho começar.

## O que não fazer

- Não imitar o logo da Marvel Studios (bloco prateado, páginas de quadrinhos virando).
- Não usar outras cores de destaque além do vermelho.
- Não usar gírias nos textos ("turma", "pra", "bora"). Tom profissional.
- Não deixar a logo pequena e parada num fundo vazio.
- Na abertura e na revelação da logo: sem cartazes da Marvel e sem frase.
- Não entregar vídeo comprimido demais: a reclamação foi "qualidade de imagem muito ruim".
