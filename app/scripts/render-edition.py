#!/usr/bin/env python3
"""
Renders a magazine PDF to one WebP per page, ready to be copied into the
uploads volume as a digital edition.

Node has no PDF rasteriser and the production container has no ghostscript, so
this runs on a workstation. The output never goes into the repo, which is
public: it is copied straight into the oms-uploads docker volume.

    python3 scripts/render-edition.py THE_GENZ_TIMES_Issue03.pdf genz-times-issue-03

Then, from the repo root:

    tar -C out/editions -czf - genz-times-issue-03 \\
      | ssh slplserver@100.109.145.97 \\
        "docker run --rm -i -v oms-uploads:/v -w /v/editions alpine tar xzf -"
"""
import sys
import pathlib

import fitz  # PyMuPDF
from PIL import Image
import io

# 1600px on a Letter page is about 188 DPI: body text stays crisp and a page is
# roughly 200 KB, which matters because every page turn is a fresh request.
# Stored a little above the serving quality, since the watermark composite
# re-encodes on the way out.
WIDTH = 1600
QUALITY = 85


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    pdf_path, edition_key = sys.argv[1], sys.argv[2]
    if not edition_key.replace("-", "").isalnum():
        print("The edition key must be letters, digits and hyphens only.")
        return 2

    out_dir = pathlib.Path("out/editions") / edition_key
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    pages = len(doc)
    total_bytes = 0
    for index, page in enumerate(doc, start=1):
        # Render at a scale that lands on WIDTH, rather than a fixed DPI, so
        # every issue comes out the same size whatever its page dimensions.
        zoom = WIDTH / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")

        target = out_dir / f"p{index:03d}.webp"
        image.save(target, "WEBP", quality=QUALITY, method=6)
        total_bytes += target.stat().st_size

    doc.close()
    print(f"{pages} pages -> {out_dir}")
    print(f"total {total_bytes / 1048576:.1f} MB")
    print(f"\nSet pageCount={pages} and editionKey={edition_key} on the product.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
