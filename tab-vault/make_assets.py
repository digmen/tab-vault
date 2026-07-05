"""Generate Chrome Web Store assets into assets/.

Outputs:
  assets/icon-store-128.png      128 x 128  (rounded tile, alpha)
  assets/promo-small-440x280.png 440 x 280  (24-bit PNG, no alpha)
  assets/promo-marquee-1400x560.png 1400 x 560 (24-bit PNG, no alpha)
  assets/screenshots/*.png       copies of the existing screenshots

Shares the visual language of make_promo.py (dark + purple, vault mark).
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os, shutil

OUT = 'assets'
os.makedirs(OUT, exist_ok=True)


def font(size, bold=False):
    paths = (
        ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf']
        if bold else
        ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf']
    )
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


BG   = (8,   8,  16)
BG2  = (14,  14, 28)
ACC  = (124, 107, 255)
ACCL = (160, 144, 255)
ACCD = (74,  58,  200)
GRN  = (74,  222, 128)
WHT  = (240, 240, 255)
DIM  = (80,  80,  120)
DIM2 = (40,  40,  70)
RED  = (248, 113, 113)


def gradient_bg(img, w, h):
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        c = tuple(int(BG[i] * (1 - t) + BG2[i] * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)


def radial_glow(img, cx, cy, r, color, alpha=0.4):
    glow = Image.new('RGB', img.size, (0, 0, 0))
    d = ImageDraw.Draw(glow)
    steps = 28
    for i in range(steps, 0, -1):
        rr = int(r * i / steps)
        t  = (1 - i / steps) ** 2
        c  = tuple(min(255, int(color[j] * t * 0.85)) for j in range(3))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
    glow = glow.filter(ImageFilter.GaussianBlur(max(1, r // 3)))
    return Image.blend(img, glow, alpha)


def draw_vault(d, cx, cy, size):
    r  = size * 0.44
    bw = max(2, int(size * 0.055))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ACC, width=bw)
    for ang in range(0, 360, 45):
        a    = math.radians(ang)
        long = ang % 90 == 0
        t1   = r * (0.65 if long else 0.76)
        t2   = r * 0.94
        lw   = max(1, bw - 1) if long else max(1, bw // 2)
        x1 = cx + t1 * math.cos(a)
        y1 = cy + t1 * math.sin(a)
        x2 = cx + t2 * math.cos(a)
        y2 = cy + t2 * math.sin(a)
        d.line([x1, y1, x2, y2], fill=ACCL, width=lw)
    ir = r * 0.38
    d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=ACCD, outline=ACCL, width=max(1, bw - 1))
    cr = r * 0.12
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=WHT)
    hw = size * 0.28
    hh = size * 0.09
    hx = cx - hw / 2
    hy = cy - r * 1.38
    d.rounded_rectangle([hx, hy, hx + hw, hy + hh], radius=int(hh / 2) + 1,
                        fill=ACCL, outline=ACC, width=1)


def txt_w(d, text, fnt):
    bb = d.textbbox((0, 0), text, font=fnt)
    return bb[2] - bb[0]


def center_text(d, text, fnt, y, W, fill):
    x = (W - txt_w(d, text, fnt)) // 2
    d.text((x, y), text, font=fnt, fill=fill)


# ════════════════════════════════════════════════════════════════
#  STORE ICON  128 × 128  (rendered 4× then downscaled for crisp edges)
# ════════════════════════════════════════════════════════════════
def make_icon(size=128, ss=4):
    S = size * ss
    img = Image.new('RGB', (S, S))
    gradient_bg(img, S, S)
    img = radial_glow(img, S // 2, int(S * 0.44), int(S * 0.52), ACC, alpha=0.5)

    d = ImageDraw.Draw(img)
    draw_vault(d, S // 2, int(S * 0.55), int(S * 0.60))

    # subtle inner border
    inset = 3 * ss
    d.rounded_rectangle([inset, inset, S - 1 - inset, S - 1 - inset],
                        radius=int(S * 0.20), outline=(64, 58, 116), width=max(1, ss))

    # rounded corners via alpha mask
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1],
                                           radius=int(S * 0.22), fill=255)
    img = img.convert('RGBA')
    img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


make_icon().save(f'{OUT}/icon-store-128.png')
print('icon-store-128.png saved')


# ════════════════════════════════════════════════════════════════
#  SMALL PROMO  440 × 280
# ════════════════════════════════════════════════════════════════
W, H = 440, 280
img = Image.new('RGB', (W, H))
gradient_bg(img, W, H)
img = radial_glow(img, W // 2, 90, 210, ACC, alpha=0.36)

d = ImageDraw.Draw(img)

for gx in range(0, W, 44):
    for gy in range(0, H, 44):
        d.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=(38, 36, 60))

draw_vault(d, W // 2, 93, 104)

f_title = font(40, bold=True)
f_tag   = font(14)
f_feat  = font(12)

center_text(d, 'Tab Vault', f_title, 160, W, WHT)

uw = txt_w(d, 'Tab Vault', f_title)
ux = (W - uw) // 2
d.rectangle([ux, 208, ux + uw, 211], fill=ACC)

center_text(d, 'Park tabs  •  free memory  •  restore anytime', f_tag, 218, W, DIM)

pills = ['One-click save', 'Search', 'Favorites']
pill_y = 246
total_pw = sum(txt_w(d, p, f_feat) + 26 for p in pills) + 12 * (len(pills) - 1)
px = (W - total_pw) // 2
for p in pills:
    pw = txt_w(d, p, f_feat) + 26
    d.rounded_rectangle([px, pill_y, px + pw, pill_y + 24], radius=12,
                        fill=DIM2, outline=ACC, width=1)
    d.ellipse([px + 9, pill_y + 9, px + 15, pill_y + 15], fill=ACC)
    d.text((px + 20, pill_y + 5), p, font=f_feat, fill=ACCL)
    px += pw + 12

d.rectangle([0, H - 4, W, H], fill=ACC)

img.save(f'{OUT}/promo-small-440x280.png')
print('promo-small-440x280.png saved')


# ════════════════════════════════════════════════════════════════
#  MARQUEE PROMO  1400 × 560
# ════════════════════════════════════════════════════════════════
W, H = 1400, 560
img = Image.new('RGB', (W, H))
gradient_bg(img, W, H)
img = radial_glow(img,  330, H // 2, 430, ACC,  alpha=0.30)
img = radial_glow(img, 1120, H // 2, 310, ACCD, alpha=0.16)

d = ImageDraw.Draw(img)

for gx in range(0, W, 60):
    for gy in range(0, H, 60):
        d.ellipse([gx, gy, gx + 1, gy + 1], fill=(32, 30, 52))

LX = 88
draw_vault(d, LX + 50, 110, 100)

f_title = font(70, bold=True)
f_sub   = font(22)
f_feat  = font(19)
f_badge = font(13)

d.text((LX, 158), 'Tab Vault', font=f_title, fill=WHT)
title_w = txt_w(d, 'Tab Vault', f_title)
d.rectangle([LX, 240, LX + title_w, 244], fill=ACC)

d.text((LX, 256), 'Park open tabs. Free up memory.', font=f_sub, fill=ACCL)
d.text((LX, 286), 'Restore any tab with one click.', font=f_sub, fill=DIM)

feats = [
    'Save current tab or all window tabs at once',
    'Real-time search by title or URL',
    'Favorites & drag-and-drop reorder',
    'Preserves tab group colors and names',
    '100% offline — no tracking, no ads',
]
fy = 336
for text in feats:
    d.rounded_rectangle([LX, fy + 5, LX + 10, fy + 15], radius=2, fill=ACC)
    d.text((LX + 20, fy), text, font=f_feat, fill=(175, 175, 210))
    fy += 36

bd_txt = 'No host permissions required'
bd_w   = txt_w(d, bd_txt, f_badge) + 36
d.rounded_rectangle([LX, fy + 8, LX + bd_w, fy + 36], radius=14,
                    fill=(28, 22, 58), outline=ACCD, width=1)
lx2, ly2 = LX + 12, fy + 16
d.rounded_rectangle([lx2, ly2 + 4, lx2 + 8, ly2 + 12], radius=1, fill=ACCL)
d.arc([lx2, ly2, lx2 + 8, ly2 + 8], start=180, end=0, fill=ACCL, width=2)
d.text((LX + 28, fy + 16), bd_txt, font=f_badge, fill=ACCL)

SEP = 690
for sy in range(44, H - 44):
    t = math.sin(math.pi * (sy - 44) / (H - 88))
    if int(60 * t) > 0:
        d.point((SEP, sy), fill=ACC)

RX = SEP + 52
RY = 24
PW = 398
PH = H - 48
RR = 16

for sh in range(18, 0, -1):
    a_sh = int(80 * (1 - sh / 18) ** 1.5)
    shadow_c = (0, 0, 0) if a_sh < 10 else (4, 2, 14)
    d.rounded_rectangle([RX + sh, RY + sh, RX + PW + sh, RY + PH + sh],
                        radius=RR, fill=shadow_c)

d.rounded_rectangle([RX, RY, RX + PW, RY + PH], radius=RR, fill=(13, 12, 24))
d.rounded_rectangle([RX, RY, RX + PW, RY + PH], radius=RR, outline=(62, 56, 104), width=1)

HDR_H = 55
d.rounded_rectangle([RX, RY, RX + PW, RY + HDR_H + RR], radius=RR, fill=(9, 8, 18))
d.rectangle([RX, RY + HDR_H // 2, RX + PW, RY + HDR_H], fill=(9, 8, 18))
d.line([RX, RY + HDR_H, RX + PW, RY + HDR_H], fill=(30, 30, 45), width=1)

f_hdr       = font(15, bold=True)
f_badge_hdr = font(11)
f_row_title = font(13, bold=True)
f_row_url   = font(11)
f_btn       = font(12)

ic = 28
ix, iy = RX + 16, RY + 14
d.ellipse([ix, iy, ix + ic, iy + ic], fill=ACCD)
icx, icy = ix + ic // 2, iy + ic // 2
for ang in [0, 90, 180, 270]:
    a = math.radians(ang)
    d.line([icx + 4 * math.cos(a), icy + 4 * math.sin(a),
            icx + 11 * math.cos(a), icy + 11 * math.sin(a)], fill=ACCL, width=1)

d.text((RX + 52, RY + 17), 'Tab Vault', font=f_hdr, fill=WHT)

badge_txt = '6'
bx = RX + 140
by = RY + 17
bw2 = txt_w(d, badge_txt, f_badge_hdr) + 16
d.rounded_rectangle([bx, by, bx + bw2, by + 20], radius=10, fill=(38, 28, 88))
d.text((bx + 8, by + 3), badge_txt, font=f_badge_hdr, fill=ACCL)

clr = 'Clear'
cx2 = RX + PW - 16 - txt_w(d, clr, f_btn) - 16
d.rounded_rectangle([cx2, RY + 14, RX + PW - 16, RY + 42], radius=7, fill=(50, 14, 14))
d.text((cx2 + 10, RY + 19), clr, font=f_btn, fill=RED)

SY = RY + HDR_H + 10
d.rounded_rectangle([RX + 12, SY, RX + PW - 12, SY + 36], radius=9,
                    fill=(20, 18, 40), outline=(52, 48, 88), width=1)
d.text((RX + 22, SY + 10), 'Search tabs...', font=font(13), fill=DIM)

rows = [
    ('star', (249, 171, 0), (42, 28, 8),  None,            'github.com/digmen/tab-vault',  'Tab Vault — GitHub repository'),
    ('open', DIM,           (13, 12, 24), (124, 107, 255), 'figma.com/design/AbcXyz123',   'UI Components · Figma'),
    ('hovr', DIM,           (22, 18, 48), (74, 222, 128),  'notion.so/workspace/hub',      'Project Notes — Q2 Roadmap'),
    ('open', DIM,           (13, 12, 24), None,            'docs.python.org/3/library/os', 'Python 3 Docs — os module'),
    ('open', DIM,           (13, 12, 24), (239, 68, 68),   'youtube.com/watch?v=xyz',      'Never Gonna Give You Up'),
    ('open', DIM,           (13, 12, 24), None,            'stackoverflow.com/q/7123456',  'Python dict comprehension'),
]

ty = SY + 46
ROW_H = 52
fav_colors = [ACCD, (80, 40, 180), (30, 100, 60), (80, 75, 30), (120, 20, 20), (50, 50, 100)]

for idx, (state, sc, row_bg, group_color, url, title) in enumerate(rows):
    is_hover = state == 'hovr'
    rb  = (28, 24, 55) if is_hover else row_bg
    bdc = (70, 62, 120) if is_hover else (40, 36, 68)

    if group_color:
        d.rounded_rectangle([RX + 10, ty, RX + 14, ty + ROW_H], radius=2, fill=group_color)

    d.rounded_rectangle([RX + 14, ty, RX + PW - 12, ty + ROW_H], radius=9, fill=rb, outline=bdc, width=1)

    star_ch = '★' if state == 'star' else '☆'
    d.text((RX + 21, ty + 14), star_ch, font=font(14, bold=True), fill=sc)

    fc = fav_colors[idx % len(fav_colors)]
    d.ellipse([RX + 44, ty + 13, RX + 62, ty + 31], fill=fc)

    t_text = title[:30] + ('…' if len(title) > 30 else '')
    u_text = url[:36]   + ('…' if len(url)   > 36 else '')
    d.text((RX + 70, ty + 7),  t_text, font=f_row_title, fill=WHT)
    d.text((RX + 70, ty + 25), u_text, font=f_row_url,   fill=DIM)

    if is_hover:
        for bi, (btxt, bcol) in enumerate([('↗', ACCL), ('×', RED)]):
            bx2 = RX + PW - 24 - (1 - bi) * 34
            d.rounded_rectangle([bx2, ty + 12, bx2 + 28, ty + 40], radius=7,
                                fill=(30, 26, 56), outline=bdc, width=1)
            d.text((bx2 + 6, ty + 15), btxt, font=font(14), fill=bcol)

    ty += ROW_H + 5

FY = RY + PH - 52
d.line([RX, FY, RX + PW, FY], fill=(30, 30, 45), width=1)

pb_w = (PW - 38) // 2
d.rounded_rectangle([RX + 12, FY + 9, RX + 12 + pb_w, FY + 42], radius=8, fill=(8, 32, 16))
label = 'Save current tab'
d.text((RX + 12 + (pb_w - txt_w(d, label, f_btn)) // 2, FY + 18), label, font=f_btn, fill=GRN)
rx3 = RX + 26 + pb_w
d.rounded_rectangle([rx3, FY + 9, rx3 + pb_w, FY + 42], radius=8, fill=(22, 18, 54))
label2 = 'Restore all'
d.text((rx3 + (pb_w - txt_w(d, label2, f_btn)) // 2, FY + 18), label2, font=f_btn, fill=ACCL)

d.rectangle([0, H - 5, W, H], fill=ACC)

img.save(f'{OUT}/promo-marquee-1400x560.png')
print('promo-marquee-1400x560.png saved')


# ════════════════════════════════════════════════════════════════
#  Copy screenshots (originals stay put; these are store-ready copies)
# ════════════════════════════════════════════════════════════════
sdst = os.path.join(OUT, 'screenshots')
os.makedirs(sdst, exist_ok=True)
for name in os.listdir('screenshots'):
    if name.lower().endswith('.png'):
        shutil.copy2(os.path.join('screenshots', name), os.path.join(sdst, name))
        print(f'copied screenshots/{name}')


# report
print('\n--- generated ---')
for fn in ['icon-store-128.png', 'promo-small-440x280.png', 'promo-marquee-1400x560.png']:
    im = Image.open(f'{OUT}/{fn}')
    print(f'{OUT}/{fn}', im.size, im.mode)
