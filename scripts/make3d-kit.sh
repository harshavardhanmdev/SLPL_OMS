#!/usr/bin/env bash
# make3d-kit.sh <front.png> <spine.png> <out.png>
# Renders the SLPL kit box mockup (front + left spine, shadow, 800x1067).
# Panels stay near native resolution to avoid upscale blur; text is never
# regenerated, only perspective-warped.
set -euo pipefail
FRONT="$1"; SPINE="$2"; OUT="$3"; T=$(mktemp -d)
FW=$(identify -format %w "$FRONT"); FH=$(identify -format %h "$FRONT")
SW=$(identify -format %w "$SPINE"); SH=$(identify -format %h "$SPINE")
convert "$SPINE" -modulate 78,92 -alpha set -virtual-pixel transparent \
  -define distort:viewport=800x1067+0+0 \
  +distort Perspective "0,0 112,212 $SW,0 175,175 $SW,$SH 175,859 0,$SH 112,815" \
  "$T/spine3d.png"
convert "$FRONT" -alpha set -virtual-pixel transparent \
  -define distort:viewport=800x1067+0+0 \
  +distort Perspective "0,0 175,175 $FW,0 673,200 $FW,$FH 673,833 0,$FH 175,859" \
  "$T/front3d.png"
convert -size 800x1067 xc:white \
  \( -size 600x94 xc:none -fill "rgba(20,25,45,0.28)" -draw "ellipse 300,47 287,37 0,360" -blur 0x15 \) -geometry +103+827 -composite \
  "$T/spine3d.png" -composite \
  "$T/front3d.png" -composite \
  \( -size 800x1067 gradient:"rgba(255,255,255,0.16)-rgba(0,0,0,0.05)" \) -compose softlight -composite \
  -unsharp 0x1+0.7+0.02 \
  "$OUT"
rm -rf "$T"
