#!/usr/bin/env bash
# make3d.sh <dieline.jpeg> <out.png>
# Crops front+spine from the SLPL kit dieline and renders a 3D box mockup.
set -euo pipefail
SRC="$1"; OUT="$2"; T=$(mktemp -d)
# Panels (all three dielines share the same 1600x900 layout)
convert "$SRC" -crop 408x551+832+187 +repage "$T/front.png"
convert "$SRC" -crop 50x551+766+187 +repage "$T/spine.png"
# Spine face: recedes left, far edge foreshortened, darkened for depth
convert "$T/spine.png" -modulate 78,92 -alpha set -virtual-pixel transparent \
  -define distort:viewport=1200x1600+0+0 \
  +distort Perspective "0,0 168,318 50,0 262,262 50,551 262,1288 0,551 168,1222" \
  "$T/spine3d.png"
# Front face: near edge shared with spine, far edge slightly foreshortened
convert "$T/front.png" -alpha set -virtual-pixel transparent \
  -define distort:viewport=1200x1600+0+0 \
  +distort Perspective "0,0 262,262 408,0 1010,300 408,551 1010,1250 0,551 262,1288" \
  "$T/front3d.png"
# Soft ground shadow + composite on white
convert -size 1200x1600 xc:white \
  \( -size 900x140 xc:none -fill "rgba(20,25,45,0.28)" -draw "ellipse 450,70 430,55 0,360" -blur 0x22 \) -geometry +155+1240 -composite \
  "$T/spine3d.png" -composite \
  "$T/front3d.png" -composite \
  \( -size 1200x1600 gradient:"rgba(255,255,255,0.16)-rgba(0,0,0,0.05)" \) -compose softlight -composite \
  "$OUT"
rm -rf "$T"
