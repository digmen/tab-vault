"""Downscale supersampled renders from assets/_raw/ to exact store sizes.

Every PNG in _raw/ was rendered at SCALE x its target size (see render_assets.mjs),
so the final size is simply the raw size / SCALE. Promos and screenshots are
flattened to 24-bit RGB (no alpha) as the Chrome Web Store requires; the icon
keeps its transparent rounded corners (RGBA).
"""
from PIL import Image
import os

RAW = 'assets/_raw'
OUT = 'assets'
SCALE = 3  # must match render_assets.mjs

for name in sorted(os.listdir(RAW)):
    if not name.lower().endswith('.png'):
        continue
    im = Image.open(os.path.join(RAW, name)).convert('RGBA')
    size = (im.width // SCALE, im.height // SCALE)
    im = im.resize(size, Image.LANCZOS)

    keep_alpha = name.startswith('icon')
    if keep_alpha:
        im.save(os.path.join(OUT, name))
    else:
        bg = Image.new('RGB', size, (10, 9, 18))
        bg.paste(im, (0, 0), im)
        bg.save(os.path.join(OUT, name))

    out = Image.open(os.path.join(OUT, name))
    print(f'{OUT}/{name}', out.size, out.mode)
