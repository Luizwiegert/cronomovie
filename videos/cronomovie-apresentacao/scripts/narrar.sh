#!/usr/bin/env bash
# Gera a narração frase por frase no VoiceStudio (uma faixa por frase, para encaixar no vídeo).
cd "$(dirname "$0")/.."
mkdir -p assets/voz/narracao
VOZ="${VOZ:-male, middle-aged, low pitch}"
PASTA="${PASTA:-assets/voz/narracao}"
frase() {
  local n="$1" texto="$2"
  [ -f "$PASTA/$n.wav" ] && { echo "já existe $n"; return; }
  node scripts/voz.cjs fala "$PASTA/$n.wav" "{\"text\":\"$texto\",\"language\":\"pt\",\"instruct\":\"$VOZ\",\"speed\":1.08,\"steps\":16}" 2>&1 | tail -2
}
frase 01 "Cronomovie."
frase 02 "Cento e sessenta e dois títulos da Marvel, na ordem certa."
frase 03 "Tudo num lugar só."
frase 04 "Marque o que você já viu,"
frase 05 "acompanhe o seu progresso"
frase 06 "e veja só o que leva a Doutor Destino."
frase 07 "Episódio por episódio,"
frase 08 "com trailer e onde assistir."
frase 09 "Compare com os amigos,"
frase 10 "sem spoiler,"
frase 11 "e mostre a sua maratona."
frase 12 "Faltam sessenta e dois dias."
frase 13 "Cronomovie ponto com. É grátis."
echo FIM
