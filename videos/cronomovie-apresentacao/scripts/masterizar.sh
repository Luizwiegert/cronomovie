#!/usr/bin/env bash
# Leva o áudio de um MP4 para -14 LUFS (padrão de Instagram/TikTok) com pico em -1 dBTP, sem mexer na imagem.
# Uso: bash scripts/masterizar.sh renders/video.mp4 [--de-novo]   (substitui o arquivo; o original fica como .bruto.mp4;
#      --de-novo refaz a partir do .bruto.mp4 que já existe)
set -e
in="$1"; bruto="${in%.mp4}.bruto.mp4"
[ -f "$bruto" ] && [ "$2" = "--de-novo" ] || mv -f "$in" "$bruto"
m=$(ffmpeg -hide_banner -i "$bruto" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
v() { echo "$m" | grep "\"$1\"" | grep -o '[-0-9.]*' | head -1; }
ffmpeg -loglevel error -y -i "$bruto" -c:v copy -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(v input_i):measured_TP=$(v input_tp):measured_LRA=$(v input_lra):measured_thresh=$(v input_thresh):offset=$(v target_offset):linear=true,alimiter=limit=0.84:attack=2:release=50:level=disabled" -ar 48000 -c:a aac -b:a 192k "$in"
echo "$in: $(ffmpeg -hide_banner -i "$in" -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I:|Peak:)' | tail -2 | tr -s ' ' | tr '\n' ' ')"
