"""Downscale supersampled renders from assets/_raw/ to exact store sizes.

Promos are flattened to 24-bit RGB (no alpha) as the Chrome Web Store requires;
the icon keeps its transparent rounded corners (RGBA).
"""
from PIL import Image
import os

RAW = 'assets/_raw'
OUT = 'assets'

targets = [
    ('icon-store-128.png',        (128, 128),  True),   # keep alpha
    ('promo-small-440x280.png',   (440, 280),  False),  # flatten
    ('promo-marquee-1400x560.png', (1400, 560), False),
]

for name, size, keep_alpha in targets:
    im = Image.open(os.path.join(RAW, name)).convert('RGBA')
    im = im.resize(size, Image.LANCZOS)
    if keep_alpha:
        im.save(os.path.join(OUT, name))
    else:
        bg = Image.new('RGB', size, (10, 9, 18))
        bg.paste(im, (0, 0), im)
        bg.save(os.path.join(OUT, name))
    out = Image.open(os.path.join(OUT, name))
    print(f'{OUT}/{name}', out.size, out.mode)
